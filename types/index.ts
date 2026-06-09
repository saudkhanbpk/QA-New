export type TestStatus = "pending" | "running" | "completed" | "failed";
export type ResultStatus = "pass" | "fail" | "warning";
export type Severity = "critical" | "medium" | "low";
export type Category =
  | "performance"
  | "broken_links"
  | "compatibility"
  | "security"
  | "seo"
  | "quality"
  | "others";
export type Viewport = "mobile" | "tablet" | "desktop";
export type Browser = "chromium" | "firefox" | "webkit";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface TestRun {
  id: string;
  user_id: string;
  page_url: string;
  status: TestStatus;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
  batch_id?: string | null;
  batch_name?: string | null;
}

export interface TestBatch {
  batch_id: string;
  batch_name: string | null;
  test_runs: TestRun[];
  created_at: string;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  average_score: number | null;
}

export interface PageSize {
  total_size: number;
  html_size: number;
  image_size: number;
  js_size: number;
  css_size: number;
  font_size: number;
}

export interface PageRequestSize {
  total_requests: number;
  image_requests: number;
  js_requests: number;
  other_requests: number;
  css_requests: number;
  font_requests: number;
  image_percent: number;
  js_percent: number;
  css_percent: number;
  font_percent: number;
  other_percent: number;
}

export interface ThirdPartyEntity {
  name: string;
  domain: string;
  blockingTimeMs: number;
  transferSizeKB: number;
  requestCount: number;
  type: "analytics" | "cdn" | "database" | "media" | "ads" | "social" | "other";
}

export interface ThirdPartyAnalysis {
  verdict: "site_issue" | "third_party_issue" | "mixed" | "clean";
  firstPartyTbt: number;
  thirdPartyTbt: number;
  thirdPartyTbtPercent: number;
  firstPartySizeKB: number;
  thirdPartySizeKB: number;
  thirdPartySizePercent: number;
  lcpIsThirdParty: boolean;
  lcpDomain: string | null;
  entities: ThirdPartyEntity[];
  renderBlockingThirdParties: string[];
}

export interface CwvEntry {
  url: string;
  strategy: "mobile" | "desktop";
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  source: "field" | "lab" | "none";
}

export interface TestResult {
  id: string;
  test_run_id: string;
  category: Category;
  check_name: string;
  status: ResultStatus;
  severity: Severity;
  message: string;
  fix_recommendation: string | null;
  screenshot_url: string | null;
  created_at: string;
  responsive: boolean;
  page_size: PageSize[] | null;
  page_request_size: PageRequestSize[] | null;
  inner_pages_results: { url: string }[] | null;
  cwv_results: CwvEntry[] | null;
  third_party_analysis: ThirdPartyAnalysis | null;
}

export interface Screenshot {
  id: string;
  test_run_id: string;
  viewport: Viewport;
  image_url: string;
  created_at: string;
}

export interface TestReport {
  run: TestRun;
  results: TestResult[];
  screenshots: Screenshot[];
}

export interface RunTestPayload {
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
