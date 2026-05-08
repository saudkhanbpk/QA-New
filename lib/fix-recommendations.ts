export const FIX_RECOMMENDATIONS: Record<string, string> = {
  // Responsive
  horizontal_overflow:
    "Wrap layout in a flex or grid container. Replace fixed widths (px) with fluid units (%, rem, or clamp()). Add overflow-x: hidden on the body.",
  small_font_mobile:
    "Use a minimum font size of 16px for body text on mobile. Use rem units instead of px.",
  touch_target_small:
    "Increase interactive element size to at least 44x44px (Apple HIG) or 48x48dp (Material Design). Add padding rather than changing the visual size.",
  missing_viewport_meta:
    "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside <head> to enable responsive scaling on mobile devices.",

  // Functional
  broken_link:
    "Update the href value. Check if the route exists. Use Next.js Link component for internal routes.",
  broken_link_404:
    "The linked page returned a 404. Remove or update the href. For internal routes verify the page exists in your router config.",
  button_not_clickable:
    "Ensure the button is not covered by another element (check z-index). Remove pointer-events: none if present.",
  form_no_validation:
    "Add required attributes and pattern validation to inputs. Show inline error messages on submit.",
  console_errors:
    "Open DevTools Console and resolve all JavaScript errors. Common causes: undefined variables, failed network requests, missing DOM elements.",
  element_off_screen:
    "Check for negative margins or absolute positioning pushing elements outside the viewport. Use position: relative on parent containers.",

  // Accessibility
  "axe:color-contrast":
    "Increase the contrast ratio between text and background to at least 4.5:1 for normal text (WCAG AA). Use a tool like coolors.co/contrast-checker.",
  "axe:image-alt":
    "Add a descriptive alt attribute to all img elements. For decorative images, use alt=''.",
  "axe:aria-label":
    "Add aria-label or aria-labelledby to interactive elements that have no visible text label.",
  "axe:label":
    "Associate every form input with a <label> element using the for/id pair, or wrap the input inside the label.",
  "axe:heading-order":
    "Use headings in sequential order (H1 → H2 → H3). Do not skip heading levels for visual styling — use CSS instead.",
  "axe:landmark-one-main":
    "Wrap the main page content in a <main> element. Each page should have exactly one <main> landmark.",
  "axe:region":
    "Ensure all content is contained within landmark regions: <header>, <nav>, <main>, <footer>, or elements with role attributes.",
  keyboard_navigation:
    "Ensure all interactive elements are reachable and operable via keyboard (Tab, Enter, Space, Arrow keys). Add tabindex=\"0\" where needed.",

  // Performance
  lcp_slow:
    "Optimize the Largest Contentful Paint element: compress images (use WebP/AVIF), add loading=\"eager\" and fetchpriority=\"high\" to hero images, use a CDN, and eliminate render-blocking resources.",
  fcp_slow:
    "Improve First Contentful Paint: inline critical CSS, defer non-critical JS, use font-display: swap, and reduce server response time (TTFB).",
  ttfb_slow:
    "Reduce Time to First Byte: use server-side caching, a CDN, optimize database queries, and consider edge rendering.",
  cls_high:
    "Fix Cumulative Layout Shift: always set explicit width/height on images and videos, avoid inserting content above existing content, use CSS transform for animations.",
  tbt_high:
    "Reduce Total Blocking Time: split large JavaScript bundles with code splitting, defer non-critical scripts, move heavy computation to Web Workers.",
  performance_score_low:
    "Run Lighthouse locally and address the top opportunities: compress images, remove unused CSS/JS, enable text compression (gzip/brotli), and leverage browser caching.",

  // Security
  missing_https:
    "Serve your site over HTTPS. Obtain a TLS certificate (free via Let's Encrypt) and redirect all HTTP traffic to HTTPS.",
  missing_hsts:
    "Add the Strict-Transport-Security header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
  missing_csp:
    "Implement a Content Security Policy header to prevent XSS attacks. Start with: Content-Security-Policy: default-src 'self'",
  missing_x_frame_options:
    "Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking attacks.",
  missing_x_content_type:
    "Add X-Content-Type-Options: nosniff to prevent MIME-type sniffing attacks.",
  missing_referrer_policy:
    "Add Referrer-Policy: strict-origin-when-cross-origin to control what referrer information is sent.",
  missing_permissions_policy:
    "Add a Permissions-Policy header to restrict access to browser features: Permissions-Policy: camera=(), microphone=(), geolocation=()",
  insecure_cookies:
    "Set the Secure, HttpOnly, and SameSite=Strict flags on all session cookies to prevent theft and CSRF attacks.",
  mixed_content:
    "Replace all http:// resource URLs with https:// equivalents. Mixed content blocks secure connections and triggers browser warnings.",

  // SEO
  missing_title:
    "Add a <title> tag inside <head>. Keep it 50-60 characters, include the primary keyword, and make it unique per page.",
  missing_meta_description:
    "Add <meta name=\"description\" content=\"...\"> inside <head>. Keep it 150-160 characters and include a call to action.",
  missing_og_tags:
    "Add Open Graph meta tags for social sharing: og:title, og:description, og:image, og:url. Use 1200x630px images for og:image.",
  missing_canonical:
    "Add <link rel=\"canonical\" href=\"https://yourdomain.com/page\"> to prevent duplicate content issues.",
  missing_lang:
    "Add a lang attribute to the <html> element: <html lang=\"en\">. This helps screen readers and search engines.",
  heading_hierarchy:
    "Use a single H1 per page that describes the main topic. Structure subheadings as H2, H3 etc. in logical order.",
  missing_robots_txt:
    "Create a /robots.txt file to guide search engine crawlers. At minimum: User-agent: * Allow: /",
  missing_sitemap:
    "Create an XML sitemap at /sitemap.xml listing all indexable pages. Submit it to Google Search Console.",
  missing_structured_data:
    "Add JSON-LD structured data (schema.org) to help search engines understand your content. Start with WebSite, Organization, or BreadcrumbList schemas.",

  // Cross-browser compatibility
  browser_layout_diff:
    "Use CSS resets (e.g. normalize.css) and avoid browser-specific properties without fallbacks. Test with autoprefixer to add vendor prefixes automatically.",
  browser_js_error:
    "Check browser compatibility on MDN Web Docs for the failing API. Add polyfills (core-js, polyfill.io) for unsupported features or use feature detection with 'if (feature in window)'.",
  browser_font_diff:
    "Specify fallback font stacks: font-family: 'YourFont', Arial, sans-serif. Use @font-face with multiple formats (woff2, woff) for cross-browser support.",
  browser_flexbox_diff:
    "Add vendor prefixes for older browsers: display: -webkit-flex; display: flex. Use autoprefixer in your build pipeline.",
  browser_grid_diff:
    "Add -ms-grid prefixes for IE/Edge legacy. Consider a flexbox fallback for browsers without CSS Grid support.",
  browser_scroll_diff:
    "Replace 'scroll-behavior: smooth' with JavaScript scroll for Safari compatibility. Use the 'smoothscroll-polyfill' package.",
  browser_input_diff:
    "Avoid relying on browser-specific input types. Add custom styling with appearance: none and re-style manually for cross-browser consistency.",
  browser_video_diff:
    "Provide multiple video formats: <source src='video.mp4' type='video/mp4'> and <source src='video.webm' type='video/webm'> for cross-browser support.",
  browser_console_error:
    "Open the browser's DevTools Console and resolve all JavaScript errors. Check MDN compatibility tables for the failing API.",
  webkit_specific:
    "Safari/WebKit requires -webkit- prefixes for some CSS properties. Use autoprefixer and test on real Safari. Common issues: -webkit-overflow-scrolling, -webkit-appearance.",
  firefox_specific:
    "Firefox handles some CSS differently (scrollbar styling, font rendering). Use standard CSS properties and avoid -webkit- only rules.",
  edge_specific:
    "Edge (Chromium-based) is largely compatible with Chrome. Check for legacy EdgeHTML issues if supporting older Edge versions.",
};

export function getFixRecommendation(key: string): string {
  if (FIX_RECOMMENDATIONS[key]) return FIX_RECOMMENDATIONS[key];
  const axeKey = `axe:${key}`;
  if (FIX_RECOMMENDATIONS[axeKey]) return FIX_RECOMMENDATIONS[axeKey];
  const partialKey = Object.keys(FIX_RECOMMENDATIONS).find((k) =>
    key.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(key.toLowerCase())
  );
  if (partialKey) return FIX_RECOMMENDATIONS[partialKey];
  return "Review the element and ensure it meets web standards and best practices.";
}
