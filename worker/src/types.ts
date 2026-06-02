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
