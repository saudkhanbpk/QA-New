"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { TestReport, TestResult, Category } from "@/types";

// ── Sub-components ────────────────────────────────────────────────────────────
import { RunStatusBadge, ResultCard, CategoryHeader, EmptyState } from "@/components/report/shared";
import { IssuesOverviewTabContent } from "@/components/report/issues-tab";
import { SummaryTabContent } from "@/components/report/summary-tab";
import { PerformanceTabContent } from "@/components/report/performance-tab";
import { InnerPagesTabContent } from "@/components/report/inner-pages-tab";
import { StructureTabContent } from "@/components/report/structure-tab";
import { OthersTabContent } from "@/components/report/others-tab";

interface ReportViewProps { report: TestReport; }

export function ReportView({ report }: ReportViewProps) {
  const { run, results, screenshots } = report;
  const totalFails = results.filter((r) => r.status === "fail").length;
  const totalWarnings = results.filter((r) => r.status === "warning").length;
  const overallPass = totalFails === 0;
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    }
    checkUser();
  }, []);

  const byCategory: Record<Category, TestResult[]> = {
    performance: results.filter((r) => r.category === "performance"),
    broken_links: results.filter((r) => r.category === "broken_links"),
    compatibility: results.filter((r) => r.category === "compatibility"),
    security: results.filter((r) => r.category === "security"),
    seo: results.filter((r) => r.category === "seo"),
    quality: results.filter((r) => r.category === "quality"),
    others: results.filter((r) => r.category === "others"),
    structure: results.filter((r) => r.category === "structure"),
  };

  // ── Grade card helpers ────────────────────────────────────────────────────
  const perfResults = results.filter((r) => r.category === "performance");

  function extractMetric(key: string): string | null {
    const candidates = [...perfResults.filter((r) => r.check_name.toLowerCase().includes("desktop")), ...perfResults];
    for (const r of candidates) {
      const regex = new RegExp(`${key}[:\\s]+([\\d.]+\\s*(?:ms|s)?)`, "i");
      const m = r.message.match(regex);
      if (m) return m[1].trim();
    }
    return null;
  }

  let perfScore: number | null = null;
  let structureScore: number | null = null;

  const desktopPerfResults = results.filter((r) => r.category === "performance" && r.check_name.toLowerCase().includes("(desktop)"));
  const desktopOthersResults = results.filter((r) => r.category === "others" && r.check_name.toLowerCase().includes("(desktop)"));

  for (const r of [...desktopPerfResults, ...perfResults]) {
    if (!perfScore) {
      const m = r.message.match(/performance[:\s]+(\d+)/i) || r.message.match(/score[:\s]+(\d+)/i);
      if (m) { perfScore = parseInt(m[1]); break; }
    }
  }
  for (const r of [...desktopOthersResults, ...results.filter((r) => r.category === "others")]) {
    if (!structureScore) {
      const m = r.message.match(/best\s*practices\s*score[:\s]+(\d+)/i);
      if (m) { structureScore = parseInt(m[1]); break; }
    }
  }
  if (!perfScore) perfScore = run.overall_score;
  if (!structureScore) structureScore = run.overall_score;

  const lcp = extractMetric("LCP") ?? "–";
  const tbt = extractMetric("TBT") ?? "–";
  const cls = extractMetric("CLS") ?? "–";

  const grade = (perfScore ?? 0) >= 80 ? "A" : (perfScore ?? 0) >= 65 ? "B" : (perfScore ?? 0) >= 50 ? "C" : (perfScore ?? 0) >= 35 ? "D" : "F";

  const gradeGradient =
    grade === "A" ? "linear-gradient(135deg, #4CAF50, #8BC34A)" :
    grade === "B" ? "linear-gradient(135deg, #8BC34A, #CDDC39)" :
    grade === "C" ? "linear-gradient(135deg, #FFC107, #FF9800)" :
    grade === "D" ? "linear-gradient(135deg, #FF9800, #FF5722)" :
    "linear-gradient(135deg, #F44336, #B71C1C)";

  function scoreColor(v: number) { return v >= 90 ? "#4CAF50" : v >= 70 ? "#FF9800" : "#F44336"; }

  function metricColor(key: string, val: string) {
    const num = parseFloat(val);
    if (isNaN(num)) return "#aaa";
    if (key === "LCP") return num <= 2.5 ? "#4CAF50" : num <= 4 ? "#FF9800" : "#F44336";
    if (key === "TBT") return num <= 200 ? "#4CAF50" : num <= 600 ? "#FF9800" : "#F44336";
    if (key === "CLS") return num <= 0.1 ? "#4CAF50" : num <= 0.25 ? "#FF9800" : "#F44336";
    return "#aaa";
  }

  const QuestionMark = ({ title }: { title: string }) => (
    <span title={title} className="inline-flex items-center justify-center cursor-help ml-1" style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px solid #b0bec5", fontSize: 9, color: "#90a4ae", fontWeight: 700, verticalAlign: "middle", lineHeight: 1 }}>?</span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <RunStatusBadge status={run.status} />
            {run.status === "completed" && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${overallPass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {overallPass ? "All checks passed" : `${totalFails} failure${totalFails !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grade + Web Vitals cards */}
      {run.status === "completed" && run.overall_score !== null && (
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Grade card */}
          <div className="flex-1">
            <p className="text-sm md:text-2xl lg:text-3xl font-semibold mb-2" style={{ color: "#3388cc" }}>
              Performance Grade <QuestionMark title="Overall grade based on Performance and Structure scores" />
            </p>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-stretch" style={{ minHeight: 90 }}>
                <div className="flex items-center justify-center px-7" style={{ borderRight: "1px solid #e8edf2" }}>
                  <span className="font-black select-none leading-none" style={{ fontSize: 80, background: gradeGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{grade}</span>
                </div>
                <div className="flex flex-col justify-center px-8" style={{ borderRight: "1px solid #e8edf2" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>Performance <QuestionMark title="Lighthouse Performance Score" /></p>
                  <p className="font-bold leading-none" style={{ fontSize: 36, color: scoreColor(perfScore ?? 0) }}>{perfScore}%</p>
                </div>
                <div className="flex flex-col justify-center px-8">
                  <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>Structure <QuestionMark title="Best Practices / Structure Score" /></p>
                  <p className="font-bold leading-none" style={{ fontSize: 36, color: scoreColor(structureScore ?? 0) }}>{structureScore}%</p>
                </div>
              </div>
            </div>
          </div>
          {/* Web Vitals card */}
          <div className="flex-1">
            <p className="text-sm md:text-2xl lg:text-3xl font-semibold mb-2" style={{ color: "#3388cc" }}>
              Web Vitals <QuestionMark title="Core Web Vitals measured by Lighthouse" />
            </p>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-stretch" style={{ minHeight: 90 }}>
                {[
                  { key: "LCP", value: lcp, hint: "Largest Contentful Paint — measures loading performance" },
                  { key: "TBT", value: tbt, hint: "Total Blocking Time — measures interactivity" },
                  { key: "CLS", value: cls, hint: "Cumulative Layout Shift — measures visual stability" },
                ].map(({ key, value, hint }, idx) => (
                  <div key={key} className="flex-1 flex flex-col justify-center px-6" style={{ borderRight: idx < 2 ? "1px solid #e8edf2" : undefined }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>{key} <QuestionMark title={hint} /></p>
                    <p className="font-bold leading-none" style={{ fontSize: 36, color: metricColor(key, value) }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="issues">
        <TabsList className="flex flex-wrap h-auto gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          <TabsTrigger value="issues" className="text-xs px-4 py-2 rounded-md transition-all font-semibold bg-emerald-500 text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-emerald-600">
            🛡️ Fix Recommendations
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Summary</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Performance</TabsTrigger>
          <TabsTrigger value="inner_pages" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Inner Pages</TabsTrigger>
          <TabsTrigger value="broken_links" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Broken Links</TabsTrigger>
          <TabsTrigger value="compatibility" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Structure</TabsTrigger>
          <TabsTrigger value="cross_browser" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Cross-Browser</TabsTrigger>
          <TabsTrigger value="security" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Security</TabsTrigger>
          <TabsTrigger value="others" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Other</TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <div className={!isLoggedIn && isLoggedIn !== null ? "blur-md pointer-events-none select-none" : ""}>
            <TabsContent value="issues" className="space-y-6">
              <IssuesOverviewTabContent results={results} />
            </TabsContent>

            <TabsContent value="summary" className="space-y-6">
              <SummaryTabContent report={report} />
            </TabsContent>

            <TabsContent value="performance" className="space-y-3">
              <CategoryHeader results={byCategory.performance} />
              {byCategory.performance.length === 0
                ? <EmptyState label="performance" />
                : <PerformanceTabContent results={byCategory.performance} />}
            </TabsContent>

            <TabsContent value="inner_pages" className="space-y-3">
              <InnerPagesTabContent results={results} />
            </TabsContent>

            <TabsContent value="broken_links" className="space-y-3">
              <CategoryHeader results={byCategory.broken_links} />
              {byCategory.broken_links.length === 0
                ? <EmptyState label="broken links" />
                : byCategory.broken_links.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="compatibility" className="space-y-3">
              <StructureTabContent results={results} />
            </TabsContent>

            <TabsContent value="cross_browser" className="space-y-3">
              <CategoryHeader results={byCategory.compatibility} />
              {byCategory.compatibility.length === 0
                ? <EmptyState label="cross-browser" />
                : byCategory.compatibility.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="security" className="space-y-3">
              <CategoryHeader results={byCategory.security} />
              {byCategory.security.length === 0
                ? <EmptyState label="security" />
                : byCategory.security.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="others" className="space-y-3">
              <CategoryHeader results={byCategory.others} />
              {byCategory.others.length === 0
                ? <EmptyState label="other checks (SEO, Accessibility, Responsive, Visual)" />
                : <OthersTabContent results={byCategory.others} />}
            </TabsContent>
          </div>

          {!isLoggedIn && isLoggedIn !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[2px] z-10 rounded-xl border border-dashed border-slate-300">
              <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-200 text-center max-w-sm mx-4">
                <p className="text-sm text-muted-foreground mb-6">Sign in to your account to view full audit details.</p>
                <div className="flex flex-col gap-1">
                  <Button onClick={() => window.location.href = "/login"} className="w-full bg-blue-600 hover:bg-blue-700">Sign In</Button>
                  <Button variant="ghost" onClick={() => window.location.href = "/register"} className="w-full">Create Free Account</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
