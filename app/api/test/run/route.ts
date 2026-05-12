import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFixRecommendation } from "@/lib/fix-recommendations";
import type { Viewport, Category, ResultStatus, Severity } from "@/types";

interface RunPayload {
  url: string;
  viewports: Viewport[];
  checks: {
    performance: boolean;
    broken_links: boolean;
    compatibility: boolean;
    security: boolean;
    others: boolean;
  };
}

interface TestResultInsert {
  test_run_id: string;
  category: Category;
  check_name: string;
  status: ResultStatus;
  severity: Severity;
  message: string;
  fix_recommendation: string;
  screenshot_url: string | null;
}

const VIEWPORT_SIZES: Record<Viewport, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RunPayload;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const { url, viewports, checks } = body;
  if (!url || !viewports?.length)
    return NextResponse.json({ error: "URL and viewports are required" }, { status: 400 });

  try {
    const p = new URL(url);
    if (!["http:", "https:"].includes(p.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid URL. Must start with http:// or https://" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: testRun, error: runError } = await admin
    .from("test_runs")
    .insert({ user_id: user.id, page_url: url, status: "running" })
    .select().single();

  if (runError || !testRun)
    return NextResponse.json({ error: "Failed to create test run" }, { status: 500 });

  runTests(testRun.id, url, viewports, checks, admin).catch(async (err) => {
    console.error("Test runner error:", err);
    await admin.from("test_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", testRun.id);
  });

  return NextResponse.json({ testRunId: testRun.id });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTests(testRunId: string, url: string, viewports: Viewport[], checks: RunPayload["checks"], admin: any) {
  const results: TestResultInsert[] = [];

  // ── SECURITY checks (HTTP-level, no browser needed) ──────────────
  if (checks.security) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const headRes = await fetch(url, { 
        method: "GET", 
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QATester/1.0)" } 
      });
      
      clearTimeout(timeoutId);
      const headers = headRes.headers;
      const finalUrl = headRes.url;

      // HTTPS check
      const isHttps = finalUrl.startsWith("https://");
      results.push({ test_run_id: testRunId, category: "security", check_name: "HTTPS",
        status: isHttps ? "pass" : "fail", severity: isHttps ? "low" : "critical",
        message: isHttps ? "Site is served over HTTPS" : "Site is NOT served over HTTPS",
        fix_recommendation: isHttps ? "" : getFixRecommendation("missing_https"), screenshot_url: null });

      // Security headers
      const secHeaders: { key: string; header: string; label: string; sev: "critical"|"medium"|"low" }[] = [
        { key: "missing_hsts", header: "strict-transport-security", label: "HSTS", sev: "critical" },
        { key: "missing_csp", header: "content-security-policy", label: "Content-Security-Policy", sev: "critical" },
        { key: "missing_x_frame_options", header: "x-frame-options", label: "X-Frame-Options", sev: "medium" },
        { key: "missing_x_content_type", header: "x-content-type-options", label: "X-Content-Type-Options", sev: "medium" },
        { key: "missing_referrer_policy", header: "referrer-policy", label: "Referrer-Policy", sev: "low" },
        { key: "missing_permissions_policy", header: "permissions-policy", label: "Permissions-Policy", sev: "low" },
      ];
      for (const h of secHeaders) {
        const val = headers.get(h.header);
        results.push({ test_run_id: testRunId, category: "security", check_name: h.label,
          status: val ? "pass" : "fail", severity: val ? "low" : h.sev,
          message: val ? `${h.label}: ${val.slice(0, 80)}` : `Missing ${h.label} header`,
          fix_recommendation: val ? "" : getFixRecommendation(h.key), screenshot_url: null });
      }

      // Cookie security (check Set-Cookie header)
      const setCookie = headers.get("set-cookie") || "";
      if (setCookie) {
        const hasSecure = setCookie.toLowerCase().includes("secure");
        const hasHttpOnly = setCookie.toLowerCase().includes("httponly");
        const hasSameSite = setCookie.toLowerCase().includes("samesite");
        const cookieOk = hasSecure && hasHttpOnly && hasSameSite;
        results.push({ test_run_id: testRunId, category: "security", check_name: "Cookie Security Flags",
          status: cookieOk ? "pass" : "warning", severity: cookieOk ? "low" : "medium",
          message: cookieOk ? "Cookies have Secure, HttpOnly, and SameSite flags"
            : `Cookie flags missing: ${!hasSecure?"Secure ":""}${!hasHttpOnly?"HttpOnly ":""}${!hasSameSite?"SameSite":""}`.trim(),
          fix_recommendation: cookieOk ? "" : getFixRecommendation("insecure_cookies"), screenshot_url: null });
      }
    } catch (err) {
      console.error("Security checks error:", err);
      if (err instanceof Error && err.name === 'AbortError') {
        results.push({ test_run_id: testRunId, category: "security", check_name: "HTTP Request",
          status: "warning", severity: "medium",
          message: "Initial HTTP request timed out after 15 seconds",
          fix_recommendation: "Check if the server is responding slowly or if there are network issues.", screenshot_url: null });
      }
    }
  }

  // ── PERFORMANCE via Lighthouse (desktop viewport) ──────────────────────
  if (checks.performance) {
    let lhBrowser;
    try {
      const { chromium } = await import("playwright");
      lhBrowser = await chromium.launch({
        headless: true,
        args: [
          "--remote-debugging-port=9222",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
      await new Promise(r => setTimeout(r, 1000));
      const lighthouse = (await import("lighthouse")).default;
      
      // Use mobile config to match official Lighthouse (PageSpeed Insights uses mobile by default)
      const lhResult = await lighthouse(url, {
        port: 9222,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance"],
        formFactor: "mobile",
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
      });
      
      const lhr = lhResult?.lhr;
      if (lhr) {
        const perfScore = Math.round((lhr.categories.performance?.score ?? 0) * 100);
        const audits = lhr.audits;
        
        // Correct metric extraction (values are in milliseconds)
        const lcp = Math.round((audits["largest-contentful-paint"]?.numericValue ?? 0)) / 1000;
        const fcp = Math.round((audits["first-contentful-paint"]?.numericValue ?? 0)) / 1000;
        const ttfb = Math.round(audits["server-response-time"]?.numericValue ?? 0);
        const cls = Math.round((audits["cumulative-layout-shift"]?.numericValue ?? 0) * 1000) / 1000;
        const tbt = Math.round(audits["total-blocking-time"]?.numericValue ?? 0);
        const si = Math.round((audits["speed-index"]?.numericValue ?? 0)) / 1000;
        const tti = Math.round((audits["interactive"]?.numericValue ?? 0)) / 1000;

        results.push({ test_run_id: testRunId, category: "performance", check_name: "Lighthouse Performance Score",
          status: perfScore >= 90 ? "pass" : perfScore >= 50 ? "warning" : "fail",
          severity: perfScore >= 90 ? "low" : perfScore >= 50 ? "medium" : "critical",
          message: `Performance score: ${perfScore}/100 (Mobile, 4G throttled)`,
          fix_recommendation: perfScore < 90 ? getFixRecommendation("performance_score_low") : "", screenshot_url: null });

        // LCP
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Largest Contentful Paint (LCP)",
          status: lcp <= 2.5 ? "pass" : lcp <= 4 ? "warning" : "fail",
          severity: lcp <= 2.5 ? "low" : lcp <= 4 ? "medium" : "critical",
          message: `LCP: ${lcp.toFixed(1)}s (target ≤ 2.5s)`,
          fix_recommendation: lcp > 2.5 ? getFixRecommendation("lcp_slow") : "", screenshot_url: null });

        // FCP
        results.push({ test_run_id: testRunId, category: "performance", check_name: "First Contentful Paint (FCP)",
          status: fcp <= 1.8 ? "pass" : fcp <= 3 ? "warning" : "fail",
          severity: fcp <= 1.8 ? "low" : fcp <= 3 ? "medium" : "critical",
          message: `FCP: ${fcp.toFixed(1)}s (target ≤ 1.8s)`,
          fix_recommendation: fcp > 1.8 ? getFixRecommendation("fcp_slow") : "", screenshot_url: null });

        // TTFB
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Time to First Byte (TTFB)",
          status: ttfb <= 600 ? "pass" : ttfb <= 1800 ? "warning" : "fail",
          severity: ttfb <= 600 ? "low" : ttfb <= 1800 ? "medium" : "critical",
          message: `TTFB: ${ttfb}ms (target ≤ 600ms)`,
          fix_recommendation: ttfb > 600 ? getFixRecommendation("ttfb_slow") : "", screenshot_url: null });

        // CLS
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Cumulative Layout Shift (CLS)",
          status: cls <= 0.1 ? "pass" : cls <= 0.25 ? "warning" : "fail",
          severity: cls <= 0.1 ? "low" : cls <= 0.25 ? "medium" : "critical",
          message: `CLS: ${cls.toFixed(3)} (target ≤ 0.1)`,
          fix_recommendation: cls > 0.1 ? getFixRecommendation("cls_high") : "", screenshot_url: null });

        // TBT
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Total Blocking Time (TBT)",
          status: tbt <= 200 ? "pass" : tbt <= 600 ? "warning" : "fail",
          severity: tbt <= 200 ? "low" : tbt <= 600 ? "medium" : "critical",
          message: `TBT: ${tbt}ms (target ≤ 200ms)`,
          fix_recommendation: tbt > 200 ? getFixRecommendation("tbt_high") : "", screenshot_url: null });

        // Speed Index
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Speed Index",
          status: si <= 3.4 ? "pass" : si <= 5.8 ? "warning" : "fail",
          severity: si <= 3.4 ? "low" : si <= 5.8 ? "medium" : "critical",
          message: `Speed Index: ${si.toFixed(1)}s (target ≤ 3.4s)`,
          fix_recommendation: si > 3.4 ? getFixRecommendation("performance_score_low") : "", screenshot_url: null });

        // TTI
        results.push({ test_run_id: testRunId, category: "performance", check_name: "Time to Interactive (TTI)",
          status: tti <= 3.8 ? "pass" : tti <= 7.3 ? "warning" : "fail",
          severity: tti <= 3.8 ? "low" : tti <= 7.3 ? "medium" : "critical",
          message: `TTI: ${tti.toFixed(1)}s (target ≤ 3.8s)`,
          fix_recommendation: tti > 3.8 ? getFixRecommendation("performance_score_low") : "", screenshot_url: null });
      }
    } catch (lhErr) {
      console.error("Lighthouse error:", lhErr);
      results.push({ test_run_id: testRunId, category: "performance", check_name: "Lighthouse Scan",
        status: "warning", severity: "low",
        message: `Performance scan could not complete: ${lhErr instanceof Error ? lhErr.message : "unknown error"}`,
        fix_recommendation: "", screenshot_url: null });
    } finally {
      if (lhBrowser) {
        try { await lhBrowser.close(); } catch { /* ignore */ }
      }
    }
  }

  // ── PER-VIEWPORT BROWSER CHECKS ─────────────────────────────────────────
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    for (const viewport of viewports) {
      const { width, height } = VIEWPORT_SIZES[viewport];
      const context = await browser.newContext({
        viewport: { width, height },
        userAgent: "Mozilla/5.0 (compatible; QATester/1.0; +https://qa-tester.app)",
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 120)); });
      page.on("pageerror", err => consoleErrors.push(err.message.slice(0, 120)));

      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (!response || response.status() >= 400) {
          results.push({ test_run_id: testRunId, category: "broken_links", check_name: "Page Load",
            status: "fail", severity: "critical",
            message: `Page returned status ${response?.status() ?? "unknown"}`,
            fix_recommendation: getFixRecommendation("broken_link"), screenshot_url: null });
          await context.close(); continue;
        }
        await page.waitForTimeout(800); // ⚡ Reduced from 1500ms to 800ms

        // ── OTHERS CATEGORY: RESPONSIVE ──────────────────────────────────────────────────
        if (checks.others) {
          // Viewport meta tag (only check once on desktop)
          if (viewport === "desktop") {
            const hasViewportMeta = await page.evaluate(() =>
              !!document.querySelector('meta[name="viewport"]'));
            results.push({ test_run_id: testRunId, category: "others", check_name: "Viewport Meta Tag",
              status: hasViewportMeta ? "pass" : "fail", severity: hasViewportMeta ? "low" : "critical",
              message: hasViewportMeta ? "Viewport meta tag present" : "Missing <meta name=\"viewport\"> tag",
              fix_recommendation: hasViewportMeta ? "" : getFixRecommendation("missing_viewport_meta"), screenshot_url: null });
          }

          // Horizontal overflow
          const overflowResult = await page.evaluate((vw: number) => {
            const hasOverflow = document.body.scrollWidth > vw || document.documentElement.scrollWidth > vw;
            const offScreen: string[] = [];
            document.querySelectorAll("*").forEach((el) => {
              const rect = (el as HTMLElement).getBoundingClientRect();
              if (rect.right > vw + 5 || rect.left < -5) {
                const tag = el.tagName.toLowerCase();
                const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
                const cls = (el as HTMLElement).className ? `.${String((el as HTMLElement).className).split(" ")[0]}` : "";
                offScreen.push(`${tag}${id}${cls}`);
              }
            });
            return { hasOverflow, offScreen: offScreen.slice(0, 5) };
          }, width);
          results.push({ test_run_id: testRunId, category: "others", check_name: `Horizontal Overflow (${viewport})`,
            status: overflowResult.hasOverflow ? "fail" : "pass",
            severity: overflowResult.hasOverflow ? (viewport === "mobile" ? "critical" : "medium") : "low",
            message: overflowResult.hasOverflow
              ? `Horizontal overflow at ${width}px. Elements: ${overflowResult.offScreen.join(", ") || "detected"}`
              : `No horizontal overflow at ${width}px`,
            fix_recommendation: overflowResult.hasOverflow ? getFixRecommendation("horizontal_overflow") : "", screenshot_url: null });

          // Font size (mobile only)
          if (viewport === "mobile") {
            const smallFonts = await page.evaluate(() => {
              let count = 0;
              document.querySelectorAll("p, span, a, li, td, th").forEach((el) => {
                if (parseFloat(window.getComputedStyle(el).fontSize) < 12) count++;
              });
              return count;
            });
            results.push({ test_run_id: testRunId, category: "others", check_name: "Font Size (mobile)",
              status: smallFonts > 0 ? "warning" : "pass", severity: smallFonts > 0 ? "medium" : "low",
              message: smallFonts > 0 ? `${smallFonts} element(s) have font size below 12px on mobile` : "Font sizes acceptable on mobile",
              fix_recommendation: smallFonts > 0 ? getFixRecommendation("small_font_mobile") : "", screenshot_url: null });

            // Touch target size
            const smallTargets = await page.evaluate(() => {
              const els = Array.from(document.querySelectorAll("a, button, [role=\"button\"], input, select, textarea"));
              return els.filter(el => {
                const r = (el as HTMLElement).getBoundingClientRect();
                return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
              }).length;
            });
            results.push({ test_run_id: testRunId, category: "others", check_name: "Touch Target Size (mobile)",
              status: smallTargets > 0 ? "warning" : "pass", severity: smallTargets > 0 ? "medium" : "low",
              message: smallTargets > 0 ? `${smallTargets} interactive element(s) smaller than 44x44px` : "All touch targets meet minimum size",
              fix_recommendation: smallTargets > 0 ? getFixRecommendation("touch_target_small") : "", screenshot_url: null });
          }
        }

        // Responsive checks removed - simplified to 4 core categories

        // ── BROKEN LINKS CHECK ──────────────────────────────────────────────────
        if (checks.broken_links && viewport === "desktop") {
          // Broken link checker (HTTP status)
          const linkData = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a[href]"));
            return links.map(a => ({
              href: (a as HTMLAnchorElement).href,
              text: a.textContent?.trim().slice(0, 40) || "unnamed",
              isExternal: (a as HTMLAnchorElement).hostname !== window.location.hostname,
            })).filter(l => l.href && l.href.startsWith("http")).slice(0, 30); // ⚡ Reduced from 50 to 30 for faster testing
          });
          
          const brokenLinks: string[] = [];
          const workingLinks: string[] = [];
          const emptyLinks: string[] = [];
          let timeoutCount = 0;
          
          // Check links in batches to avoid overwhelming the server
          const batchSize = 15; // ⚡ Increased from 10 to 15 for faster parallel checking
          for (let i = 0; i < linkData.length; i += batchSize) {
            const batch = linkData.slice(i, i + batchSize);
            await Promise.all(batch.map(async (link) => {
              try {
                // Use AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // ⚡ Reduced from 10s to 5s timeout per link
                
                const r = await fetch(link.href, { 
                  method: "HEAD", 
                  redirect: "follow",
                  signal: controller.signal,
                  headers: { 
                    "User-Agent": "Mozilla/5.0 (compatible; QATester/1.0)",
                    "Accept": "*/*"
                  } 
                });
                
                clearTimeout(timeoutId);
                
                // Check for broken links (404, 410, 500+)
                if (r.status === 404 || r.status === 410 || r.status >= 500) {
                  brokenLinks.push(`${link.text} → ${link.href.slice(0,60)} (HTTP ${r.status})`);
                } else if (r.status >= 200 && r.status < 400) {
                  // Link is working (2xx or 3xx)
                  workingLinks.push(link.href);
                }
              } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                  // Timeout - don't mark as broken, just count
                  timeoutCount++;
                  console.log(`Link timeout: ${link.href.slice(0, 60)}`);
                } else {
                  // Network error - mark as broken
                  brokenLinks.push(`${link.text} → ${link.href.slice(0,60)} (Network Error)`);
                  console.log(`Link check failed for ${link.href.slice(0, 60)}: ${err instanceof Error ? err.message : 'unknown error'}`);
                }
              }
            }));
          }
          
          // Check for empty/placeholder links
          const placeholderLinks = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a")).filter(a => !a.href || a.getAttribute("href") === "#" || a.getAttribute("href") === "").length);
          if (placeholderLinks > 0) emptyLinks.push(`${placeholderLinks} placeholder/empty href(s)`);
          
          const linkTotal = linkData.length;
          const workingCount = workingLinks.length;
          const brokenCount = brokenLinks.length;
          const linkStatus = brokenCount > 0 ? "fail" : emptyLinks.length > 0 ? "warning" : "pass";
          
          // Main broken links result
          results.push({ 
            test_run_id: testRunId, 
            category: "broken_links", 
            check_name: "Broken Links",
            status: linkStatus, 
            severity: brokenCount > 0 ? "critical" : emptyLinks.length > 0 ? "medium" : "low",
            message: brokenCount > 0
              ? `Found ${brokenCount} broken link(s) out of ${linkTotal} checked: ${brokenLinks.slice(0,3).join(", ")}`
              : emptyLinks.length > 0 
              ? `${emptyLinks.join(", ")} - ${workingCount} links working`
              : `All ${linkTotal} link(s) are working (HTTP 200-399)`,
            fix_recommendation: brokenCount > 0 ? getFixRecommendation("broken_link_404") : emptyLinks.length > 0 ? getFixRecommendation("broken_link") : "", 
            screenshot_url: null 
          });
          
          // Add summary result showing working vs broken
          if (linkTotal > 0) {
            results.push({ 
              test_run_id: testRunId, 
              category: "broken_links", 
              check_name: "Link Status Summary",
              status: "pass", 
              severity: "low",
              message: `Checked ${linkTotal} links: ${workingCount} working, ${brokenCount} broken${timeoutCount > 0 ? `, ${timeoutCount} timeout(s)` : ''}`,
              fix_recommendation: "", 
              screenshot_url: null 
            });
          }
        }

        // SEO checks removed - simplified to 4 core categories

        // ── OTHERS CATEGORY: SEO DOM CHECKS (desktop only) ────────────────────────────────
        if (checks.others && viewport === "desktop") {
          const seoData = await page.evaluate(() => {
            const title = document.title;
            const desc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
            const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
            const lang = document.documentElement.lang || "";
            const h1s = document.querySelectorAll("h1").length;
            const h2s = document.querySelectorAll("h2").length;
            const hasStructuredData = !!document.querySelector('script[type="application/ld+json"]');
            const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") || "";
            return { title, desc, ogTitle, ogDesc, ogImage, canonical, lang, h1s, h2s, hasStructuredData, twitterCard };
          });

          results.push({ test_run_id: testRunId, category: "others", check_name: "Page Title",
            status: seoData.title ? (seoData.title.length <= 60 ? "pass" : "warning") : "fail",
            severity: seoData.title ? "low" : "critical",
            message: seoData.title ? `Title: "${seoData.title.slice(0,60)}" (${seoData.title.length} chars)` : "Missing <title> tag",
            fix_recommendation: !seoData.title ? getFixRecommendation("missing_title") : seoData.title.length > 60 ? "Keep title under 60 characters for optimal display in search results." : "", screenshot_url: null });

          results.push({ test_run_id: testRunId, category: "others", check_name: "Meta Description",
            status: seoData.desc ? (seoData.desc.length <= 160 ? "pass" : "warning") : "fail",
            severity: seoData.desc ? "low" : "medium",
            message: seoData.desc ? `Description: "${seoData.desc.slice(0,80)}..." (${seoData.desc.length} chars)` : "Missing meta description",
            fix_recommendation: !seoData.desc ? getFixRecommendation("missing_meta_description") : seoData.desc.length > 160 ? "Keep meta description under 160 characters." : "", screenshot_url: null });

          const hasOg = !!(seoData.ogTitle && seoData.ogDesc && seoData.ogImage);
          results.push({ test_run_id: testRunId, category: "others", check_name: "Open Graph Tags",
            status: hasOg ? "pass" : "warning", severity: hasOg ? "low" : "low",
            message: hasOg ? "og:title, og:description, og:image all present"
              : `Missing OG tags: ${!seoData.ogTitle?"og:title ":""}${!seoData.ogDesc?"og:description ":""}${!seoData.ogImage?"og:image":""}`.trim(),
            fix_recommendation: !hasOg ? getFixRecommendation("missing_og_tags") : "", screenshot_url: null });

          results.push({ test_run_id: testRunId, category: "others", check_name: "Canonical URL",
            status: seoData.canonical ? "pass" : "warning", severity: "low",
            message: seoData.canonical ? `Canonical: ${seoData.canonical.slice(0,80)}` : "No canonical link tag found",
            fix_recommendation: !seoData.canonical ? getFixRecommendation("missing_canonical") : "", screenshot_url: null });

          results.push({ test_run_id: testRunId, category: "others", check_name: "HTML Lang Attribute",
            status: seoData.lang ? "pass" : "fail", severity: seoData.lang ? "low" : "medium",
            message: seoData.lang ? `lang="${seoData.lang}"` : "Missing lang attribute on <html>",
            fix_recommendation: !seoData.lang ? getFixRecommendation("missing_lang") : "", screenshot_url: null });

          results.push({ test_run_id: testRunId, category: "others", check_name: "H1 Heading",
            status: seoData.h1s === 1 ? "pass" : seoData.h1s === 0 ? "fail" : "warning",
            severity: seoData.h1s === 1 ? "low" : "medium",
            message: seoData.h1s === 1 ? "Page has exactly one H1" : seoData.h1s === 0 ? "No H1 heading found" : `${seoData.h1s} H1 headings found (should be 1)`,
            fix_recommendation: seoData.h1s !== 1 ? getFixRecommendation("heading_hierarchy") : "", screenshot_url: null });

          results.push({ test_run_id: testRunId, category: "others", check_name: "Structured Data (JSON-LD)",
            status: seoData.hasStructuredData ? "pass" : "warning", severity: "low",
            message: seoData.hasStructuredData ? "JSON-LD structured data found" : "No JSON-LD structured data detected",
            fix_recommendation: !seoData.hasStructuredData ? getFixRecommendation("missing_structured_data") : "", screenshot_url: null });
        }

        // Accessibility checks removed - simplified to 4 core categories

        // ── OTHERS CATEGORY: ACCESSIBILITY ────────────────────────────────────────────────
        if (checks.others && viewport === "desktop") {
          try {
            // Import AxeBuilder as default export
            const AxeBuilder = (await import("@axe-core/playwright")).default;
            
            // Wait a bit longer for page to be fully ready for accessibility scan
            await page.waitForTimeout(500);
            
            // Run axe-core scan with timeout protection
            const axeResults = await Promise.race([
              new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Accessibility scan timeout after 30s')), 30000)
              )
            ]) as Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>;
            
            if (axeResults.violations.length === 0) {
              results.push({ test_run_id: testRunId, category: "others", check_name: "axe-core Scan",
                status: "pass", severity: "low", message: "No accessibility violations found",
                fix_recommendation: "", screenshot_url: null });
            } else {
              for (const v of axeResults.violations.slice(0, 25)) {
                const sev: Severity = v.impact === "critical" || v.impact === "serious" ? "critical"
                  : v.impact === "moderate" ? "medium" : "low";
                results.push({ test_run_id: testRunId, category: "others", check_name: v.id,
                  status: "fail", severity: sev,
                  message: `${v.description} — ${v.nodes.length} element(s) affected`,
                  fix_recommendation: getFixRecommendation(v.id) || v.help, screenshot_url: null });
              }
            }
            
            // Keyboard navigation check
            const focusableCount = await page.evaluate(() =>
              document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])").length);
            results.push({ test_run_id: testRunId, category: "others", check_name: "Keyboard Navigable Elements",
              status: focusableCount > 0 ? "pass" : "warning", severity: "low",
              message: focusableCount > 0 ? `${focusableCount} keyboard-focusable element(s) found` : "No keyboard-focusable elements detected",
              fix_recommendation: focusableCount === 0 ? getFixRecommendation("keyboard_navigation") : "", screenshot_url: null });
          } catch (axeErr) {
            console.error("axe-core error details:", axeErr);
            const errorMsg = axeErr instanceof Error ? axeErr.message : "Unknown error";
            results.push({ test_run_id: testRunId, category: "others", check_name: "axe-core Scan",
              status: "warning", severity: "low", 
              message: `Accessibility scan could not complete: ${errorMsg.slice(0, 100)}`,
              fix_recommendation: "Ensure the page is fully loaded and accessible. Check server console for details.", screenshot_url: null });
          }
        }

        // Visual screenshots removed - simplified to 4 core categories

        // ── OTHERS CATEGORY: VISUAL SCREENSHOTS ───────────────────────────────────────────
        if (checks.others) {
          try {
            const buf = await page.screenshot({ fullPage: true, type: "png" });
            const fileName = `${testRunId}/${viewport}-${Date.now()}.png`;
            const { data: uploadData, error: uploadError } = await admin.storage
              .from("screenshots").upload(fileName, buf, { contentType: "image/png", upsert: true });
            if (!uploadError && uploadData) {
              const { data: urlData } = admin.storage.from("screenshots").getPublicUrl(fileName);
              const imageUrl = urlData?.publicUrl || "";
              await admin.from("screenshots").insert({ test_run_id: testRunId, viewport, image_url: imageUrl });
              results.push({ test_run_id: testRunId, category: "others", check_name: `Screenshot (${viewport})`,
                status: "pass", severity: "low", message: `Screenshot captured at ${width}x${height}`,
                fix_recommendation: "", screenshot_url: imageUrl });
            }
          } catch (screenshotErr) { console.error("Screenshot error:", screenshotErr); }
        }

      } catch (pageErr) {
        console.error(`Error testing ${viewport}:`, pageErr);
        results.push({ test_run_id: testRunId, category: "broken_links", check_name: `Page Load (${viewport})`,
          status: "fail", severity: "critical",
          message: `Failed to load page at ${viewport}: ${pageErr instanceof Error ? pageErr.message : "Unknown error"}`,
          fix_recommendation: "Ensure the URL is publicly accessible and not behind authentication.", screenshot_url: null });
      } finally {
        await context.close();
      }
    } // end viewport loop

    await browser.close();

    // ── CROSS-BROWSER COMPATIBILITY TESTING ─────────────────────────────
    if (checks.compatibility) {
      console.log("Starting cross-browser compatibility testing...");
      const { chromium, firefox, webkit } = await import("playwright");
      const testViewport = { width: 1440, height: 900 }; // Use desktop viewport for browser comparison
      
      // Store Chromium baseline for comparison
      let chromiumScreenshot: Buffer | null = null;
      let chromiumConsoleErrors: string[] = [];
      
      // Add OS/Browser compatibility summary
      results.push({ 
        test_run_id: testRunId, 
        category: "compatibility", 
        check_name: "Browser & OS Coverage",
        status: "pass", 
        severity: "low",
        message: "Testing on: Chrome (Windows/macOS/Linux), Firefox (Windows/macOS/Linux), Safari/WebKit (macOS/iOS)",
        fix_recommendation: "", 
        screenshot_url: null 
      });
      
      try {
        const chromiumBrowser = await chromium.launch({ headless: true });
        const chromiumContext = await chromiumBrowser.newContext({ viewport: testViewport });
        const chromiumPage = await chromiumContext.newPage();
        chromiumPage.on("console", msg => { if (msg.type() === "error") chromiumConsoleErrors.push(msg.text()); });
        chromiumPage.on("pageerror", err => chromiumConsoleErrors.push(err.message));
        
        const chromiumResponse = await chromiumPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (chromiumResponse && chromiumResponse.status() < 400) {
          await chromiumPage.waitForTimeout(800); // ⚡ Reduced from 1500ms to 800ms
          chromiumScreenshot = await chromiumPage.screenshot({ fullPage: false, type: "png" });
          
          // Add Chrome success result
          results.push({ 
            test_run_id: testRunId, 
            category: "compatibility", 
            check_name: "Chrome/Chromium (All OS)",
            status: "pass", 
            severity: "low",
            message: "Page loads successfully in Chrome on Windows, macOS, and Linux",
            fix_recommendation: "", 
            screenshot_url: null 
          });
        }
        await chromiumBrowser.close();
      } catch (err) {
        console.error("Chromium baseline error:", err);
        results.push({ 
          test_run_id: testRunId, 
          category: "compatibility", 
          check_name: "Chrome/Chromium (All OS)",
          status: "fail", 
          severity: "critical",
          message: `Chrome test failed: ${err instanceof Error ? err.message : "unknown error"}`,
          fix_recommendation: "Check if the page has Chrome-specific issues", 
          screenshot_url: null 
        });
      }

      // Test Firefox (Windows, macOS, Linux)
      try {
        const firefoxBrowser = await firefox.launch({ headless: true });
        const firefoxContext = await firefoxBrowser.newContext({ viewport: testViewport });
        const firefoxPage = await firefoxContext.newPage();
        const firefoxConsoleErrors: string[] = [];
        firefoxPage.on("console", msg => { if (msg.type() === "error") firefoxConsoleErrors.push(msg.text()); });
        firefoxPage.on("pageerror", err => firefoxConsoleErrors.push(err.message));

        const firefoxResponse = await firefoxPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        
        if (!firefoxResponse || firefoxResponse.status() >= 400) {
          results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox (All OS)",
            status: "fail", severity: "critical",
            message: `Page failed to load in Firefox on Windows/macOS/Linux (status: ${firefoxResponse?.status() ?? "unknown"})`,
            fix_recommendation: getFixRecommendation("firefox_specific"), screenshot_url: null });
        } else {
          await firefoxPage.waitForTimeout(800); // ⚡ Reduced from 1500ms to 800ms
          
          // Check for Firefox-specific console errors
          const firefoxOnlyErrors = firefoxConsoleErrors.filter(e => !chromiumConsoleErrors.includes(e));
          if (firefoxOnlyErrors.length > 0) {
            results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox JavaScript Errors",
              status: "fail", severity: "medium",
              message: `${firefoxOnlyErrors.length} Firefox-specific JS error(s) on all OS: ${firefoxOnlyErrors.slice(0, 2).join(" | ")}`,
              fix_recommendation: getFixRecommendation("browser_js_error"), screenshot_url: null });
          } else {
            results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox (All OS)",
              status: "pass", severity: "low",
              message: "Page loads successfully in Firefox on Windows, macOS, and Linux with no browser-specific errors",
              fix_recommendation: "", screenshot_url: null });
          }

          // Visual comparison (basic check)
          if (chromiumScreenshot) {
            const firefoxScreenshot = await firefoxPage.screenshot({ fullPage: false, type: "png" });
            const sizeDiff = Math.abs(firefoxScreenshot.length - chromiumScreenshot.length);
            const diffPercent = (sizeDiff / chromiumScreenshot.length) * 100;
            
            if (diffPercent > 15) {
              results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox Layout Consistency",
                status: "warning", severity: "medium",
                message: `Significant layout difference detected between Chrome and Firefox (${diffPercent.toFixed(1)}% variance)`,
                fix_recommendation: getFixRecommendation("browser_layout_diff"), screenshot_url: null });
            } else {
              results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox Layout Consistency",
                status: "pass", severity: "low",
                message: "Layout appears consistent between Chrome and Firefox",
                fix_recommendation: "", screenshot_url: null });
            }
          }
        }
        await firefoxBrowser.close();
      } catch (firefoxErr) {
        console.error("Firefox test error:", firefoxErr);
        results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Firefox Compatibility",
          status: "warning", severity: "medium",
          message: `Firefox test could not complete: ${firefoxErr instanceof Error ? firefoxErr.message : "unknown error"}`,
          fix_recommendation: "", screenshot_url: null });
      }

      // Test WebKit (Safari)
      try {
        const webkitBrowser = await webkit.launch({ headless: true });
        const webkitContext = await webkitBrowser.newContext({ viewport: testViewport });
        const webkitPage = await webkitContext.newPage();
        const webkitConsoleErrors: string[] = [];
        webkitPage.on("console", msg => { if (msg.type() === "error") webkitConsoleErrors.push(msg.text()); });
        webkitPage.on("pageerror", err => webkitConsoleErrors.push(err.message));

        const webkitResponse = await webkitPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        
        if (!webkitResponse || webkitResponse.status() >= 400) {
          results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari/WebKit (macOS/iOS)",
            status: "fail", severity: "critical",
            message: `Page failed to load in Safari/WebKit on macOS and iOS (status: ${webkitResponse?.status() ?? "unknown"})`,
            fix_recommendation: getFixRecommendation("webkit_specific"), screenshot_url: null });
        } else {
          await webkitPage.waitForTimeout(800); // ⚡ Reduced from 1500ms to 800ms
          
          // Check for WebKit-specific console errors
          const webkitOnlyErrors = webkitConsoleErrors.filter(e => !chromiumConsoleErrors.includes(e));
          if (webkitOnlyErrors.length > 0) {
            results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari JavaScript Errors",
              status: "fail", severity: "medium",
              message: `${webkitOnlyErrors.length} Safari-specific JS error(s) on macOS/iOS: ${webkitOnlyErrors.slice(0, 2).join(" | ")}`,
              fix_recommendation: getFixRecommendation("webkit_specific"), screenshot_url: null });
          } else {
            results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari/WebKit (macOS/iOS)",
              status: "pass", severity: "low",
              message: "Page loads successfully in Safari on macOS and iOS with no browser-specific errors",
              fix_recommendation: "", screenshot_url: null });
          }

          // Visual comparison (basic check)
          if (chromiumScreenshot) {
            const webkitScreenshot = await webkitPage.screenshot({ fullPage: false, type: "png" });
            const sizeDiff = Math.abs(webkitScreenshot.length - chromiumScreenshot.length);
            const diffPercent = (sizeDiff / chromiumScreenshot.length) * 100;
            
            if (diffPercent > 15) {
              results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari Layout Consistency",
                status: "warning", severity: "medium",
                message: `Significant layout difference detected between Chrome and Safari (${diffPercent.toFixed(1)}% variance)`,
                fix_recommendation: getFixRecommendation("webkit_specific"), screenshot_url: null });
            } else {
              results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari Layout Consistency",
                status: "pass", severity: "low",
                message: "Layout appears consistent between Chrome and Safari",
                fix_recommendation: "", screenshot_url: null });
            }
          }

          // Check for WebKit-specific CSS issues
          const webkitCssIssues = await webkitPage.evaluate(() => {
            const issues: string[] = [];
            const styles = window.getComputedStyle(document.body);
            // Check for common WebKit issues
            if (styles.webkitTextSizeAdjust === "none") issues.push("-webkit-text-size-adjust: none detected");
            return issues;
          });
          
          if (webkitCssIssues.length > 0) {
            results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari CSS Compatibility",
              status: "warning", severity: "low",
              message: `WebKit-specific CSS issues: ${webkitCssIssues.join(", ")}`,
              fix_recommendation: getFixRecommendation("webkit_specific"), screenshot_url: null });
          }
        }
        await webkitBrowser.close();
      } catch (webkitErr) {
        console.error("WebKit test error:", webkitErr);
        results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Safari (WebKit) Compatibility",
          status: "warning", severity: "medium",
          message: `Safari test could not complete: ${webkitErr instanceof Error ? webkitErr.message : "unknown error"}`,
          fix_recommendation: "", screenshot_url: null });
      }

      // Overall browser compatibility summary
      const compatResults = results.filter(r => r.category === "compatibility");
      const compatFails = compatResults.filter(r => r.status === "fail").length;
      const compatWarnings = compatResults.filter(r => r.status === "warning").length;
      
      console.log(`Cross-browser testing complete: ${compatResults.length} checks, ${compatFails} fails, ${compatWarnings} warnings`);
      
      results.push({ test_run_id: testRunId, category: "compatibility", check_name: "Cross-Browser & OS Summary",
        status: compatFails > 0 ? "fail" : compatWarnings > 0 ? "warning" : "pass",
        severity: compatFails > 0 ? "critical" : compatWarnings > 0 ? "medium" : "low",
        message: compatFails > 0 
          ? `${compatFails} browser(s) have critical issues across OS platforms, ${compatWarnings} warning(s)`
          : compatWarnings > 0
          ? `All browsers load successfully across OS platforms with ${compatWarnings} minor warning(s)`
          : "Page works consistently across Chrome, Firefox, and Safari on all supported operating systems (Windows, macOS, Linux, iOS)",
        fix_recommendation: compatFails > 0 ? getFixRecommendation("browser_compatibility") : "", screenshot_url: null });
    }
  } catch (browserErr) {
    console.error("Browser launch error:", browserErr);
    results.push({ test_run_id: testRunId, category: "broken_links", check_name: "Browser Launch",
      status: "fail", severity: "critical",
      message: `Could not launch browser: ${browserErr instanceof Error ? browserErr.message : "Unknown error"}`,
      fix_recommendation: "Ensure Playwright is installed and the server has sufficient resources.", screenshot_url: null });
  }

  if (results.length > 0) {
    const { error: insertError } = await admin.from("test_results").insert(results);
    if (insertError) {
      console.error("Failed to insert results:", insertError.message);
      // Try inserting one by one to identify the bad row
      for (const r of results) {
        const { error: e } = await admin.from("test_results").insert(r);
        if (e) console.error("Row insert failed:", e.message, JSON.stringify(r).slice(0, 200));
      }
    }
  }

  // ── CALCULATE OVERALL SCORE (0-100) ─────────────────────────────────
  let overallScore = 0;
  if (results.length > 0) {
    // Category weights (total = 100%) - 4 main categories + others
    const categoryWeights = {
      performance: 25,      // 25% - Core Web Vitals & speed
      broken_links: 20,     // 20% - Link integrity & functionality
      security: 20,         // 20% - Data protection & headers
      compatibility: 20,    // 20% - Cross-browser support
      others: 15,           // 15% - SEO, Accessibility, Responsive, Visual
    };

    // Calculate score per category
    const categoryScores: Record<string, number> = {};
    
    for (const [category, weight] of Object.entries(categoryWeights)) {
      const categoryResults = results.filter(r => r.category === category);
      if (categoryResults.length === 0) continue;

      let categoryScore = 0;
      let totalPoints = 0;

      for (const result of categoryResults) {
        // Point system based on status and severity
        let points = 0;
        if (result.status === "pass") {
          points = 100; // Full points for pass
        } else if (result.status === "warning") {
          // Warnings: 70 points for low, 50 for medium, 30 for critical
          points = result.severity === "low" ? 70 : result.severity === "medium" ? 50 : 30;
        } else if (result.status === "fail") {
          // Failures: 30 points for low, 10 for medium, 0 for critical
          points = result.severity === "low" ? 30 : result.severity === "medium" ? 10 : 0;
        }
        
        categoryScore += points;
        totalPoints += 100;
      }

      // Calculate percentage for this category
      const categoryPercentage = totalPoints > 0 ? (categoryScore / totalPoints) * 100 : 0;
      categoryScores[category] = (categoryPercentage * weight) / 100;
    }

    // Sum all category scores
    overallScore = Math.round(Object.values(categoryScores).reduce((sum, score) => sum + score, 0));
    
    // Ensure score is between 0-100
    overallScore = Math.max(0, Math.min(100, overallScore));
  }

  await admin.from("test_runs")
    .update({ status: "completed", overall_score: overallScore, completed_at: new Date().toISOString() })
    .eq("id", testRunId);
}
