# Third-Party Impact Analysis — How It Works

**Document purpose:** Explain in plain English + developer detail what the Third-Party Impact Analysis feature does, why it was built, and how every piece of code works.

---

## The Problem It Solves

### Before this feature

Lighthouse gives you one number: a performance score like **60/100**.

But that score tells you nothing about **why** it is 60. Two websites can both score 60 for completely different reasons:

- **Website A** — Well-written code, fast server. But Google Analytics + Facebook Pixel + Hotjar are blocking the main thread for 700ms. The site is *actually fine*. Third parties dragged it down.
- **Website B** — The developer wrote 2MB of unoptimized JavaScript. The server is slow. No CDN. The site is *genuinely bad*.

Without this analysis, both get the same score and the same generic "fix your performance" message. That is useless for the developer of Website A — they don't need to rewrite their code. They need to remove Hotjar.

### After this feature

The system now reads the internal Lighthouse data it was already collecting, digs into it deeper, and produces a **verdict**:

- `clean` — everything is fine
- `site_issue` — your own code is the problem
- `third_party_issue` — your code is fine, external services are the problem  
- `mixed` — both are contributing

---

## Real-World Example

Imagine you test `mosafir.pk` (a travel site).

Lighthouse gives score: **58/100**

Without this feature, the report says: *"Performance is poor. Fix your JavaScript."*

With this feature, the report says:

```
Verdict: Third-Party Services Causing Issues

Your code TBT:          45ms   ✅ (very fast)
Third-party TBT:        680ms  ❌ (Google Tag Manager: 320ms, Facebook Pixel: 230ms, Hotjar: 130ms)

LCP Image: res.cloudinary.com/mosafir/... ❌ (your hero image is served from Cloudinary, 
           which was slow at the time of test — 3.4s to load)

Render-blocking scripts: Google Tag Manager, Facebook Connect

Recommendation: Your website code is healthy. Remove or defer:
  - Google Tag Manager (load async)
  - Facebook Pixel (load after page interactive)
  - Replace Cloudinary hero image with self-hosted WebP
```

The developer now knows: **don't touch your code. Fix your integrations.**

---

## How Lighthouse Already Had This Data (The Key Insight)

This is the most important thing to understand.

When Lighthouse runs a performance scan, it opens a real Chrome browser and records **everything** that happens during page load — every HTTP request, every script execution, every millisecond of browser activity.

It then produces a huge JSON object called `lhr` (Lighthouse Result). Most tools only read 6–8 fields from this JSON (LCP, FCP, TBT, etc.) and throw the rest away.

But `lhr.audits` contains **hundreds of audits**. We were ignoring 4 of them that are gold for this analysis:

```ts
lhr.audits["third-party-summary"]        // ← which external services ran + how much they blocked
lhr.audits["network-requests"]           // ← every single HTTP request with domain + size + timing
lhr.audits["largest-contentful-paint-element"]  // ← what element was the LCP and where it came from
lhr.audits["render-blocking-resources"]  // ← which scripts blocked the page from rendering
```

We didn't add any new API calls. We didn't run Lighthouse twice. We just **read more fields** from the result that was already there.

---

## Code Walkthrough — Line by Line

### Step 0: Extract the site's own domain

```ts
const siteDomain = new URL(url).hostname.replace(/^www\./, "");
```

**What it does:** If you're testing `https://www.mosafir.pk/flights`, this extracts `mosafir.pk`.

**Why:** Everything we need to do depends on knowing: "is this request from the site itself, or from somewhere else?" This is our reference point.

**Example:**
```
URL = "https://www.mosafir.pk"
siteDomain = "mosafir.pk"    (www. removed)
```

---

### Step 1: The Known Entities Dictionary

```ts
const KNOWN_ENTITIES: Record<string, { name: string; type: ThirdPartyEntity["type"] }> = {
  "google-analytics.com":  { name: "Google Analytics", type: "analytics" },
  "cloudinary.com":        { name: "Cloudinary",       type: "media" },
  "fonts.googleapis.com":  { name: "Google Fonts CSS", type: "cdn" },
  "hotjar.com":            { name: "Hotjar",           type: "analytics" },
  // ... 40+ more
};
```

**What it does:** Maps raw domain names to human-readable names and categories.

**Why:** The Lighthouse data gives you raw domains like `res.cloudinary.com` or `connect.facebook.net`. Without this dictionary, you'd show the user a table of cryptic domains. With it, you show them `Cloudinary (media)` and `Facebook Connect (social)`.

**Types available:** `analytics | cdn | database | media | ads | social | other`

**Developer note:** This is a hardcoded lookup table — the simplest possible approach. You could replace this with an API call to a service like `wappalyzer` for dynamic detection, but that adds latency and cost. The hardcoded approach covers 95% of real-world cases for free.

---

### Step 2: Two Helper Functions


```ts
const classifyDomain = (domain: string) => {
  if (KNOWN_ENTITIES[domain]) return KNOWN_ENTITIES[domain];        // exact match
  for (const key of Object.keys(KNOWN_ENTITIES)) {
    if (domain.endsWith(key) || domain.endsWith(`.${key}`)) return KNOWN_ENTITIES[key];
  }
  return { name: domain, type: "other" };
};
```

**What it does:** Given a domain string, returns its human-readable name and type.

**Why the suffix match:** Cloudinary uses many subdomains. `res.cloudinary.com`, `media.cloudinary.com`, `upload.cloudinary.com` are all Cloudinary. The suffix check `domain.endsWith("cloudinary.com")` catches all of them.

**Example:**
```
classifyDomain("res.cloudinary.com")
→ suffix match: "cloudinary.com"
→ returns { name: "Cloudinary", type: "media" }

classifyDomain("some-unknown-service.io")
→ no match
→ returns { name: "some-unknown-service.io", type: "other" }
```

---

```ts
const isThirdParty = (domain: string): boolean => {
  const clean = domain.replace(/^www\./, "");
  return clean !== siteDomain && !clean.endsWith(`.${siteDomain}`);
};
```

**What it does:** Returns `true` if a domain is NOT the site being tested.

**Example:**
```
siteDomain = "mosafir.pk"

isThirdParty("mosafir.pk")         → false (that's us)
isThirdParty("api.mosafir.pk")     → false (our own subdomain)
isThirdParty("cloudinary.com")     → true  (external)
isThirdParty("fonts.googleapis.com") → true (external)
```

**Why the subdomain check:** A site might load assets from `cdn.mosafir.pk` or `api.mosafir.pk`. Those are still the developer's own infrastructure — not third-party. The `.endsWith(`.${siteDomain}`)` check handles this correctly.

---

### Step 3: Parse `third-party-summary` Audit

```ts
const tpSummaryAudit = audits["third-party-summary"];
const entityMap = new Map<string, ThirdPartyEntity>();

if (tpSummaryAudit?.details?.items) {
  for (const item of tpSummaryAudit.details.items as any[]) {
    const entityName  = item.entity?.text ?? item.entity ?? "Unknown";
    const blockingMs  = Math.round(item.blockingTime ?? 0);
    const sizeBytes   = item.transferSize ?? 0;
    const reqs        = item.requestCount ?? 0;
    ...
  }
}
```

**What `third-party-summary` looks like inside Lighthouse:**
```json
{
  "details": {
    "items": [
      {
        "entity": { "text": "Google Tag Manager" },
        "blockingTime": 320,
        "transferSize": 87040,
        "requestCount": 3
      },
      {
        "entity": { "text": "Facebook" },
        "blockingTime": 230,
        "transferSize": 45120,
        "requestCount": 2
      }
    ]
  }
}
```

**What we extract from each item:**
- `blockingTime` → how many milliseconds this service blocked the main thread (this is what hurts TBT)
- `transferSize` → how many bytes this service downloaded
- `requestCount` → how many HTTP requests this service made

**Then we filter out first-party:**
```ts
if (!isThirdParty(domain) && domain) continue;  // skip the site's own entries
```

**The result:** `entityMap` — a Map of all third-party services with their impact data.

---

### Step 4: Parse `network-requests` Audit

```ts
const networkAudit = audits["network-requests"];
let firstPartySizeKB = 0;
let thirdPartySizeKB = 0;

for (const req of networkAudit.details.items) {
  const reqDomain = new URL(req.url).hostname.replace(/^www\./, "");
  const sizeKB = Math.round((req.transferSize ?? 0) / 1024);

  if (isThirdParty(reqDomain)) {
    thirdPartySizeKB += sizeKB;
  } else {
    firstPartySizeKB += sizeKB;
  }
}
```

**What this does:** Goes through every single HTTP request that happened during page load and buckets the downloaded bytes into two categories: your stuff vs. their stuff.

**Why we need this separately from Step 3:** `third-party-summary` gives us blocking time per entity but the size data can sometimes be 0 if Lighthouse doesn't calculate it. `network-requests` gives us raw request-level data that fills the gaps.

**Example output:**
```
firstPartySizeKB = 340   (your HTML, JS, CSS, images from mosafir.pk)
thirdPartySizeKB = 890   (Cloudinary images + Google fonts + Facebook scripts)
thirdPartySizePercent = 72%  ← 72% of total page weight is external!
```

---

### Step 5: Check Where the LCP Image Came From

```ts
const lcpElementAudit = audits["largest-contentful-paint-element"];
let lcpIsThirdParty = false;
let lcpDomain: string | null = null;

if (lcpElementAudit?.details?.items?.[0]) {
  const lcpUrl = lcpElementAudit.details.items[0]?.node?.nodeLabel ?? "";
  if (lcpUrl.startsWith("http")) {
    lcpDomain = new URL(lcpUrl).hostname.replace(/^www\./, "");
    lcpIsThirdParty = isThirdParty(lcpDomain);
  }
}
```

**What is the LCP element?** The Largest Contentful Paint element is the biggest visible thing on screen — usually your hero image or main heading. It's what the user "sees" first.

**Why this matters:** If your LCP element is an image served from `res.cloudinary.com`, then Cloudinary's speed directly controls your LCP score. If Cloudinary has a slow day, your LCP is slow. If you self-host that same image, you control it entirely.

**Real example:**
```
Website has hero image: <img src="https://res.cloudinary.com/mosafir/hero.jpg">
lcpDomain = "res.cloudinary.com"
lcpIsThirdParty = true

Verdict addition: "Your LCP hero image is served from Cloudinary (external).
                   Consider self-hosting this image for stable LCP scores."
```

---

### Step 6: Find Render-Blocking Third-Party Scripts

```ts
const renderBlockingAudit = audits["render-blocking-resources"];
const renderBlockingThirdParties: string[] = [];

for (const item of renderBlockingAudit.details.items) {
  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  if (isThirdParty(domain)) {
    renderBlockingThirdParties.push(classifyDomain(domain).name);
  }
}
```

**What is a render-blocking resource?** When a browser loads a page, it processes HTML top-to-bottom. If it encounters a `<script src="...">` without `async` or `defer`, it **stops everything** and waits for that script to download and run before continuing. This directly delays FCP and LCP.

**Example:** Google Tag Manager is very commonly loaded like this:
```html
<script src="https://www.googletagmanager.com/gtm.js"></script>
```
No `async`, no `defer` → browser freezes until GTM downloads → FCP is delayed.

**What we capture:** If the render-blocking resource is from a third-party domain, we add it to `renderBlockingThirdParties`. This list shows up as a prominent red warning in the UI.

---

### Step 7: TBT Split Calculation

```ts
const thirdPartyTbt = Array.from(entityMap.values())
  .reduce((sum, entity) => sum + entity.blockingTimeMs, 0);

const firstPartyTbt = Math.max(0, tbt - thirdPartyTbt);
const thirdPartyTbtPercent = totalTbt > 0
  ? Math.round((thirdPartyTbt / totalTbt) * 100) : 0;
```

**What TBT is:** Total Blocking Time = the sum of all moments when the browser's main thread was "frozen" (couldn't respond to clicks). It directly affects how sluggish a site feels.

**The math:**
```
Lighthouse total TBT: 780ms

Third parties contributed:
  Google Tag Manager: 320ms
  Facebook Pixel:     230ms
  Hotjar:             130ms
  Total 3P TBT:       680ms

First-party TBT = 780 - 680 = 100ms  (your own code: fast!)
Third-party TBT % = (680 / 780) * 100 = 87%
```

**This is the core calculation.** 87% of blocking time is external. Your code is not the problem.

---

### Step 8: Verdict Logic

```ts
const perfIsPoor = perfScore < 70;
const thirdPartyIsSignificant = thirdPartyTbtPercent >= 50 
                              || lcpIsThirdParty 
                              || renderBlockingThirdParties.length > 0;
const firstPartyIssues = firstPartyTbt > (isMobile ? 300 : 200) 
                       || (tbt > 0 && thirdPartyTbtPercent < 30);

let verdict: "clean" | "site_issue" | "third_party_issue" | "mixed";

if (!perfIsPoor)                                   verdict = "clean";
else if (thirdPartyIsSignificant && !firstPartyIssues) verdict = "third_party_issue";
else if (thirdPartyIsSignificant && firstPartyIssues)  verdict = "mixed";
else                                               verdict = "site_issue";
```

**Decision tree in plain English:**

```
Is performance score >= 70?
  YES → "clean" (everything is fine, stop here)
  NO  → dig deeper...
    Are third parties causing ≥50% of blocking time?
    OR is the LCP image from a third-party?
    OR are there render-blocking external scripts?
      YES (third-party significant) → 
        Is your own first-party code also slow (>200ms TBT)?
          YES → "mixed" (both are problems)
          NO  → "third_party_issue" (your code is fine, 3P is the culprit)
      NO (third parties are not significant) →
        → "site_issue" (your code is the actual problem)
```

---

### Step 9: Save the Result

```ts
results.push({
  test_run_id: testRunId,
  category: "performance",
  check_name: `Third-Party Impact Analysis (${vName})`,
  status: verdict === "clean" ? "pass" 
        : verdict === "third_party_issue" ? "warning" 
        : verdict === "mixed" ? "warning" 
        : "fail",
  severity: verdict === "clean" ? "low" 
          : verdict === "site_issue" ? "critical" 
          : "medium",
  message: verdictMessages[verdict],
  fix_recommendation: fixMessages[verdict],
  screenshot_url: null,
  third_party_analysis: analysis,   // ← the full JSON data for the UI
});
```

**Status logic:**
- `clean` → green pass
- `third_party_issue` → yellow warning (it's not your fault, but user should know)
- `mixed` → yellow warning
- `site_issue` → red fail (you need to fix this)

---

## What The UI Does With This Data

The `ThirdPartyAnalysisCard` component in `report-view.tsx` reads `result.third_party_analysis` and renders:

1. **Verdict badge** — Large colored label: "Your Code is the Issue" / "Third-Party Services Causing Issues" / etc.

2. **TBT split bar** — A horizontal progress bar split into two colors:
   - Blue = your code's blocking time
   - Orange/Red = third-party blocking time
   
   ```
   [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
      Your: 100ms (13%)     Third-parties: 680ms (87%)
   ```

3. **3 stat boxes:**
   - Your asset size in KB
   - Third-party asset size in KB (with % of total)
   - LCP image origin: "✅ Self-hosted" or "⚠️ External (res.cloudinary.com)"

4. **Render-blocking warning** — If any third-party scripts are blocking rendering, a red box lists them by name.

5. **Expandable entity table** — Click "Details" to see every detected third-party service:
   - Icon (📊 analytics, 🌐 cdn, 🖼️ media, etc.)
   - Service name
   - Blocking time in ms (colored red if >200ms)
   - Transfer size in KB
   - Number of requests

6. **Fix recommendation** — Tailored to the verdict. If it's a third-party issue, it names the specific services to fix. If it's a site issue, it points to the code.

---

## Zero Extra Cost

The most important thing: **this feature costs nothing extra in time or API calls.**

Lighthouse already collected all this data when it ran the performance scan. We just read 4 more fields from the same JSON object it already produced. The scan takes the exact same amount of time as before.

Before: we read 8 fields from `lhr.audits`
After: we read 12 fields from `lhr.audits`

The extra 4 fields were always there — we just weren't looking at them.

---

## Summary Table

| Step | What We Do | Data Source | Why |
|------|-----------|------------|-----|
| 0 | Extract site domain | `new URL(url).hostname` | Reference point for first vs third party |
| 1 | Build entity dictionary | Hardcoded lookup table | Map raw domains to human names |
| 2 | Helper: classify domain | Dictionary lookup | Identify what service a domain belongs to |
| 3 | Parse third-party-summary | `lhr.audits["third-party-summary"]` | Get blocking time per external service |
| 4 | Parse network-requests | `lhr.audits["network-requests"]` | Get asset size split: yours vs external |
| 5 | Check LCP origin | `lhr.audits["largest-contentful-paint-element"]` | Is the hero image self-hosted? |
| 6 | Find render-blockers | `lhr.audits["render-blocking-resources"]` | Which external scripts freeze the browser |
| 7 | Split TBT | Math: total TBT - 3P TBT = 1P TBT | Quantify how much third parties hurt |
| 8 | Verdict logic | If/else decision tree | Give a clear, actionable diagnosis |
| 9 | Save + display | `results.push(...)` + UI component | Show the developer what to actually fix |
