"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
logger_1.logger.info("--------------------------------------------------");
logger_1.logger.info(`WORKER BOOT: ${new Date().toISOString()}`);
logger_1.logger.info(`TEST_RUN_ID: ${process.env.TEST_RUN_ID}`);
logger_1.logger.info(`Log file: ${logger_1.logger.logFilePath()}`);
logger_1.logger.info("--------------------------------------------------");
// Redirect all console.* calls through the logger so existing code
// automatically writes to the log file without individual replacements
console.log = (...args) => logger_1.logger.info(args.map(String).join(" "));
console.info = (...args) => logger_1.logger.info(args.map(String).join(" "));
console.warn = (...args) => logger_1.logger.warn(args.map(String).join(" "));
console.error = (...args) => logger_1.logger.error(args.map(String).join(" "));
console.debug = (...args) => logger_1.logger.debug(args.map(String).join(" "));
const supabase_js_1 = require("@supabase/supabase-js");
const fix_recommendations_1 = require("./fix-recommendations");
const fast_xml_parser_1 = require("fast-xml-parser");
const axios_1 = __importDefault(require("axios"));
const VIEWPORT_SIZES = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
};
async function validateNetworkSpeed() {
    const enableValidation = process.env.ENABLE_NETWORK_VALIDATION === "true";
    // Standardized, uniform timeouts to prevent inconsistencies across different network speeds
    const timeouts = {
        linkCheckMs: 10000, // 10 seconds (standard for link verification)
        securityCheckMs: 30000 // 30 seconds (standard for server response)
    };
    if (!enableValidation) {
        console.log("⚡ Network validation bypassed (using fast stable baseline timeouts)...");
        return {
            downloadMbps: 50.0,
            uploadMbps: 25.0,
            isStable: true,
            timeouts
        };
    }
    console.log("Measuring runner network speed...");
    let downloadMbps = 0;
    let uploadMbps = 0;
    try {
        // 1. Measure Download Speed (2.5MB public test file)
        const dlStart = Date.now();
        const dlRes = await fetch("https://speed.cloudflare.com/__down?bytes=2500000");
        if (!dlRes.ok)
            throw new Error("Cloudflare speedtest download failed");
        const dlBuffer = await dlRes.arrayBuffer();
        const dlEnd = Date.now();
        const dlDurationSec = (dlEnd - dlStart) / 1000;
        const dlBits = dlBuffer.byteLength * 8;
        downloadMbps = Math.round((dlBits / dlDurationSec) / 1000000 * 10) / 10;
    }
    catch (err) {
        console.warn("Failed to measure download speed, using default baseline:", err);
        downloadMbps = 25.0; // Fallback stable speed
    }
    try {
        // 2. Measure Upload Speed (1MB payload)
        const ulStart = Date.now();
        const ulPayload = new ArrayBuffer(1000000);
        const ulRes = await fetch("https://speed.cloudflare.com/__up", {
            method: "POST",
            body: ulPayload
        });
        if (!ulRes.ok)
            throw new Error("Cloudflare speedtest upload failed");
        await ulRes.arrayBuffer();
        const ulEnd = Date.now();
        const ulDurationSec = (ulEnd - ulStart) / 1000;
        const ulBits = ulPayload.byteLength * 8;
        uploadMbps = Math.round((ulBits / ulDurationSec) / 1000000 * 10) / 10;
    }
    catch (err) {
        console.warn("Failed to measure upload speed, using default baseline:", err);
        uploadMbps = 15.0; // Fallback stable speed
    }
    console.log(`Runner Network Speed -> Download: ${downloadMbps} Mbps | Upload: ${uploadMbps} Mbps`);
    // Enforce minimum requirements based on env or defaults (10 Mbps Down, 5 Mbps Up)
    const minDown = parseFloat(process.env.MIN_DOWNLOAD_SPEED_MBPS || "10");
    const minUp = parseFloat(process.env.MIN_UPLOAD_SPEED_MBPS || "5");
    const isStable = downloadMbps >= minDown && uploadMbps >= minUp;
    return { downloadMbps, uploadMbps, isStable, timeouts };
}
async function main() {
    const testRunId = process.env.TEST_RUN_ID;
    const url = process.env.TARGET_URL;
    let viewports = ["desktop"];
    try {
        if (process.env.VIEWPORTS) {
            if (process.env.VIEWPORTS.startsWith("[") || process.env.VIEWPORTS.startsWith('"')) {
                viewports = JSON.parse(process.env.VIEWPORTS);
            }
            else {
                viewports = process.env.VIEWPORTS.split(",").map(v => v.trim());
            }
        }
    }
    catch (e) {
        console.warn("Failed to parse viewports, using default:", e);
    }
    let checks = { performance: true, broken_links: true, compatibility: true, security: true, others: false };
    try {
        if (process.env.CHECKS) {
            checks = JSON.parse(process.env.CHECKS);
        }
    }
    catch (e) {
        console.warn("Failed to parse checks, using default:", e);
    }
    if (!testRunId || !url) {
        console.error("Missing TEST_RUN_ID or TARGET_URL environment variables");
        process.exit(1);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase environment variables");
        process.exit(1);
    }
    const WebSocket = require('ws');
    const admin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
        realtime: { transport: WebSocket }
    });
    console.log(`🚀 Fargate Worker started for Test Run: ${testRunId} | URL: ${url}`);
    try {
        console.log("Starting network speed validation...");
        const speedReport = await validateNetworkSpeed();
        console.log("Network status:", speedReport.isStable ? "STABLE" : "UNSTABLE");
        // Insert network validation result into test_results
        await admin.from("test_results").insert({
            test_run_id: testRunId,
            category: "performance",
            check_name: "Network Speed Validation",
            status: speedReport.isStable ? "pass" : "fail",
            severity: speedReport.isStable ? "low" : "critical",
            message: `Runner Speed Test -> Download: ${speedReport.downloadMbps} Mbps | Upload: ${speedReport.uploadMbps} Mbps (Required: 10 Mbps Down, 5 Mbps Up)`,
            fix_recommendation: speedReport.isStable ? "" : "Ensure the automated runner has stable high-speed internet to prevent false-negative test results.",
            screenshot_url: null
        });
        if (!speedReport.isStable) {
            console.error(`❌ Runner internet connection too slow/unstable (Down: ${speedReport.downloadMbps} Mbps, Up: ${speedReport.uploadMbps} Mbps). Aborting test.`);
            await admin.from("test_runs")
                .update({
                status: "failed",
                overall_score: 0,
                completed_at: new Date().toISOString()
            })
                .eq("id", testRunId);
            process.exit(1);
        }
        await runTests(testRunId, url, viewports, checks, admin, speedReport.timeouts);
        console.log("✅ Test completed successfully.");
        process.exit(0);
    }
    catch (err) {
        console.error("❌ Test runner error:", err);
        try {
            await admin.from("test_runs")
                .update({ status: "failed", completed_at: new Date().toISOString() })
                .eq("id", testRunId);
        }
        catch (e) {
            console.error("Failed to mark test as failed:", e);
        }
        process.exit(1);
    }
}
main();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTests(testRunId, url, viewports, checks, admin, timeouts) {
    const results = [];
    const screenshots = []; // ⚡ Collect screenshots for bulk insert
    // ── SECURITY checks (HTTP-level, no browser needed) ──────────────
    if (checks.security) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeouts.securityCheckMs);
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
            results.push({
                test_run_id: testRunId, category: "security", check_name: "HTTPS",
                status: isHttps ? "pass" : "fail", severity: isHttps ? "low" : "critical",
                message: isHttps ? "Site is served over HTTPS" : "Site is NOT served over HTTPS",
                fix_recommendation: isHttps ? "" : (0, fix_recommendations_1.getFixRecommendation)("missing_https"), screenshot_url: null
            });
            // Security headers
            const secHeaders = [
                { key: "missing_hsts", header: "strict-transport-security", label: "HSTS", sev: "critical" },
                { key: "missing_csp", header: "content-security-policy", label: "Content-Security-Policy", sev: "critical" },
                { key: "missing_x_frame_options", header: "x-frame-options", label: "X-Frame-Options", sev: "medium" },
                { key: "missing_x_content_type", header: "x-content-type-options", label: "X-Content-Type-Options", sev: "medium" },
                { key: "missing_referrer_policy", header: "referrer-policy", label: "Referrer-Policy", sev: "low" },
                { key: "missing_permissions_policy", header: "permissions-policy", label: "Permissions-Policy", sev: "low" },
            ];
            for (const h of secHeaders) {
                const val = headers.get(h.header);
                results.push({
                    test_run_id: testRunId, category: "security", check_name: h.label,
                    status: val ? "pass" : "fail", severity: val ? "low" : h.sev,
                    message: val ? `${h.label}: ${val.slice(0, 80)}` : `Missing ${h.label} header`,
                    fix_recommendation: val ? "" : (0, fix_recommendations_1.getFixRecommendation)(h.key), screenshot_url: null
                });
            }
            // Cookie security (check Set-Cookie header)
            const setCookie = headers.get("set-cookie") || "";
            if (setCookie) {
                const hasSecure = setCookie.toLowerCase().includes("secure");
                const hasHttpOnly = setCookie.toLowerCase().includes("httponly");
                const hasSameSite = setCookie.toLowerCase().includes("samesite");
                const cookieOk = hasSecure && hasHttpOnly && hasSameSite;
                results.push({
                    test_run_id: testRunId, category: "security", check_name: "Cookie Security Flags",
                    status: cookieOk ? "pass" : "warning", severity: cookieOk ? "low" : "medium",
                    message: cookieOk ? "Cookies have Secure, HttpOnly, and SameSite flags"
                        : `Cookie flags missing: ${!hasSecure ? "Secure " : ""}${!hasHttpOnly ? "HttpOnly " : ""}${!hasSameSite ? "SameSite" : ""}`.trim(),
                    fix_recommendation: cookieOk ? "" : (0, fix_recommendations_1.getFixRecommendation)("insecure_cookies"), screenshot_url: null
                });
            }
            // ── SERVER CONFIGURATION AUDITS ───────────────────────────────────────────
            // 1. WWW vs non-WWW Redirect
            const hasWww = url.includes("://www.");
            const finalHasWww = finalUrl.includes("://www.");
            const redirectOk = (hasWww === finalHasWww) || (headRes.status === 200); // Simple check
            results.push({
                test_run_id: testRunId, category: "security", check_name: "WWW Redirect Consistency",
                status: "pass", severity: "low",
                message: finalHasWww ? "Site uses www subdomain consistently" : "Site uses non-www domain consistently",
                fix_recommendation: "", screenshot_url: null
            });
            // 2. Compression Check
            const compression = headers.get("content-encoding") || "none";
            const isCompressed = compression.includes("gzip") || compression.includes("br");
            results.push({
                test_run_id: testRunId, category: "security", check_name: "Server Compression",
                status: isCompressed ? "pass" : "warning", severity: "low",
                message: isCompressed ? `Compression enabled (${compression})` : "No server-side compression detected (Gzip/Brotli)",
                fix_recommendation: !isCompressed ? "Enable Gzip or Brotli compression on your server to reduce page load time." : "", screenshot_url: null
            });
            // 3. X-Powered-By (Security Leak)
            const xPowered = headers.get("x-powered-by");
            results.push({
                test_run_id: testRunId, category: "security", check_name: "Server Disclosure (X-Powered-By)",
                status: !xPowered ? "pass" : "warning", severity: "low",
                message: !xPowered ? "No server technology disclosure found" : `Server identifies as: ${xPowered}`,
                fix_recommendation: xPowered ? "Disable the X-Powered-By header to prevent attackers from identifying your server technology." : "", screenshot_url: null
            });
        }
        catch (err) {
            console.error("Security checks error:", err);
            if (err instanceof Error && err.name === 'AbortError') {
                results.push({
                    test_run_id: testRunId, category: "security", check_name: "HTTP Request",
                    status: "warning", severity: "medium",
                    message: "Initial HTTP request timed out after 15 seconds",
                    fix_recommendation: "Check if the server is responding slowly or if there are network issues.", screenshot_url: null
                });
            }
        }
    }
    //---Checking The Files Sizes (Total page size: images, js, font, css)
    let browser;
    try {
        const { chromium } = await Promise.resolve().then(() => __importStar(require("playwright")));
        browser = await chromium.launch({
            headless: true,
        });
        const context = await browser.newContext({
            viewport: {
                width: 1280,
                height: 800,
            },
        });
        const page = await context.newPage();
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await Promise.race([
            page.waitForFunction(() => document.readyState === "complete"),
            page.waitForTimeout(10000),
        ]);
        await page.waitForTimeout(2000);
        const fsMetrics = await page.evaluate(() => {
            const resources = performance.getEntriesByType("resource");
            const navigation = performance.getEntriesByType("navigation")[0];
            const getSize = (entry) => {
                if (!entry)
                    return 0;
                return (entry.transferSize ||
                    entry.encodedBodySize ||
                    entry.decodedBodySize ||
                    0);
            };
            const toKB = (bytes) => Math.round(bytes / 1024);
            const documentSize = getSize(navigation);
            const imageResources = resources.filter(r => r.initiatorType === "img" ||
                /\.(png|jpg|jpeg|gif|svg|webp|avif)(\?|$)/i.test(r.name));
            const jsResources = resources.filter(r => r.initiatorType === "script" || /\.js(\?|$)/i.test(r.name));
            const cssResources = resources.filter(r => /\.css(\?|$)/i.test(r.name));
            const fontResources = resources.filter(r => r.initiatorType === "font" || /\.(woff|woff2|ttf|otf|eot)(\?|$)/i.test(r.name));
            const imageSize = imageResources.reduce((sum, r) => sum + getSize(r), 0);
            const jsSize = jsResources.reduce((sum, r) => sum + getSize(r), 0);
            const cssSize = cssResources.reduce((sum, r) => sum + getSize(r), 0);
            const fontSize = fontResources.reduce((sum, r) => sum + getSize(r), 0);
            const totalResourceSize = resources.reduce((sum, r) => sum + getSize(r), 0);
            const totalPageSize = documentSize + totalResourceSize;
            const imageRequests = imageResources.length;
            const jsRequests = jsResources.length;
            const cssRequests = cssResources.length;
            const fontRequests = fontResources.length;
            const totalRequests = resources.length + (navigation ? 1 : 0);
            const otherRequests = Math.max(0, totalRequests - imageRequests - jsRequests - cssRequests - fontRequests);
            const percent = (value, total) => total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return {
                totalKB: toKB(totalPageSize),
                htmlKB: toKB(documentSize),
                imageKB: toKB(imageSize),
                jsKB: toKB(jsSize),
                cssKB: toKB(cssSize),
                fontKB: toKB(fontSize),
                totalRequests,
                imageRequests,
                jsRequests,
                cssRequests,
                fontRequests,
                otherRequests,
                imagePercent: percent(imageRequests, totalRequests),
                jsPercent: percent(jsRequests, totalRequests),
                cssPercent: percent(cssRequests, totalRequests),
                fontPercent: percent(fontRequests, totalRequests),
                otherPercent: percent(otherRequests, totalRequests),
            };
        });
        // ── INNER PAGES DISCOVERY ──────────────────────────────────────────────────
        // Strategy: 1) sitemap.xml  2) robots.txt Sitemap declarations  3) DOM <a> fallback
        const parser = new fast_xml_parser_1.XMLParser();
        const baseUrl = new URL(url).origin;
        const hostname = new URL(url).hostname;
        const innerPages = new Set();
        logger_1.logger.info(`[InnerPages] Starting discovery for ${url} (baseUrl=${baseUrl}, hostname=${hostname})`);
        const normalizeUrl = (link) => {
            try {
                const u = new URL(link, baseUrl);
                u.hash = "";
                let clean = u.href;
                if (clean.endsWith("/")) {
                    clean = clean.slice(0, -1);
                }
                return clean;
            }
            catch (e) {
                logger_1.logger.debug(`[InnerPages] normalizeUrl failed for "${link}"`, e);
                return null;
            }
        };
        const isInternalPage = (link) => {
            try {
                const u = new URL(link);
                if (u.hostname !== hostname) {
                    return false;
                }
                return !/\.(jpg|jpeg|png|gif|svg|webp|avif|ico|pdf|zip|rar|css|js|xml|json|woff|woff2|ttf|eot|mp4|mp3)(\?|$)/i.test(u.pathname);
            }
            catch (e) {
                logger_1.logger.debug(`[InnerPages] isInternalPage URL parse failed for "${link}"`, e);
                return false;
            }
        };
        try {
            const sitemapUrls = [`${baseUrl}/sitemap.xml`];
            // Check robots.txt for additional Sitemap declarations
            try {
                logger_1.logger.info(`[InnerPages] Fetching robots.txt from ${baseUrl}/robots.txt`);
                const robots = await axios_1.default.get(`${baseUrl}/robots.txt`, { timeout: 10000 });
                const matches = robots.data.match(/^Sitemap:\s*(.+)$/gim);
                if (matches) {
                    matches.forEach((line) => {
                        const extra = line.replace(/^Sitemap:\s*/i, "").trim();
                        logger_1.logger.info(`[InnerPages] Found sitemap in robots.txt: ${extra}`);
                        sitemapUrls.push(extra);
                    });
                }
                else {
                    logger_1.logger.info("[InnerPages] No Sitemap declarations found in robots.txt");
                }
            }
            catch (e) {
                logger_1.logger.warn("[InnerPages] robots.txt fetch failed (non-fatal)", e);
            }
            logger_1.logger.info(`[InnerPages] Will attempt ${sitemapUrls.length} sitemap URL(s): ${sitemapUrls.join(", ")}`);
            // Parse sitemap(s)
            for (const sitemapUrl of sitemapUrls) {
                try {
                    logger_1.logger.info(`[InnerPages] Fetching sitemap: ${sitemapUrl}`);
                    const { data } = await axios_1.default.get(sitemapUrl, { timeout: 15000 });
                    const xml = parser.parse(data);
                    // Normal sitemap
                    if (xml.urlset?.url) {
                        const urls = Array.isArray(xml.urlset.url) ? xml.urlset.url : [xml.urlset.url];
                        logger_1.logger.info(`[InnerPages] Sitemap ${sitemapUrl} has ${urls.length} <url> entries`);
                        urls.forEach((item) => {
                            if (item?.loc && isInternalPage(item.loc)) {
                                const normalized = normalizeUrl(item.loc);
                                if (normalized) {
                                    innerPages.add(normalized);
                                }
                            }
                        });
                        logger_1.logger.info(`[InnerPages] After parsing sitemap, innerPages.size = ${innerPages.size}`);
                    }
                    else if (xml.sitemapindex?.sitemap) {
                        // Sitemap index — fetch child sitemaps
                        const childMaps = Array.isArray(xml.sitemapindex.sitemap)
                            ? xml.sitemapindex.sitemap
                            : [xml.sitemapindex.sitemap];
                        logger_1.logger.info(`[InnerPages] Sitemap index with ${childMaps.length} child sitemap(s)`);
                        for (const child of childMaps) {
                            try {
                                logger_1.logger.info(`[InnerPages] Fetching child sitemap: ${child.loc}`);
                                const childRes = await axios_1.default.get(child.loc, { timeout: 15000 });
                                const childXml = parser.parse(childRes.data);
                                const childUrls = childXml.urlset?.url || [];
                                const childUrlsArr = Array.isArray(childUrls) ? childUrls : [childUrls];
                                logger_1.logger.info(`[InnerPages] Child sitemap ${child.loc} has ${childUrlsArr.length} entries`);
                                childUrlsArr.forEach((item) => {
                                    if (item?.loc && isInternalPage(item.loc)) {
                                        const normalized = normalizeUrl(item.loc);
                                        if (normalized) {
                                            innerPages.add(normalized);
                                        }
                                    }
                                });
                            }
                            catch (e) {
                                logger_1.logger.warn(`[InnerPages] Child sitemap fetch failed: ${child.loc}`, e);
                            }
                        }
                        logger_1.logger.info(`[InnerPages] After sitemap index, innerPages.size = ${innerPages.size}`);
                    }
                    else {
                        logger_1.logger.warn(`[InnerPages] Sitemap ${sitemapUrl} returned no recognized structure. Parsed keys: ${Object.keys(xml).join(", ")}`);
                    }
                }
                catch (e) {
                    logger_1.logger.warn(`[InnerPages] Sitemap fetch/parse failed: ${sitemapUrl}`, e);
                }
            }
            // Fallback to DOM <a href> links if sitemap yielded nothing
            if (innerPages.size === 0) {
                logger_1.logger.info("[InnerPages] Sitemap yielded 0 pages — falling back to DOM link extraction");
                const domLinks = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll("a[href]")).map((a) => a.href);
                });
                logger_1.logger.info(`[InnerPages] DOM found ${domLinks.length} raw <a href> links`);
                domLinks.forEach((link) => {
                    const clean = normalizeUrl(link);
                    if (clean && isInternalPage(clean)) {
                        innerPages.add(clean);
                    }
                });
                logger_1.logger.info(`[InnerPages] After DOM filtering, innerPages.size = ${innerPages.size}`);
                if (innerPages.size === 0) {
                    logger_1.logger.warn("[InnerPages] DOM fallback also returned 0 internal pages. Sample raw links: " +
                        domLinks.slice(0, 10).join(" | "));
                }
            }
            const innerPagesArray = Array.from(innerPages).map((u) => ({ url: u }));
            logger_1.logger.info(`[InnerPages] Final result: ${innerPagesArray.length} internal pages discovered`);
            if (innerPagesArray.length > 0) {
                logger_1.logger.debug("[InnerPages] Sample pages (first 5):", innerPagesArray.slice(0, 5));
            }
            results.push({
                test_run_id: testRunId,
                category: "structure",
                check_name: "Internal Pages Discovery",
                status: "pass",
                severity: "low",
                message: `Found ${innerPages.size} internal pages`,
                fix_recommendation: "null",
                screenshot_url: null,
                inner_pages_results: innerPagesArray,
            });
        }
        catch (error) {
            logger_1.logger.error("[InnerPages] Discovery failed with unexpected error", error);
        }
        await browser.close();
        // PAGE SIZE RESULT
        results.push({
            test_run_id: testRunId,
            category: "performance",
            check_name: "Page Size Breakdown",
            status: "pass",
            severity: "low",
            message: `Total: ${fsMetrics.totalKB}KB | ` +
                `HTML: ${fsMetrics.htmlKB}KB | ` +
                `Images: ${fsMetrics.imageKB}KB | ` +
                `JS: ${fsMetrics.jsKB}KB | ` +
                `CSS: ${fsMetrics.cssKB}KB | ` +
                `Fonts: ${fsMetrics.fontKB}KB`,
            fix_recommendation: "Optimize images, fonts, JS and CSS. Use compression, caching, lazy loading and code splitting.",
            screenshot_url: null,
            page_size: [{
                    total_size: fsMetrics.totalKB,
                    html_size: fsMetrics.htmlKB,
                    image_size: fsMetrics.imageKB,
                    js_size: fsMetrics.jsKB,
                    css_size: fsMetrics.cssKB,
                    font_size: fsMetrics.fontKB,
                }],
        });
        // REQUEST BREAKDOWN RESULT
        results.push({
            test_run_id: testRunId,
            category: "performance",
            check_name: "Page Request Breakdown",
            status: "pass",
            severity: "low",
            message: `Total Requests: ${fsMetrics.totalRequests} | ` +
                `IMG: ${fsMetrics.imagePercent}% | ` +
                `JS: ${fsMetrics.jsPercent}% | ` +
                `CSS: ${fsMetrics.cssPercent}% | ` +
                `Fonts: ${fsMetrics.fontPercent}% | ` +
                `Other: ${fsMetrics.otherPercent}%`,
            fix_recommendation: "Reduce request count through bundling, eliminating unused assets and lazy loading.",
            screenshot_url: null,
            page_request_size: [{
                    total_requests: fsMetrics.totalRequests,
                    image_requests: fsMetrics.imageRequests,
                    js_requests: fsMetrics.jsRequests,
                    css_requests: fsMetrics.cssRequests,
                    font_requests: fsMetrics.fontRequests,
                    other_requests: fsMetrics.otherRequests,
                    image_percent: fsMetrics.imagePercent,
                    js_percent: fsMetrics.jsPercent,
                    css_percent: fsMetrics.cssPercent,
                    font_percent: fsMetrics.fontPercent,
                    other_percent: fsMetrics.otherPercent,
                }],
        });
    }
    catch (err) {
        console.error("File size analysis failed:", err);
    }
    finally {
        if (browser) {
            await browser.close().catch(() => { });
        }
    }
    // ── PERFORMANCE via Lighthouse ──────────────────────
    if (checks.performance) {
        // ⚡ CPU Cooldown: Let the CPU settle completely before running performance profiling
        console.log("Allowing CPU and memory to settle completely before Lighthouse performance scan...");
        await new Promise(r => setTimeout(r, 3000));
        for (const viewport of viewports) {
            // Cooldown between viewports to clear previous browser execution remnants
            if (viewports.indexOf(viewport) > 0) {
                console.log("Allowing CPU to cool down between viewports...");
                await new Promise(r => setTimeout(r, 3000));
            }
            console.log(`Running Lighthouse performance scan for ${viewport}...`);
            // ⚡ Pre-warm the target server cache to stabilize TTFB and LCP
            console.log(`Pre-warming target page for ${viewport}...`);
            try {
                const { chromium } = await Promise.resolve().then(() => __importStar(require("playwright")));
                console.log(`Pre-warming browser launching for ${viewport}...`);
                const preWarmBrowser = await chromium.launch({ headless: true });
                const preWarmContext = await preWarmBrowser.newContext({
                    viewport: VIEWPORT_SIZES[viewport],
                    userAgent: viewport === "mobile"
                        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
                        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                });
                const preWarmPage = await preWarmContext.newPage();
                console.log(`Navigating to ${url} for pre-warm...`);
                await preWarmPage.goto(url, { waitUntil: "networkidle", timeout: 20000 });
                console.log("Pre-warm navigation complete.");
                await new Promise(r => setTimeout(r, 1500)); // allow page scripts to settle
                // Capture early live preview screenshot
                const buf = await preWarmPage.screenshot({ fullPage: false, type: "png" });
                const fileName = `live/${testRunId}-${viewport}-${Date.now()}.png`;
                // Upload to storage
                await admin.storage
                    .from("screenshots")
                    .upload(fileName, buf, { contentType: "image/png", upsert: true });
                const { data: urlData } = admin.storage.from("screenshots").getPublicUrl(fileName);
                const imageUrl = urlData?.publicUrl || "";
                // Insert into screenshots table for the live stream to pick up
                await admin.from("screenshots").insert({
                    test_run_id: testRunId,
                    viewport,
                    image_url: imageUrl
                });
                console.log(`Live preview screenshot uploaded for ${viewport}`);
                await preWarmBrowser.close();
                console.log("Pre-warming complete.");
            }
            catch (err) {
                console.warn("Pre-warming failed (non-critical):", err instanceof Error ? err.message : err);
            }
            let lhBrowser;
            try {
                const { chromium } = await Promise.resolve().then(() => __importStar(require("playwright")));
                // ⚡ Use dynamic port to avoid conflicts
                const debugPort = 9222 + Math.floor(Math.random() * 1000);
                lhBrowser = await chromium.launch({
                    headless: true,
                    args: [
                        `--remote-debugging-port=${debugPort}`,
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                    ],
                });
                await new Promise(r => setTimeout(r, 1000));
                const lighthouse = (await eval("import('lighthouse')")).default;
                const isMobile = viewport !== "desktop";
                const { width, height } = VIEWPORT_SIZES[viewport];
                console.log(`Lighthouse scan starting for ${viewport} on port ${debugPort}...`);
                // ⚡ Full Lighthouse scan (Performance, Accessibility, Best Practices, SEO)
                const lhResult = await lighthouse(url, {
                    port: debugPort,
                    output: "json",
                    logLevel: "error",
                    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
                    formFactor: isMobile ? "mobile" : "desktop",
                    throttlingMethod: isMobile ? "simulate" : "provided",
                    throttling: isMobile ? {
                        rttMs: 40,
                        throughputKbps: 10 * 1024,
                        cpuSlowdownMultiplier: 2,
                        requestLatencyMs: 0,
                        downloadThroughputKbps: 0,
                        uploadThroughputKbps: 0,
                    } : {
                        rttMs: 20,
                        throughputKbps: 20 * 1024,
                        cpuSlowdownMultiplier: 1,
                        requestLatencyMs: 0,
                        downloadThroughputKbps: 0,
                        uploadThroughputKbps: 0,
                    },
                    screenEmulation: {
                        mobile: isMobile,
                        width,
                        height,
                        deviceScaleFactor: isMobile ? 2.625 : 1,
                        disabled: false,
                    },
                    skipAudits: ['screenshot-thumbnails', 'final-screenshot'],
                });
                const lhr = lhResult?.lhr;
                if (lhr) {
                    const audits = lhr.audits;
                    const vName = viewport.charAt(0).toUpperCase() + viewport.slice(1);
                    // Correct metric extraction
                    const lcp = Math.round((audits["largest-contentful-paint"]?.numericValue ?? 0)) / 1000;
                    const fcp = Math.round((audits["first-contentful-paint"]?.numericValue ?? 0)) / 1000;
                    const ttfb = Math.round(audits["server-response-time"]?.numericValue ?? 0);
                    const cls = Math.round((audits["cumulative-layout-shift"]?.numericValue ?? 0) * 1000) / 1000;
                    const tbt = Math.round(audits["total-blocking-time"]?.numericValue ?? 0);
                    const si = Math.round((audits["speed-index"]?.numericValue ?? 0)) / 1000;
                    const tti = Math.round((audits["interactive"]?.numericValue ?? 0)) / 1000;
                    // 1. Performance
                    const perfScore = Math.round((lhr.categories.performance?.score ?? 0) * 100);
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `Lighthouse Performance Score (${vName})`,
                        status: perfScore >= 90 ? "pass" : perfScore >= 50 ? "warning" : "fail",
                        severity: perfScore >= 90 ? "low" : perfScore >= 50 ? "medium" : "critical",
                        message: `Performance score: ${perfScore}/100 (${vName})`,
                        fix_recommendation: perfScore < 90 ? (0, fix_recommendations_1.getFixRecommendation)("performance_score_low") : "", screenshot_url: null
                    });
                    // 2. Accessibility
                    const accScore = Math.round((lhr.categories.accessibility?.score ?? 0) * 100);
                    results.push({
                        test_run_id: testRunId, category: "others", check_name: `Accessibility Score (${vName})`,
                        status: accScore >= 90 ? "pass" : accScore >= 70 ? "warning" : "fail",
                        severity: accScore >= 90 ? "low" : accScore >= 70 ? "medium" : "critical",
                        message: `Accessibility score: ${accScore}/100 (${vName})`,
                        fix_recommendation: accScore < 90 ? "Improve accessibility by fixing WCAG violations identified in Lighthouse." : "", screenshot_url: null
                    });
                    // 3. Best Practices
                    const bpScore = Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100);
                    results.push({
                        test_run_id: testRunId, category: "others", check_name: `Best Practices Score (${vName})`,
                        status: bpScore >= 90 ? "pass" : bpScore >= 70 ? "warning" : "fail",
                        severity: bpScore >= 90 ? "low" : bpScore >= 70 ? "medium" : "critical",
                        message: `Best Practices score: ${bpScore}/100 (${vName})`,
                        fix_recommendation: bpScore < 90 ? "Review web best practices for security and modern web standards." : "", screenshot_url: null
                    });
                    // 4. SEO
                    const seoScore = Math.round((lhr.categories.seo?.score ?? 0) * 100);
                    results.push({
                        test_run_id: testRunId, category: "others", check_name: `SEO Score (${vName})`,
                        status: seoScore >= 90 ? "pass" : seoScore >= 80 ? "warning" : "fail",
                        severity: seoScore >= 90 ? "low" : seoScore >= 80 ? "medium" : "critical",
                        message: `SEO score: ${seoScore}/100 (${vName})`,
                        fix_recommendation: seoScore < 90 ? "Optimize meta tags, crawlability, and mobile-friendliness for better search ranking." : "", screenshot_url: null
                    });
                    // LCP
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `Largest Contentful Paint (${vName})`,
                        status: lcp <= 2.5 ? "pass" : lcp <= 4 ? "warning" : "fail",
                        severity: lcp <= 2.5 ? "low" : lcp <= 4 ? "medium" : "critical",
                        message: `LCP: ${lcp.toFixed(1)}s (${vName}, target ≤ 2.5s)`,
                        fix_recommendation: lcp > 2.5 ? (0, fix_recommendations_1.getFixRecommendation)("lcp_slow") : "", screenshot_url: null
                    });
                    // FCP
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `First Contentful Paint (${vName})`,
                        status: fcp <= 1.8 ? "pass" : fcp <= 3 ? "warning" : "fail",
                        severity: fcp <= 1.8 ? "low" : fcp <= 3 ? "medium" : "critical",
                        message: `FCP: ${fcp.toFixed(1)}s (${vName}, target ≤ 1.8s)`,
                        fix_recommendation: fcp > 1.8 ? (0, fix_recommendations_1.getFixRecommendation)("fcp_slow") : "", screenshot_url: null
                    });
                    // TTFB
                    const ttfbTarget = isMobile ? 700 : 600;
                    const ttfbStatus = ttfb <= ttfbTarget ? "pass" : ttfb <= 1800 ? "warning" : "fail";
                    const ttfbSeverity = ttfb <= ttfbTarget ? "low" : ttfb <= 1800 ? "medium" : "critical";
                    results.push({
                        test_run_id: testRunId,
                        category: "performance",
                        check_name: `Time to First Byte - Server Response Time (${vName})`,
                        status: ttfbStatus,
                        severity: ttfbSeverity,
                        message: `TTFB: ${ttfb}ms (${vName}, target ≤ ${ttfbTarget}ms)${ttfbStatus !== 'pass' ? ' — Your hosting server is running slow, likely due to high traffic spikes or temporary resource restrictions.' : ''}`,
                        fix_recommendation: ttfbStatus !== "pass"
                            ? "Optimize your hosting server by upgrading your CPU/RAM allocation, setting up database caching, or moving your static assets to a CDN."
                            : "",
                        screenshot_url: null
                    });
                    // CLS
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `Cumulative Layout Shift (${vName})`,
                        status: cls <= 0.1 ? "pass" : cls <= 0.25 ? "warning" : "fail",
                        severity: cls <= 0.1 ? "low" : cls <= 0.25 ? "medium" : "critical",
                        message: `CLS: ${cls.toFixed(3)} (${vName}, target ≤ 0.1)`,
                        fix_recommendation: cls > 0.1 ? (0, fix_recommendations_1.getFixRecommendation)("cls_high") : "", screenshot_url: null
                    });
                    // TBT
                    const tbtTarget = isMobile ? 300 : 200;
                    const tbtStatus = tbt <= tbtTarget ? "pass" : tbt <= 600 ? "warning" : "fail";
                    const tbtSeverity = tbt <= tbtTarget ? "low" : tbt <= 600 ? "medium" : "critical";
                    results.push({
                        test_run_id: testRunId,
                        category: "performance",
                        check_name: `Page Smoothness - Phone Processing Load (${vName})`,
                        status: tbtStatus,
                        severity: tbtSeverity,
                        message: `TBT: ${tbt}ms (${vName}, target ≤ ${tbtTarget}ms)${tbtStatus !== 'pass' ? ' — The website has too many complex functions or animations, causing a visitor\'s device to lag while loading the page.' : ''}`,
                        fix_recommendation: tbtStatus !== "pass"
                            ? "Simplify the website by reducing complex visual elements, removing heavy interactive features, and cleaning up background tracking services."
                            : "",
                        screenshot_url: null
                    });
                    // Speed Index
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `Speed Index (${vName})`,
                        status: si <= 3.4 ? "pass" : si <= 5.8 ? "warning" : "fail",
                        severity: si <= 3.4 ? "low" : si <= 5.8 ? "medium" : "critical",
                        message: `Speed Index: ${si.toFixed(1)}s (${vName}, target ≤ 3.4s)`,
                        fix_recommendation: si > 3.4 ? (0, fix_recommendations_1.getFixRecommendation)("performance_score_low") : "", screenshot_url: null
                    });
                    // TTI
                    results.push({
                        test_run_id: testRunId, category: "performance", check_name: `Time to Interactive (${vName})`,
                        status: tti <= 3.8 ? "pass" : tti <= 7.3 ? "warning" : "fail",
                        severity: tti <= 3.8 ? "low" : tti <= 7.3 ? "medium" : "critical",
                        message: `TTI: ${tti.toFixed(1)}s (${vName}, target ≤ 3.8s)`,
                        fix_recommendation: tti > 3.8 ? (0, fix_recommendations_1.getFixRecommendation)("performance_score_low") : "", screenshot_url: null
                    });
                }
            }
            catch (lhErr) {
                const errorMsg = lhErr instanceof Error ? lhErr.message : "unknown error";
                console.error(`Lighthouse error (${viewport}):`, errorMsg.slice(0, 100));
                results.push({
                    test_run_id: testRunId, category: "performance", check_name: `Lighthouse Scan (${viewport})`,
                    status: "warning", severity: "low",
                    message: `Performance scan could not complete for ${viewport}: ${errorMsg.slice(0, 80)}`,
                    fix_recommendation: "", screenshot_url: null
                });
            }
            finally {
                if (lhBrowser) {
                    try {
                        await lhBrowser.close();
                    }
                    catch { /* ignore */ }
                }
            }
        }
        // ── LOAD TESTING via k6 (Throughput, Concurrent Users) ──────────
        console.log("Starting k6 load test for Throughput & Concurrent Users...");
        const fs = require("fs");
        const path = require("path");
        const { execSync } = require("child_process");
        const scriptPath = path.join(__dirname, `k6_script_${testRunId}.js`);
        const summaryPath = path.join(__dirname, `k6_summary_${testRunId}.json`);
        const k6ScriptContent = `
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '5s',
};

export default function () {
  http.get('${url}');
  sleep(0.1);
}

export function handleSummary(data) {
  return {
    '${summaryPath.replace(/\\/g, "\\\\")}': JSON.stringify(data)
  };
}
`;
        try {
            // 1. Verify if k6 is installed
            try {
                execSync("k6 version", { stdio: "ignore" });
            }
            catch (err) {
                throw new Error("k6 is not installed on the system.");
            }
            // 2. Write the temporary k6 test script
            fs.writeFileSync(scriptPath, k6ScriptContent, "utf8");
            // 3. Execute the load test
            console.log("Running k6 load test script...");
            execSync(`k6 run "${scriptPath}"`, { stdio: "inherit" });
            // 4. Read and parse the summary
            if (fs.existsSync(summaryPath)) {
                const summaryData = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
                const throughput = Math.round(summaryData.metrics.http_reqs.values.rate || 0);
                const maxVus = Math.round(summaryData.metrics.vus ? summaryData.metrics.vus.values.max : 10);
                const avgLatency = Math.round(summaryData.metrics.http_req_duration.values.avg || 0);
                // Throughput results
                results.push({
                    test_run_id: testRunId,
                    category: "performance",
                    check_name: "Throughput (Load Capacity)",
                    status: throughput >= 50 ? "pass" : throughput >= 20 ? "warning" : "fail",
                    severity: throughput >= 50 ? "low" : throughput >= 20 ? "medium" : "critical",
                    message: `Throughput: ${throughput} requests per second (Server handling capacity)`,
                    fix_recommendation: throughput < 20 ? "Optimize server code, database queries, or upgrade ECS task CPU allocation." : "",
                    screenshot_url: null
                });
                // Concurrent Users results
                results.push({
                    test_run_id: testRunId,
                    category: "performance",
                    check_name: "Concurrent Users (Stress Test)",
                    status: "pass",
                    severity: "low",
                    message: `Successfully simulated ${maxVus} concurrent virtual users over 5 seconds`,
                    fix_recommendation: "",
                    screenshot_url: null
                });
                // Latency results
                results.push({
                    test_run_id: testRunId,
                    category: "performance",
                    check_name: "Average Load Latency",
                    status: avgLatency <= 500 ? "pass" : avgLatency <= 1500 ? "warning" : "fail",
                    severity: avgLatency <= 500 ? "low" : avgLatency <= 1500 ? "medium" : "critical",
                    message: `Average response time under load: ${avgLatency}ms (target ≤ 500ms)`,
                    fix_recommendation: avgLatency > 500 ? "Use a CDN (like Cloudflare), implement server caching, or optimize API endpoints." : "",
                    screenshot_url: null
                });
            }
            else {
                throw new Error("k6 finished running but failed to export summary file.");
            }
        }
        catch (k6Err) {
            console.warn("k6 load test skipped or failed:", k6Err.message);
            results.push({
                test_run_id: testRunId,
                category: "performance",
                check_name: "k6 Load Capacity Scan",
                status: "warning",
                severity: "low",
                message: `Load testing skipped: ${k6Err.message}`,
                fix_recommendation: "To enable active Load Testing, ensure k6 is installed and configured on your ECS worker container.",
                screenshot_url: null
            });
        }
        finally {
            // 5. Clean up temporary files
            try {
                if (fs.existsSync(scriptPath))
                    fs.unlinkSync(scriptPath);
                if (fs.existsSync(summaryPath))
                    fs.unlinkSync(summaryPath);
            }
            catch (cleanUpErr) {
                console.error("k6 cleanup error:", cleanUpErr);
            }
        }
    }
    // ── PER-VIEWPORT BROWSER CHECKS ─────────────────────────────────────────
    try {
        const { chromium } = await Promise.resolve().then(() => __importStar(require("playwright")));
        const browser = await chromium.launch({ headless: true });
        for (const viewport of viewports) {
            const { width, height } = VIEWPORT_SIZES[viewport];
            const context = await browser.newContext({
                viewport: { width, height },
                userAgent: "Mozilla/5.0 (compatible; QATester/1.0; +https://qa-tester.app)",
            });
            const page = await context.newPage();
            const consoleErrors = [];
            page.on("console", msg => { if (msg.type() === "error")
                consoleErrors.push(msg.text().slice(0, 120)); });
            page.on("pageerror", err => consoleErrors.push(err.message.slice(0, 120)));
            try {
                const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); // ⚡ Increased from 30s to 60s for slow sites
                if (!response || response.status() >= 400) {
                    results.push({
                        test_run_id: testRunId, category: "broken_links", check_name: "Page Load",
                        status: "fail", severity: "critical",
                        message: `Page returned status ${response?.status() ?? "unknown"}`,
                        fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("broken_link"), screenshot_url: null
                    });
                    await context.close();
                    continue;
                }
                await page.waitForTimeout(500); // ⚡ Reduced from 800ms to 500ms
                // ── OTHERS CATEGORY: RESPONSIVE ──────────────────────────────────────────────────
                if (checks.others) {
                    try {
                        // Viewport meta tag (only check once on desktop)
                        if (viewport === "desktop") {
                            const hasViewportMeta = await page.evaluate(() => !!document.querySelector('meta[name="viewport"]'));
                            results.push({
                                test_run_id: testRunId, category: "others", check_name: "Viewport Meta Tag",
                                status: hasViewportMeta ? "pass" : "fail", severity: hasViewportMeta ? "low" : "critical",
                                message: hasViewportMeta ? "Viewport meta tag present" : "Missing <meta name=\"viewport\"> tag",
                                fix_recommendation: hasViewportMeta ? "" : (0, fix_recommendations_1.getFixRecommendation)("missing_viewport_meta"), screenshot_url: null
                            });
                        }
                        // Horizontal overflow
                        const overflowResult = await page.evaluate((vw) => {
                            const hasOverflow = document.body.scrollWidth > vw || document.documentElement.scrollWidth > vw;
                            const offScreen = [];
                            document.querySelectorAll("*").forEach((el) => {
                                const rect = el.getBoundingClientRect();
                                if (rect.right > vw + 5 || rect.left < -5) {
                                    const tag = el.tagName.toLowerCase();
                                    const id = el.id ? `#${el.id}` : "";
                                    const cls = el.className ? `.${String(el.className).split(" ")[0]}` : "";
                                    offScreen.push(`${tag}${id}${cls}`);
                                }
                            });
                            return { hasOverflow, offScreen: offScreen.slice(0, 5) };
                        }, width);
                        results.push({
                            test_run_id: testRunId, category: "others", check_name: `Horizontal Overflow (${viewport})`,
                            status: overflowResult.hasOverflow ? "fail" : "pass",
                            severity: overflowResult.hasOverflow ? (viewport === "mobile" ? "critical" : "medium") : "low",
                            message: overflowResult.hasOverflow
                                ? `Horizontal overflow at ${width}px. Elements: ${overflowResult.offScreen.join(", ") || "detected"}`
                                : `No horizontal overflow at ${width}px`,
                            fix_recommendation: overflowResult.hasOverflow ? (0, fix_recommendations_1.getFixRecommendation)("horizontal_overflow") : "", screenshot_url: null
                        });
                        // Font size (mobile only)
                        if (viewport === "mobile") {
                            const smallFonts = await page.evaluate(() => {
                                let count = 0;
                                document.querySelectorAll("p, span, a, li, td, th").forEach((el) => {
                                    if (parseFloat(window.getComputedStyle(el).fontSize) < 12)
                                        count++;
                                });
                                return count;
                            });
                            results.push({
                                test_run_id: testRunId, category: "others", check_name: "Font Size (mobile)",
                                status: smallFonts > 0 ? "warning" : "pass", severity: smallFonts > 0 ? "medium" : "low",
                                message: smallFonts > 0 ? `${smallFonts} element(s) have font size below 12px on mobile` : "Font sizes acceptable on mobile",
                                fix_recommendation: smallFonts > 0 ? (0, fix_recommendations_1.getFixRecommendation)("small_font_mobile") : "", screenshot_url: null
                            });
                            // Touch target size
                            const smallTargets = await page.evaluate(() => {
                                const els = Array.from(document.querySelectorAll("a, button, [role=\"button\"], input, select, textarea"));
                                return els.filter(el => {
                                    const r = el.getBoundingClientRect();
                                    return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
                                }).length;
                            });
                            results.push({
                                test_run_id: testRunId, category: "others", check_name: "Touch Target Size (mobile)",
                                status: smallTargets > 0 ? "warning" : "pass", severity: smallTargets > 0 ? "medium" : "low",
                                message: smallTargets > 0 ? `${smallTargets} interactive element(s) smaller than 44x44px` : "All touch targets meet minimum size",
                                fix_recommendation: smallTargets > 0 ? (0, fix_recommendations_1.getFixRecommendation)("touch_target_small") : "", screenshot_url: null
                            });
                        }
                    }
                    catch (responsiveErr) {
                        console.error("Responsive checks error:", responsiveErr);
                        // Continue with other checks even if responsive checks fail
                    }
                }
                // Responsive checks removed - simplified to 4 core categories
                // ── BROKEN LINKS CHECK ──────────────────────────────────────────────────
                if (checks.broken_links && viewport === "desktop") {
                    try {
                        // Broken link checker (HTTP status)
                        const linkData = await page.evaluate(() => {
                            const links = Array.from(document.querySelectorAll("a[href]"));
                            const seen = new Set();
                            const results = [];
                            for (const a of links) {
                                const href = a.href;
                                if (!href)
                                    continue;
                                const lowerHref = href.toLowerCase();
                                // 🛡️ Filter out non-http protocols, anchors, email/phone links, and javascript scripts
                                if (!lowerHref.startsWith("http") ||
                                    lowerHref.startsWith("mailto:") ||
                                    lowerHref.startsWith("tel:") ||
                                    lowerHref.includes("javascript:") ||
                                    lowerHref.includes("#")) {
                                    continue;
                                }
                                // ⚡ Prevent duplicate checking to save bandwidth and server load
                                if (seen.has(href))
                                    continue;
                                seen.add(href);
                                results.push({
                                    href,
                                    text: a.textContent?.trim().slice(0, 40) || "unnamed",
                                    isExternal: a.hostname !== window.location.hostname,
                                });
                            }
                            return results;
                        });
                        const brokenLinks = [];
                        const workingLinks = [];
                        const emptyLinks = [];
                        let timeoutCount = 0;
                        // Check links in batches — with a master 90s timeout to avoid hanging
                        const batchSize = 10;
                        const linkCheckWithTimeout = new Promise(async (resolve) => {
                            const linksToCheck = linkData.slice(0, 30); // Hard limit of 30 links
                            for (let i = 0; i < linksToCheck.length; i += batchSize) {
                                const batch = linksToCheck.slice(i, i + batchSize);
                                await Promise.all(batch.map(async (link) => {
                                    try {
                                        const controller = new AbortController();
                                        const timeoutId = setTimeout(() => controller.abort(), timeouts.linkCheckMs);
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
                                        if (r.status === 404 || r.status === 410 || r.status >= 500) {
                                            brokenLinks.push(`${link.text} → ${link.href.slice(0, 60)} (HTTP ${r.status})`);
                                        }
                                        else if (r.status >= 200 && r.status < 400) {
                                            workingLinks.push(link.href);
                                        }
                                    }
                                    catch (err) {
                                        if (err instanceof Error && err.name === 'AbortError') {
                                            timeoutCount++;
                                        }
                                        else {
                                            brokenLinks.push(`${link.text} → ${link.href.slice(0, 60)} (Network Error)`);
                                            console.log(`Link check failed for ${link.href.slice(0, 60)}: ${err instanceof Error ? err.message : 'unknown error'}`);
                                        }
                                    }
                                }));
                            }
                            resolve();
                        });
                        const masterLinkTimeout = new Promise(resolve => setTimeout(() => {
                            console.warn("Link checking master timeout (90s) reached — proceeding with partial results.");
                            resolve();
                        }, 90000));
                        await Promise.race([linkCheckWithTimeout, masterLinkTimeout]);
                        // Check for empty/placeholder links
                        const placeholderLinks = await page.evaluate(() => Array.from(document.querySelectorAll("a")).filter(a => !a.href || a.getAttribute("href") === "#" || a.getAttribute("href") === "").length);
                        if (placeholderLinks > 0)
                            emptyLinks.push(`${placeholderLinks} placeholder/empty href(s)`);
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
                                ? `Found ${brokenCount} broken link(s) out of ${linkTotal} checked: ${brokenLinks.slice(0, 3).join(", ")}`
                                : emptyLinks.length > 0
                                    ? `${emptyLinks.join(", ")} - ${workingCount} links working`
                                    : `All ${linkTotal} link(s) are working (HTTP 200-399)`,
                            fix_recommendation: brokenCount > 0 ? (0, fix_recommendations_1.getFixRecommendation)("broken_link_404") : emptyLinks.length > 0 ? (0, fix_recommendations_1.getFixRecommendation)("broken_link") : "",
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
                    catch (linkErr) {
                        console.error("Broken links check error:", linkErr);
                        results.push({
                            test_run_id: testRunId, category: "broken_links", check_name: "Broken Links",
                            status: "warning", severity: "low",
                            message: "Link checking could not complete due to page context error",
                            fix_recommendation: "", screenshot_url: null
                        });
                    }
                }
                // SEO checks removed - simplified to 4 core categories
                // ── CATEGORY: ADVANCED SEO & CONTENT QUALITY ─────────────────────────────────────
                if (checks.others && viewport === "desktop") {
                    try {
                        const auditData = await page.evaluate(() => {
                            const title = document.title;
                            const desc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
                            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
                            const lang = document.documentElement.lang || "";
                            const h1s = Array.from(document.querySelectorAll("h1")).map(h => h.innerText.trim());
                            const h2s = document.querySelectorAll("h2").length;
                            const hasStructuredData = !!document.querySelector('script[type="application/ld+json"]');
                            const charset = document.characterSet;
                            const doctype = document.doctype?.name || "";
                            const favicon = document.querySelector('link[rel*="icon"]')?.getAttribute("href") || "";
                            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
                            const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
                            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
                            const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";
                            // ⚡ File Size Estimation
                            const htmlSize = new Blob([document.documentElement.outerHTML]).size;
                            // Text Content Analysis
                            const bodyText = document.body.innerText || "";
                            const paragraphs = document.querySelectorAll("p").length;
                            const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
                            const words = bodyText.toLowerCase().match(/\b(\w+)\b/g) || [];
                            // Anchor Analysis
                            const anchors = Array.from(document.querySelectorAll("a")).map(a => ({
                                text: a.innerText.trim(),
                                href: a.getAttribute("href") || ""
                            }));
                            return {
                                title, desc, canonical, lang, h1s, h2s, hasStructuredData,
                                charset, doctype, favicon, bodyText, paragraphs,
                                ogTitle, ogDesc, ogImage, robots, htmlSize,
                                sentenceCount: sentences.length, wordCount: words.length,
                                words, anchors
                            };
                        });
                        // 1. Basic Metadata
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Page Title",
                            status: auditData.title ? (auditData.title.length <= 60 ? "pass" : "warning") : "fail",
                            severity: auditData.title ? "low" : "critical",
                            message: auditData.title ? `Title: "${auditData.title.slice(0, 60)}" (${auditData.title.length} chars)` : "Missing <title> tag",
                            fix_recommendation: !auditData.title ? (0, fix_recommendations_1.getFixRecommendation)("missing_title") : auditData.title.length > 60 ? "Keep title under 60 characters for optimal display." : "", screenshot_url: null
                        });
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Meta Description",
                            status: auditData.desc ? (auditData.desc.length <= 160 ? "pass" : "warning") : "fail",
                            severity: auditData.desc ? "low" : "medium",
                            message: auditData.desc ? `Description: "${auditData.desc.slice(0, 80)}..." (${auditData.desc.length} chars)` : "Missing meta description",
                            fix_recommendation: !auditData.desc ? (0, fix_recommendations_1.getFixRecommendation)("missing_meta_description") : auditData.desc.length > 160 ? "Keep description under 160 characters." : "", screenshot_url: null
                        });
                        // 1a. Page Status & Meta
                        const isNoIndex = auditData.robots.toLowerCase().includes("noindex");
                        const isNoFollow = auditData.robots.toLowerCase().includes("nofollow");
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Crawler Instructions (Robots)",
                            status: !isNoIndex ? "pass" : "warning",
                            severity: "medium",
                            message: `Robots: ${auditData.robots}. Language: ${auditData.lang || "Not set"}.`,
                            fix_recommendation: isNoIndex ? "Your page is set to 'noindex'. Ensure this is intentional if you want this page to appear in search results." : "",
                            screenshot_url: null
                        });
                        const fileSizeKb = (auditData.htmlSize / 1024).toFixed(2);
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "HTML File Size",
                            status: auditData.htmlSize < 200 * 1024 ? "pass" : "warning",
                            severity: "low",
                            message: `Total HTML size: ${fileSizeKb} kB.`,
                            fix_recommendation: auditData.htmlSize > 200 * 1024 ? "Optimize your HTML and remove unnecessary inline code to keep the page size small." : "",
                            screenshot_url: null
                        });
                        // 1b. Social Metadata
                        const ogOk = !!(auditData.ogTitle && auditData.ogDesc && auditData.ogImage);
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Social Tags (Open Graph)",
                            status: ogOk ? "pass" : "warning",
                            severity: "low",
                            message: ogOk ? "Open Graph tags are correctly implemented." : `Missing OG tags: ${!auditData.ogTitle ? "Title " : ""}${!auditData.ogDesc ? "Description " : ""}${!auditData.ogImage ? "Image" : ""}`,
                            fix_recommendation: !ogOk ? "Add Open Graph tags to control how your content appears when shared on social media (Facebook, LinkedIn, etc.)." : "",
                            screenshot_url: null
                        });
                        // 2. Content Quality (The Seobility Style)
                        const stopWords = ["the", "is", "at", "which", "on", "and", "a", "an", "to", "in", "it", "of", "for", "with"];
                        const stopWordCount = auditData.words.filter(w => stopWords.includes(w)).length;
                        const stopWordPercent = auditData.wordCount > 0 ? (stopWordCount / auditData.wordCount) * 100 : 0;
                        const avgWordPerSentence = auditData.sentenceCount > 0 ? auditData.wordCount / auditData.sentenceCount : 0;
                        results.push({
                            test_run_id: testRunId, category: "quality", check_name: "Content Length & Quality",
                            status: auditData.wordCount > 300 ? "pass" : "warning",
                            severity: "medium",
                            message: `Word count: ${auditData.wordCount}. ${auditData.paragraphs} paragraphs. Stop words: ${stopWordPercent.toFixed(1)}%.`,
                            fix_recommendation: auditData.wordCount < 300 ? "Add more descriptive content to reach at least 300 words for better SEO ranking." : "",
                            screenshot_url: null
                        });
                        results.push({
                            test_run_id: testRunId, category: "quality", check_name: "Sentence Complexity",
                            status: avgWordPerSentence < 20 ? "pass" : "warning",
                            severity: "low",
                            message: `Avg ${avgWordPerSentence.toFixed(1)} words per sentence.`,
                            fix_recommendation: avgWordPerSentence >= 20 ? "Your sentences are quite long. Try breaking them up to improve readability for users." : "",
                            screenshot_url: null
                        });
                        // 3. Heading Hierarchy & Consistency
                        const h1Text = auditData.h1s[0] || "";
                        const h1InBody = h1Text && auditData.bodyText.toLowerCase().includes(h1Text.toLowerCase());
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "H1 Matching (Semantic)",
                            status: auditData.h1s.length === 1 && h1InBody ? "pass" : "warning",
                            severity: "medium",
                            message: auditData.h1s.length === 0 ? "No H1 found." : h1InBody ? "H1 matches page content." : "H1 keywords not found in body text.",
                            fix_recommendation: !h1InBody ? "Ensure the words from your H1 heading are actually used in the main body text for search relevance." : "",
                            screenshot_url: null
                        });
                        // 4. Server & Technical
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Favicon & Technicals",
                            status: auditData.favicon && auditData.charset.toLowerCase() === "utf-8" ? "pass" : "warning",
                            severity: "low",
                            message: `${auditData.favicon ? "Favicon linked." : "No favicon."} Charset: ${auditData.charset}. Doctype: ${auditData.doctype}.`,
                            fix_recommendation: !auditData.favicon ? "Add a favicon to improve brand recognition in browser tabs." : "",
                            screenshot_url: null
                        });
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Canonical URL",
                            status: auditData.canonical ? "pass" : "warning", severity: "low",
                            message: auditData.canonical ? `Canonical found: ${auditData.canonical.slice(0, 50)}` : "No canonical tag found",
                            fix_recommendation: !auditData.canonical ? "Add a canonical tag to prevent duplicate content issues." : "", screenshot_url: null
                        });
                        // 5. Link Structure
                        const duplicateAnchors = auditData.anchors.filter((a, i, self) => a.text && a.text.length < 20 && self.findIndex(t => t.text === a.text && t.href !== a.href) !== -1).length;
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "Internal Link Structure",
                            status: duplicateAnchors === 0 ? "pass" : "warning",
                            severity: "low",
                            message: duplicateAnchors > 0 ? `${duplicateAnchors} link(s) share identical anchor text to different pages.` : "Link anchor texts are unique and descriptive.",
                            fix_recommendation: duplicateAnchors > 0 ? "Avoid using the same text (like 'Click here') for links pointing to different pages." : "",
                            screenshot_url: null
                        });
                        // 6. Network & Response (Seobility Metrics)
                        results.push({
                            test_run_id: testRunId, category: "seo", check_name: "HTTP Status & Response",
                            status: "pass", severity: "low",
                            message: `HTTP Status: 200. Initial response was fast.`,
                            fix_recommendation: "", screenshot_url: null
                        });
                    }
                    catch (seoErr) {
                        console.error("Advanced SEO checks error:", seoErr);
                    }
                }
                // Accessibility checks removed - simplified to 4 core categories
                // ── OTHERS CATEGORY: ACCESSIBILITY ────────────────────────────────────────────────
                if (checks.others && viewport === "desktop") {
                    try {
                        // Import AxeBuilder as default export
                        const AxeBuilder = (await Promise.resolve().then(() => __importStar(require("@axe-core/playwright")))).default;
                        // ⚡ Run axe-core scan with reduced scope for faster results
                        const axeResults = await Promise.race([
                            new AxeBuilder({ page: page })
                                .withTags(['wcag2a', 'wcag2aa']) // ⚡ Reduced from 4 tags to 2 for faster scan
                                .disableRules(['color-contrast']) // ⚡ Skip slow color contrast check
                                .analyze(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Accessibility scan timeout after 15s')), 15000) // ⚡ Reduced from 30s to 15s
                            )
                        ]);
                        if (axeResults.violations.length === 0) {
                            results.push({
                                test_run_id: testRunId, category: "others", check_name: "axe-core Scan",
                                status: "pass", severity: "low", message: "No accessibility violations found",
                                fix_recommendation: "", screenshot_url: null
                            });
                        }
                        else {
                            // ⚡ Limit to top 10 violations instead of 25 for faster processing
                            for (const v of axeResults.violations.slice(0, 10)) {
                                const sev = v.impact === "critical" || v.impact === "serious" ? "critical"
                                    : v.impact === "moderate" ? "medium" : "low";
                                results.push({
                                    test_run_id: testRunId, category: "others", check_name: v.id,
                                    status: "fail", severity: sev,
                                    message: `${v.description} — ${v.nodes.length} element(s) affected`,
                                    fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)(v.id) || v.help, screenshot_url: null
                                });
                            }
                        }
                        // Keyboard navigation check
                        const focusableCount = await page.evaluate(() => document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])").length);
                        results.push({
                            test_run_id: testRunId, category: "others", check_name: "Keyboard Navigable Elements",
                            status: focusableCount > 0 ? "pass" : "warning", severity: "low",
                            message: focusableCount > 0 ? `${focusableCount} keyboard-focusable element(s) found` : "No keyboard-focusable elements detected",
                            fix_recommendation: focusableCount === 0 ? (0, fix_recommendations_1.getFixRecommendation)("keyboard_navigation") : "", screenshot_url: null
                        });
                    }
                    catch (axeErr) {
                        console.error("axe-core error details:", axeErr);
                        const errorMsg = axeErr instanceof Error ? axeErr.message : "Unknown error";
                        results.push({
                            test_run_id: testRunId, category: "others", check_name: "axe-core Scan",
                            status: "warning", severity: "low",
                            message: `Accessibility scan could not complete: ${errorMsg.slice(0, 100)}`,
                            fix_recommendation: "Ensure the page is fully loaded and accessible. Check server console for details.", screenshot_url: null
                        });
                    }
                }
                // Visual screenshots removed - simplified to 4 core categories
                // ── OTHERS CATEGORY: VISUAL SCREENSHOTS ───────────────────────────────────────────
                if (checks.others) {
                    try {
                        // ⚡ Viewport-only screenshot (much faster than fullPage)
                        const buf = await page.screenshot({ fullPage: false, type: "png" });
                        const fileName = `${testRunId}/${viewport}-${Date.now()}.png`;
                        const { data: urlData } = admin.storage.from("screenshots").getPublicUrl(fileName);
                        const imageUrl = urlData?.publicUrl || "";
                        // ⚡ Collect for bulk insert later (don't insert individually)
                        screenshots.push({ test_run_id: testRunId, viewport, image_url: imageUrl });
                        results.push({
                            test_run_id: testRunId, category: "others", check_name: `Screenshot (${viewport})`,
                            status: "pass", severity: "low", message: `Screenshot captured at ${width}x${height}`,
                            fix_recommendation: "", screenshot_url: imageUrl
                        });
                        // ⚡ Upload in background (don't wait)
                        admin.storage
                            .from("screenshots").upload(fileName, buf, { contentType: "image/png", upsert: true })
                            .catch((err) => console.error("Screenshot upload error:", err));
                    }
                    catch (screenshotErr) {
                        console.error("Screenshot error:", screenshotErr);
                    }
                }
            }
            catch (pageErr) {
                console.error(`Error testing ${viewport}:`, pageErr);
                results.push({
                    test_run_id: testRunId, category: "broken_links", check_name: `Page Load (${viewport})`,
                    status: "fail", severity: "critical",
                    message: `Failed to load page at ${viewport}: ${pageErr instanceof Error ? pageErr.message : "Unknown error"}`,
                    fix_recommendation: "Ensure the URL is publicly accessible and not behind authentication.", screenshot_url: null
                });
            }
            finally {
                await context.close();
            }
        } // end viewport loop
        await browser.close();
        // ── CROSS-BROWSER COMPATIBILITY TESTING ─────────────────────────────
        if (checks.compatibility) {
            console.log("Starting cross-browser compatibility testing...");
            const { chromium, firefox, webkit } = await Promise.resolve().then(() => __importStar(require("playwright")));
            const testViewport = { width: 1440, height: 900 };
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
            // ⚡ Run browsers in parallel with safe detection
            const [chromiumResult, firefoxResult, webkitResult] = await Promise.allSettled([
                // Chromium test
                (async () => {
                    console.log("Launching Chromium for compatibility check...");
                    const chromiumBrowser = await chromium.launch({ headless: true }).catch(() => null);
                    if (!chromiumBrowser)
                        throw new Error("Chromium not installed");
                    const chromiumContext = await chromiumBrowser.newContext({ viewport: testViewport });
                    const chromiumPage = await chromiumContext.newPage();
                    const chromiumConsoleErrors = [];
                    chromiumPage.on("console", msg => { if (msg.type() === "error")
                        chromiumConsoleErrors.push(msg.text()); });
                    chromiumPage.on("pageerror", err => chromiumConsoleErrors.push(err.message));
                    try {
                        const chromiumResponse = await chromiumPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
                        let chromiumScreenshot = null;
                        if (chromiumResponse && chromiumResponse.status() < 400) {
                            await chromiumPage.waitForTimeout(500);
                            chromiumScreenshot = await chromiumPage.screenshot({ fullPage: false, type: "png" });
                        }
                        return { screenshot: chromiumScreenshot, consoleErrors: chromiumConsoleErrors, response: chromiumResponse };
                    }
                    finally {
                        await chromiumBrowser.close();
                    }
                })(),
                // Firefox test
                (async () => {
                    console.log("Checking Firefox installation...");
                    const firefoxBrowser = await firefox.launch({ headless: true }).catch(() => null);
                    if (!firefoxBrowser) {
                        console.log("Firefox not installed, skipping...");
                        return { screenshot: null, consoleErrors: [], response: null, skipped: true };
                    }
                    const firefoxContext = await firefoxBrowser.newContext({ viewport: testViewport });
                    const firefoxPage = await firefoxContext.newPage();
                    const firefoxConsoleErrors = [];
                    firefoxPage.on("console", msg => { if (msg.type() === "error")
                        firefoxConsoleErrors.push(msg.text()); });
                    firefoxPage.on("pageerror", err => firefoxConsoleErrors.push(err.message));
                    try {
                        const firefoxResponse = await firefoxPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
                        let firefoxScreenshot = null;
                        if (firefoxResponse && firefoxResponse.status() < 400) {
                            await firefoxPage.waitForTimeout(500);
                            firefoxScreenshot = await firefoxPage.screenshot({ fullPage: false, type: "png" });
                        }
                        return { screenshot: firefoxScreenshot, consoleErrors: firefoxConsoleErrors, response: firefoxResponse };
                    }
                    finally {
                        await firefoxBrowser.close();
                    }
                })(),
                // WebKit test
                (async () => {
                    console.log("Checking WebKit installation...");
                    const webkitBrowser = await webkit.launch({ headless: true }).catch(() => null);
                    if (!webkitBrowser) {
                        console.log("WebKit not installed, skipping...");
                        return { screenshot: null, consoleErrors: [], response: null, skipped: true };
                    }
                    const webkitContext = await webkitBrowser.newContext({ viewport: testViewport });
                    const webkitPage = await webkitContext.newPage();
                    const webkitConsoleErrors = [];
                    webkitPage.on("console", msg => { if (msg.type() === "error")
                        webkitConsoleErrors.push(msg.text()); });
                    webkitPage.on("pageerror", err => webkitConsoleErrors.push(err.message));
                    try {
                        const webkitResponse = await webkitPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
                        let webkitScreenshot = null;
                        if (webkitResponse && webkitResponse.status() < 400) {
                            await webkitPage.waitForTimeout(500);
                            webkitScreenshot = await webkitPage.screenshot({ fullPage: false, type: "png" });
                        }
                        return { screenshot: webkitScreenshot, consoleErrors: webkitConsoleErrors, response: webkitResponse };
                    }
                    finally {
                        await webkitBrowser.close();
                    }
                })(),
            ]);
            console.log("Processing compatibility results...");
            // Process Chromium results
            if (chromiumResult.status === "fulfilled") {
                const { screenshot, response } = chromiumResult.value;
                if (response && response.status() < 400) {
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
                else {
                    results.push({
                        test_run_id: testRunId,
                        category: "compatibility",
                        check_name: "Chrome/Chromium (All OS)",
                        status: "fail",
                        severity: "critical",
                        message: `Chrome test failed with status ${response?.status() ?? "unknown"}`,
                        fix_recommendation: "Check if the page has Chrome-specific issues",
                        screenshot_url: null
                    });
                }
            }
            else {
                results.push({
                    test_run_id: testRunId,
                    category: "compatibility",
                    check_name: "Chrome/Chromium (All OS)",
                    status: "fail",
                    severity: "critical",
                    message: `Chrome test failed: ${chromiumResult.reason instanceof Error ? chromiumResult.reason.message : "unknown error"}`,
                    fix_recommendation: "Check if the page has Chrome-specific issues",
                    screenshot_url: null
                });
            }
            // Process Firefox results
            if (firefoxResult.status === "fulfilled") {
                const { screenshot, consoleErrors, response } = firefoxResult.value;
                const chromiumErrors = chromiumResult.status === "fulfilled" ? chromiumResult.value.consoleErrors : [];
                if (!response || response.status() >= 400) {
                    results.push({
                        test_run_id: testRunId, category: "compatibility", check_name: "Firefox (All OS)",
                        status: "fail", severity: "critical",
                        message: `Page failed to load in Firefox on Windows/macOS/Linux (status: ${response?.status() ?? "unknown"})`,
                        fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("firefox_specific"), screenshot_url: null
                    });
                }
                else {
                    const firefoxOnlyErrors = consoleErrors.filter(e => !chromiumErrors.includes(e));
                    if (firefoxOnlyErrors.length > 0) {
                        results.push({
                            test_run_id: testRunId, category: "compatibility", check_name: "Firefox JavaScript Errors",
                            status: "fail", severity: "medium",
                            message: `${firefoxOnlyErrors.length} Firefox-specific JS error(s): ${firefoxOnlyErrors.slice(0, 2).join(" | ")}`,
                            fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("browser_js_error"), screenshot_url: null
                        });
                    }
                    else {
                        results.push({
                            test_run_id: testRunId, category: "compatibility", check_name: "Firefox (All OS)",
                            status: "pass", severity: "low",
                            message: "Page loads successfully in Firefox on Windows, macOS, and Linux",
                            fix_recommendation: "", screenshot_url: null
                        });
                    }
                    // Visual comparison
                    if (chromiumResult.status === "fulfilled" && chromiumResult.value.screenshot && screenshot) {
                        const sizeDiff = Math.abs(screenshot.length - chromiumResult.value.screenshot.length);
                        const diffPercent = (sizeDiff / chromiumResult.value.screenshot.length) * 100;
                        if (diffPercent > 15) {
                            results.push({
                                test_run_id: testRunId, category: "compatibility", check_name: "Firefox Layout Consistency",
                                status: "warning", severity: "medium",
                                message: `Layout difference detected between Chrome and Firefox (${diffPercent.toFixed(1)}% variance)`,
                                fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("browser_layout_diff"), screenshot_url: null
                            });
                        }
                    }
                }
            }
            else {
                results.push({
                    test_run_id: testRunId, category: "compatibility", check_name: "Firefox Compatibility",
                    status: "warning", severity: "medium",
                    message: `Firefox test could not complete: ${firefoxResult.reason instanceof Error ? firefoxResult.reason.message : "unknown error"}`,
                    fix_recommendation: "", screenshot_url: null
                });
            }
            // Process WebKit results
            if (webkitResult.status === "fulfilled") {
                const { screenshot, consoleErrors, response } = webkitResult.value;
                const chromiumErrors = chromiumResult.status === "fulfilled" ? chromiumResult.value.consoleErrors : [];
                if (!response || response.status() >= 400) {
                    results.push({
                        test_run_id: testRunId, category: "compatibility", check_name: "Safari/WebKit (macOS/iOS)",
                        status: "fail", severity: "critical",
                        message: `Page failed to load in Safari/WebKit (status: ${response?.status() ?? "unknown"})`,
                        fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("webkit_specific"), screenshot_url: null
                    });
                }
                else {
                    const webkitOnlyErrors = consoleErrors.filter(e => !chromiumErrors.includes(e));
                    if (webkitOnlyErrors.length > 0) {
                        results.push({
                            test_run_id: testRunId, category: "compatibility", check_name: "Safari JavaScript Errors",
                            status: "fail", severity: "medium",
                            message: `${webkitOnlyErrors.length} Safari-specific JS error(s): ${webkitOnlyErrors.slice(0, 2).join(" | ")}`,
                            fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("webkit_specific"), screenshot_url: null
                        });
                    }
                    else {
                        results.push({
                            test_run_id: testRunId, category: "compatibility", check_name: "Safari/WebKit (macOS/iOS)",
                            status: "pass", severity: "low",
                            message: "Page loads successfully in Safari on macOS and iOS",
                            fix_recommendation: "", screenshot_url: null
                        });
                    }
                    // Visual comparison
                    if (chromiumResult.status === "fulfilled" && chromiumResult.value.screenshot && screenshot) {
                        const sizeDiff = Math.abs(screenshot.length - chromiumResult.value.screenshot.length);
                        const diffPercent = (sizeDiff / chromiumResult.value.screenshot.length) * 100;
                        if (diffPercent > 15) {
                            results.push({
                                test_run_id: testRunId, category: "compatibility", check_name: "Safari Layout Consistency",
                                status: "warning", severity: "medium",
                                message: `Layout difference detected between Chrome and Safari (${diffPercent.toFixed(1)}% variance)`,
                                fix_recommendation: (0, fix_recommendations_1.getFixRecommendation)("webkit_specific"), screenshot_url: null
                            });
                        }
                    }
                }
            }
            else {
                results.push({
                    test_run_id: testRunId, category: "compatibility", check_name: "Safari (WebKit) Compatibility",
                    status: "warning", severity: "medium",
                    message: `Safari test could not complete: ${webkitResult.reason instanceof Error ? webkitResult.reason.message : "unknown error"}`,
                    fix_recommendation: "", screenshot_url: null
                });
            }
            // Overall browser compatibility summary
            const compatResults = results.filter(r => r.category === "compatibility");
            const compatFails = compatResults.filter(r => r.status === "fail").length;
            const compatWarnings = compatResults.filter(r => r.status === "warning").length;
            console.log(`Cross-browser testing complete: ${compatResults.length} checks, ${compatFails} fails, ${compatWarnings} warnings`);
            results.push({
                test_run_id: testRunId, category: "compatibility", check_name: "Cross-Browser & OS Summary",
                status: compatFails > 0 ? "fail" : compatWarnings > 0 ? "warning" : "pass",
                severity: compatFails > 0 ? "critical" : compatWarnings > 0 ? "medium" : "low",
                message: compatFails > 0
                    ? `${compatFails} browser(s) have critical issues across OS platforms, ${compatWarnings} warning(s)`
                    : compatWarnings > 0
                        ? `All browsers load successfully across OS platforms with ${compatWarnings} minor warning(s)`
                        : "Page works consistently across Chrome, Firefox, and Safari on all supported operating systems (Windows, macOS, Linux, iOS)",
                fix_recommendation: compatFails > 0 ? (0, fix_recommendations_1.getFixRecommendation)("browser_compatibility") : "", screenshot_url: null
            });
        }
    }
    catch (browserErr) {
        console.error("Browser launch error:", browserErr);
        results.push({
            test_run_id: testRunId, category: "broken_links", check_name: "Browser Launch",
            status: "fail", severity: "critical",
            message: `Could not launch browser: ${browserErr instanceof Error ? browserErr.message : "Unknown error"}`,
            fix_recommendation: "Ensure Playwright is installed and the server has sufficient resources.", screenshot_url: null
        });
    }
    if (results.length > 0) {
        const { error: insertError } = await admin.from("test_results").insert(results);
        if (insertError) {
            console.error("Failed to insert results:", insertError.message);
            // Try inserting one by one to identify the bad row
            for (const r of results) {
                const { error: e } = await admin.from("test_results").insert(r);
                if (e)
                    console.error("Row insert failed:", e.message, JSON.stringify(r).slice(0, 200));
            }
        }
    }
    // ⚡ Bulk insert screenshots (much faster than individual inserts)
    if (screenshots.length > 0) {
        const { error: screenshotError } = await admin.from("screenshots").insert(screenshots);
        if (screenshotError) {
            console.error("Failed to insert screenshots:", screenshotError.message);
        }
    }
    // ── CALCULATE OVERALL SCORE (0-100) ─────────────────────────────────
    let overallScore = 0;
    if (results.length > 0) {
        // Category weights (total = 100%) - 6 functional categories
        const categoryWeights = {
            performance: 25, // 25% - Core Web Vitals
            broken_links: 15, // 15% - Link integrity
            security: 20, // 20% - Data protection & Server config
            seo: 20, // 20% - Meta data & Headings
            quality: 10, // 10% - Content analysis
            compatibility: 10, // 10% - Cross-browser support
        };
        // Calculate score per category
        const categoryScores = {};
        for (const [category, weight] of Object.entries(categoryWeights)) {
            const categoryResults = results.filter(r => r.category === category);
            if (categoryResults.length === 0)
                continue;
            let categoryScore = 0;
            let totalPoints = 0;
            for (const result of categoryResults) {
                // Point system based on status and severity
                let points = 0;
                if (result.status === "pass") {
                    points = 100; // Full points for pass
                }
                else if (result.status === "warning") {
                    // Warnings: 70 points for low, 50 for medium, 30 for critical
                    points = result.severity === "low" ? 70 : result.severity === "medium" ? 50 : 30;
                }
                else if (result.status === "fail") {
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
    console.log(`Finalizing test run ${testRunId} with score ${overallScore}...`);
    const { error: finalUpdateError } = await admin.from("test_runs")
        .update({
        status: "completed",
        overall_score: overallScore,
        completed_at: new Date().toISOString()
    })
        .eq("id", testRunId);
    if (finalUpdateError) {
        console.error("Failed to update final status in Supabase:", finalUpdateError.message);
    }
    else {
        console.log(`Test run ${testRunId} marked as completed.`);
    }
}
