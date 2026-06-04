"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, AlertTriangle, Download, Globe, Clock, Monitor, Smartphone, Tablet, Wrench, RefreshCw, ListTodo, FileSearch, HelpCircle, Shield } from "lucide-react";
import type { TestReport, TestResult, Severity, ResultStatus, Category } from "@/types";
interface ReportViewProps { report: TestReport; }

export function ReportView({ report }: ReportViewProps) {
  const { run, results, screenshots } = report;
  const totalFails = results.filter((r) => r.status === "fail").length;
  const totalWarnings = results.filter((r) => r.status === "warning").length;
  const overallPass = totalFails === 0;
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

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
  };

  const priorityFixes = results
    .filter(r => r.status !== "pass" && (r.severity === "critical" || r.severity === "medium"))
    .sort((a, b) => {
      if (a.severity === "critical" && b.severity !== "critical") return -1;
      if (a.severity !== "critical" && b.severity === "critical") return 1;
      return 0;
    })
    .slice(0, 5);

  async function downloadPDF() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── helpers ──────────────────────────────────────────────────────────
    function newPage() {
      doc.addPage();
      y = 15;
    }
    function checkY(needed = 10) {
      if (y + needed > 280) newPage();
    }
    function setColor(status: string) {
      if (status === "pass") doc.setTextColor(22, 163, 74);
      else if (status === "fail") doc.setTextColor(220, 38, 38);
      else if (status === "warning") doc.setTextColor(202, 138, 4);
      else doc.setTextColor(30, 30, 30);
    }
    function resetColor() { doc.setTextColor(30, 30, 30); }

    // ── Cover page ───────────────────────────────────────────────────────
    // Header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("QA Test Report", margin, 18);
    doc.setFontSize(10);
    doc.text("Automated Quality Assurance Analysis", margin, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 33);
    resetColor();
    y = 50;

    // URL box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("TESTED URL", margin + 4, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const urlLines = doc.splitTextToSize(run.page_url, contentW - 8);
    doc.text(urlLines, margin + 4, y + 12);
    y += 24;

    // Overall Score (if available)
    if (run.overall_score !== null) {
      const scoreColor = run.overall_score >= 90 ? [22, 163, 74] :
        run.overall_score >= 70 ? [202, 138, 4] :
          run.overall_score >= 50 ? [234, 88, 12] : [220, 38, 38];
      doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2], 0.1);
      doc.roundedRect(margin, y, contentW, 24, 2, 2, "F");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("OVERALL QUALITY SCORE", margin + 4, y + 6);
      doc.setFontSize(32);
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${run.overall_score}/100`, margin + 4, y + 18);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const scoreLabel = run.overall_score >= 90 ? "Excellent" :
        run.overall_score >= 70 ? "Good" :
          run.overall_score >= 50 ? "Fair" : "Poor";
      doc.text(scoreLabel, margin + 50, y + 18);
      resetColor();
      y += 30;
    }

    // Overall status
    const overallStatus = totalFails === 0 ? "PASSED" : "FAILED";
    doc.setFillColor(totalFails === 0 ? 220 : 254, totalFails === 0 ? 252 : 226, totalFails === 0 ? 231 : 226);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
    doc.setFontSize(11);
    setColor(totalFails === 0 ? "pass" : "fail");
    doc.text(`Overall Status: ${overallStatus}`, margin + 4, y + 9);
    resetColor();
    y += 20;

    // Summary stats
    doc.setFontSize(12);
    doc.text("Summary", margin, y);
    y += 6;
    doc.setFontSize(9);
    const stats = [
      { label: "Total Checks", value: String(results.length) },
      { label: "Passed", value: String(results.filter(r => r.status === "pass").length), color: "pass" },
      { label: "Failed", value: String(totalFails), color: "fail" },
      { label: "Warnings", value: String(totalWarnings), color: "warning" },
    ];
    const colW = contentW / 4;
    stats.forEach((s, i) => {
      const x = margin + i * colW;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, colW - 2, 16, 1, 1, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text(s.label, x + 3, y + 5);
      if (s.color) setColor(s.color); else resetColor();
      doc.setFontSize(14);
      doc.text(s.value, x + 3, y + 13);
      resetColor();
    });
    y += 22;

    // Category summary table
    doc.setFontSize(12);
    doc.text("Results by Category", margin, y);
    y += 6;
    const cats = [
      { key: "performance", label: "Performance" },
      { key: "broken_links", label: "Broken Links" },
      { key: "compatibility", label: "Cross-Browser" },
      { key: "security", label: "Security" },
      { key: "seo", label: "SEO" },
      { key: "quality", label: "Page Quality" },
      { key: "others", label: "Others" },
    ] as const;

    // Table header
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("Category", margin + 2, y + 5);
    doc.text("Total", margin + 70, y + 5);
    doc.text("Passed", margin + 90, y + 5);
    doc.text("Failed", margin + 115, y + 5);
    doc.text("Warnings", margin + 140, y + 5);
    doc.text("Status", margin + 165, y + 5);
    y += 7;

    cats.forEach((cat, idx) => {
      const items = byCategory[cat.key];
      if (items.length === 0) return;
      const passes = items.filter(r => r.status === "pass").length;
      const fails = items.filter(r => r.status === "fail").length;
      const warns = items.filter(r => r.status === "warning").length;
      const rowStatus = fails > 0 ? "fail" : warns > 0 ? "warning" : "pass";

      doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
      doc.rect(margin, y, contentW, 7, "F");
      resetColor();
      doc.setFontSize(8);
      doc.text(cat.label, margin + 2, y + 5);
      doc.text(String(items.length), margin + 70, y + 5);
      setColor("pass"); doc.text(String(passes), margin + 90, y + 5);
      setColor("fail"); doc.text(String(fails), margin + 115, y + 5);
      setColor("warning"); doc.text(String(warns), margin + 140, y + 5);
      setColor(rowStatus);
      doc.text(rowStatus.toUpperCase(), margin + 165, y + 5);
      resetColor();
      y += 7;
    });
    y += 8;

    // ── Detailed results per category ────────────────────────────────────
    for (const cat of cats) {
      const items = byCategory[cat.key];
      if (items.length === 0) continue;

      checkY(20);
      // Category header
      doc.setFillColor(37, 99, 235);
      doc.rect(margin, y, contentW, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(cat.label + " Checks", margin + 3, y + 6.5);
      resetColor();
      y += 13;

      for (const item of items) {
        checkY(18);
        const statusIcon = item.status === "pass" ? "✓" : item.status === "fail" ? "✗" : "⚠";
        const bgR = item.status === "pass" ? 240 : item.status === "fail" ? 254 : 254;
        const bgG = item.status === "pass" ? 253 : item.status === "fail" ? 226 : 249;
        const bgB = item.status === "pass" ? 244 : item.status === "fail" ? 226 : 195;

        // Left accent bar
        setColor(item.status);
        doc.setFillColor(item.status === "pass" ? 22 : item.status === "fail" ? 220 : 202,
          item.status === "pass" ? 163 : item.status === "fail" ? 38 : 138,
          item.status === "pass" ? 74 : item.status === "fail" ? 38 : 4);
        doc.rect(margin, y, 2, 14, "F");

        // Row background
        doc.setFillColor(bgR, bgG, bgB);
        doc.rect(margin + 2, y, contentW - 2, 14, "F");

        // Check name
        resetColor();
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${statusIcon} ${item.check_name}`, margin + 5, y + 5);
        doc.setFont("helvetica", "normal");

        // Severity badge
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`[${item.severity.toUpperCase()}]`, margin + contentW - 20, y + 5);

        // Message
        doc.setFontSize(8);
        resetColor();
        const msgLines = doc.splitTextToSize(item.message, contentW - 25);
        doc.text(msgLines.slice(0, 1), margin + 5, y + 10);
        y += 15;

        // Fix recommendation
        if (item.fix_recommendation && item.status !== "pass") {
          checkY(14);
          doc.setFillColor(239, 246, 255);
          doc.rect(margin + 2, y, contentW - 2, 12, "F");
          doc.setFontSize(7);
          doc.setTextColor(37, 99, 235);
          doc.text("HOW TO FIX:", margin + 5, y + 4);
          doc.setTextColor(30, 58, 138);
          const fixLines = doc.splitTextToSize(item.fix_recommendation, contentW - 20);
          doc.text(fixLines.slice(0, 2), margin + 5, y + 9);
          resetColor();
          y += 14;
        }
        y += 2;
      }
      y += 4;
    }

    // ── Footer on last page ──────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 287, 210, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text("QA Testing System — Automated Report", margin, 293);
      doc.text(`Page ${i} of ${pageCount}`, 180, 293);
    }

    doc.save(`qa-report-${run.id.slice(0, 8)}.pdf`);
  }

  const SUMMARY_CATS = [
    { key: "performance", label: "Performance" },
    { key: "broken_links", label: "Links" },
    { key: "compatibility", label: "Browser" },
    { key: "security", label: "Security" },
    { key: "seo", label: "SEO" },
    { key: "quality", label: "Quality" },
    { key: "others", label: "Others" },
  ] as const;

  const [pdfLoading, setPdfLoading] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);
  const router = useRouter();

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      await downloadPDF();
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleRerun() {
    setRerunLoading(true);
    try {
      // Create a new test with the same URL and default settings
      const response = await fetch("/api/test/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: run.page_url,
          viewports: ["desktop", "mobile", "tablet"],
          checks: {
            performance: true,
            broken_links: true,
            compatibility: true,
            security: true,
            others: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start rerun");
      }

      const { testRunId } = await response.json();
      // Redirect to the new test report
      router.push(`/test/${testRunId}`);
    } catch (error) {
      console.error("Rerun error:", error);
      alert(error instanceof Error ? error.message : "Failed to rerun test");
    } finally {
      setRerunLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          {/* <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm break-all">{run.page_url}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />{new Date(run.created_at).toLocaleString()}
          </div> */}
          <div className="flex items-center gap-2 flex-wrap">
            <RunStatusBadge status={run.status} />
            {run.status === "completed" && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${overallPass ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                {overallPass ? "All checks passed" : `${totalFails} failure${totalFails !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {/* <Button variant="outline" size="sm" onClick={handleRerun} disabled={rerunLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${rerunLoading ? "animate-spin" : ""}`} />
            {rerunLoading ? "Starting..." : "Rerun Test"}
          </Button> */}
          {/* <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={pdfLoading} className="gap-2">
            <Download className="h-4 w-4" />
            {pdfLoading ? "Generating PDF..." : "Download PDF"}
          </Button> */}
        </div>
      </div>

      {/* Priority Fixes (To-Do List) */}
      {/* {priorityFixes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-900/10">
          <CardHeader className="py-3 px-4 flex flex-row items-center gap-2 border-b border-amber-100 dark:border-amber-900/30">
            <ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-100 uppercase tracking-wider">
              Priority Fixes (To-Do List)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {priorityFixes.map((fix, idx) => (
                <div key={fix.id} className="flex gap-3 items-start group">
                  <div className="mt-0.5 shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
                      {fix.check_name}
                      <SeverityBadge severity={fix.severity} />
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      {fix.message}
                    </p>
                    {fix.fix_recommendation && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-500 italic">
                        Tip: {fix.fix_recommendation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Overall Score Card */}
      {/* {run.status === "completed" && run.overall_score !== null && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground mb-1">Overall Quality Score</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl sm:text-4xl md:text-5xl font-bold ${run.overall_score >= 90 ? "text-green-600" :
                    run.overall_score >= 70 ? "text-yellow-600" :
                      run.overall_score >= 50 ? "text-orange-600" :
                        "text-red-600"
                    }`}>
                    {run.overall_score}
                  </span>
                  <span className="text-xl sm:text-2xl text-muted-foreground">/100</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {run.overall_score >= 90 ? "Excellent - Production ready" :
                    run.overall_score >= 70 ? "Good - Minor improvements needed" :
                      run.overall_score >= 50 ? "Fair - Several issues to address" :
                        "Poor - Critical issues require attention"}
                </p>
              </div>
              <div className="flex-1 max-w-md">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Score Breakdown</span>
                    <span>{results.filter(r => r.status === "pass").length}/{results.length} checks passed</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${run.overall_score >= 90 ? "bg-green-600" :
                        run.overall_score >= 70 ? "bg-yellow-600" :
                          run.overall_score >= 50 ? "bg-orange-600" :
                            "bg-red-600"
                        }`}
                      style={{ width: `${run.overall_score}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                      <span className="text-muted-foreground">90-100: Excellent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-600" />
                      <span className="text-muted-foreground">70-89: Good</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-orange-600" />
                      <span className="text-muted-foreground">50-69: Fair</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-600" />
                      <span className="text-muted-foreground">0-49: Poor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
      } */}

      {/* Overall Score Card */}
      {/* Overall Score Card */}
      {run.status === "completed" && run.overall_score !== null && (() => {
        const perfResults = results.filter(r => r.category === "performance");

        function extractMetric(key: string): string | null {
          const candidates = [
            ...perfResults.filter(r => r.check_name.toLowerCase().includes("desktop")),
            ...perfResults,
          ];
          for (const r of candidates) {
            const regex = new RegExp(`${key}[:\\s]+([\\d.]+\\s*(?:ms|s)?)`, "i");
            const m = r.message.match(regex);
            if (m) return m[1].trim();
          }
          return null;
        }

        let perfScore: number | null = null;
        let structureScore: number | null = null;
        for (const r of perfResults) {
          if (!perfScore) {
            const m = r.message.match(/performance[:\s]+(\d+)/i) || r.message.match(/score[:\s]+(\d+)/i);
            if (m) perfScore = parseInt(m[1]);
          }
          if (!structureScore) {
            const m = r.message.match(/(?:structure|best.practices|accessibility)[:\s]+(\d+)/i);
            if (m) structureScore = parseInt(m[1]);
          }
        }
        if (!perfScore) perfScore = run.overall_score;
        if (!structureScore) structureScore = run.overall_score;

        const lcp = extractMetric("LCP") ?? "–";
        const tbt = extractMetric("TBT") ?? "–";
        const cls = extractMetric("CLS") ?? "–";

        const grade = perfScore >= 90 ? "A" : perfScore >= 80 ? "B" : perfScore >= 70 ? "C" : perfScore >= 60 ? "D" : "F";

        // Grade uses a green→yellow gradient like GTmetrix
        const gradeGradient =
          grade === "A" ? "linear-gradient(135deg, #4CAF50, #8BC34A)" :
            grade === "B" ? "linear-gradient(135deg, #8BC34A, #CDDC39)" :
              grade === "C" ? "linear-gradient(135deg, #FFC107, #FF9800)" :
                grade === "D" ? "linear-gradient(135deg, #FF9800, #FF5722)" :
                  "linear-gradient(135deg, #F44336, #B71C1C)";

        function scoreColor(v: number) {
          return v >= 90 ? "#4CAF50" : v >= 70 ? "#FF9800" : "#F44336";
        }

        function metricColor(key: string, val: string) {
          const num = parseFloat(val);
          if (isNaN(num)) return "#aaa";
          if (key === "LCP") return num <= 2.5 ? "#4CAF50" : num <= 4 ? "#FF9800" : "#F44336";
          if (key === "TBT") return num <= 200 ? "#4CAF50" : num <= 600 ? "#FF9800" : "#F44336";
          if (key === "CLS") return num <= 0.1 ? "#4CAF50" : num <= 0.25 ? "#FF9800" : "#F44336";
          return "#aaa";
        }

        const QuestionMark = ({ title }: { title: string }) => (
          <span
            title={title}
            className="inline-flex items-center justify-center cursor-help ml-1"
            style={{
              width: 15, height: 15, borderRadius: "50%",
              border: "1.5px solid #b0bec5",
              fontSize: 9, color: "#90a4ae", fontWeight: 700,
              verticalAlign: "middle", lineHeight: 1,
            }}
          >?</span>
        );

        return (
          <div className="flex flex-col sm:flex-row gap-6">

            {/* ── GTmetrix Grade Card ── */}
            <div className="flex-1">
              {/* Title above card */}
              <p className="text-sm md:text-2xl lg:text-3xl font-semibold mb-2" style={{ color: "#3388cc" }}>
                Performance Grade <QuestionMark title="Overall grade based on Performance and Structure scores" />
              </p>
              {/* White card */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-stretch" style={{ minHeight: 90 }}>

                  {/* Grade letter */}
                  <div className="flex items-center justify-center px-7"
                    style={{ borderRight: "1px solid #e8edf2" }}>
                    <span
                      className="font-black select-none leading-none"
                      style={{
                        fontSize: 80,
                        background: gradeGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {grade}
                    </span>
                  </div>

                  {/* Performance */}
                  <div className="flex flex-col justify-center px-8"
                    style={{ borderRight: "1px solid #e8edf2" }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>
                      Performance <QuestionMark title="Lighthouse Performance Score" />
                    </p>
                    <p className="font-bold leading-none" style={{ fontSize: 36, color: scoreColor(perfScore!) }}>
                      {perfScore}%
                    </p>
                  </div>

                  {/* Structure */}
                  <div className="flex flex-col justify-center px-8">
                    <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>
                      Structure <QuestionMark title="Best Practices / Structure Score" />
                    </p>
                    <p className="font-bold leading-none" style={{ fontSize: 36, color: scoreColor(structureScore!) }}>
                      {structureScore}%
                    </p>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Web Vitals Card ── */}
            <div className="flex-1">
              {/* Title above card */}
              <p className="text-sm md:text-2xl lg:text-3xl font-semibold mb-2" style={{ color: "#3388cc" }}>
                Web Vitals <QuestionMark title="Core Web Vitals measured by Lighthouse" />
              </p>
              {/* White card */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-stretch" style={{ minHeight: 90 }}>

                  {[
                    { key: "LCP", value: lcp, hint: "Largest Contentful Paint — measures loading performance" },
                    { key: "TBT", value: tbt, hint: "Total Blocking Time — measures interactivity" },
                    { key: "CLS", value: cls, hint: "Cumulative Layout Shift — measures visual stability" },
                  ].map(({ key, value, hint }, idx) => (
                    <div
                      key={key}
                      className="flex-1 flex flex-col justify-center px-6"
                      style={{ borderRight: idx < 2 ? "1px solid #e8edf2" : undefined }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color: "#78909c" }}>
                        {key} <QuestionMark title={hint} />
                      </p>
                      <p className="font-bold leading-none" style={{ fontSize: 36, color: metricColor(key, value) }}>
                        {value}
                      </p>
                    </div>
                  ))}

                </div>
              </div>
            </div>

          </div>
        );
      })()}

      {/* Summary grid */}
      {
        run.status === "completed" && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SUMMARY_CATS.map(({ key, label }) => {
              const items = byCategory[key];
              const fails = items.filter((r) => r.status === "fail").length;
              const warns = items.filter((r) => r.status === "warning").length;
              return (
                <Card key={key} className="text-center">
                  <CardContent className="pt-3 pb-2 px-2">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-lg sm:text-xl font-bold">
                      {fails > 0 ? <span className="text-red-500">{fails}</span>
                        : warns > 0 ? <span className="text-yellow-500">{warns}</span>
                          : <span className="text-green-500">{items.length}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fails > 0 ? `${fails} fail${fails !== 1 ? "s" : ""}` : warns > 0 ? `${warns} warn` : items.length === 0 ? "skipped" : "pass"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      }

      {/* Tabs — 5 categories */}
      <Tabs defaultValue="performance">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
          <TabsTrigger value="broken_links" className="text-xs">Broken Links</TabsTrigger>
          <TabsTrigger value="compatibility" className="text-xs">Cross-Browser</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
          <TabsTrigger value="others" className="text-xs">Others</TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <div className={!isLoggedIn && isLoggedIn !== null ? "blur-md pointer-events-none select-none" : ""}>
            <TabsContent value="performance" className="space-y-3">
              <CategoryHeader results={byCategory.performance} />
              {byCategory.performance.length === 0 ? (
                <EmptyState label="performance" />
              ) : (
                <PerformanceTabContent results={byCategory.performance} />
              )}
            </TabsContent>

            <TabsContent value="broken_links" className="space-y-3">
              <CategoryHeader results={byCategory.broken_links} />
              {byCategory.broken_links.length === 0 ? <EmptyState label="broken links" /> : byCategory.broken_links.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="compatibility" className="space-y-3">
              <CategoryHeader results={byCategory.compatibility} />
              {byCategory.compatibility.length === 0 ? <EmptyState label="cross-browser" /> : byCategory.compatibility.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="security" className="space-y-3">
              <CategoryHeader results={byCategory.security} />
              {byCategory.security.length === 0 ? <EmptyState label="security" /> : byCategory.security.map((r) => <ResultCard key={r.id} result={r} />)}
            </TabsContent>

            <TabsContent value="others" className="space-y-3">
              <CategoryHeader results={byCategory.others} />
              {byCategory.others.length === 0 ? (
                <EmptyState label="other checks (SEO, Accessibility, Responsive, Visual)" />
              ) : (
                <OthersTabContent results={byCategory.others} />
              )}
            </TabsContent>
          </div>

          {!isLoggedIn && isLoggedIn !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-[2px] z-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-sm mx-4">
                {/* <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4"> */}
                {/* <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" /> */}
                {/* </div> */}
                {/* <h3 className="text-xl font-bold mb-2">Detailed Results Locked</h3> */}
                <p className="text-sm text-muted-foreground mb-6">
                  Sign in to your account to view full audit details.
                </p>
                <div className="flex flex-col gap-1">
                  <Button onClick={() => window.location.href = "/login"} className="w-full bg-blue-600 hover:bg-blue-700">
                    Sign In
                  </Button>
                  <Button variant="ghost" onClick={() => window.location.href = "/register"} className="w-full">
                    Create Free Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div >
  );
}

function CategoryHeader({ results }: { results: TestResult[] }) {
  const passes = results.filter((r) => r.status === "pass").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  if (results.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground pb-1">
      <span className="text-green-600 font-medium">{passes} passed</span>
      {fails > 0 && <span className="text-red-600 font-medium">{fails} failed</span>}
      {warnings > 0 && <span className="text-yellow-600 font-medium">{warnings} warnings</span>}
    </div>
  );
}

function ResultCard({ result }: { result: TestResult }) {
  const [open, setOpen] = useState(false);
  const hasFix = !!result.fix_recommendation && result.status !== "pass";
  return (
    <Card className={`border-l-4 ${result.status === "pass" ? "border-l-green-500" : result.status === "fail" ? "border-l-red-500" : "border-l-yellow-500"}`}>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <StatusIcon status={result.status} />
            <div className="min-w-0">
              <p className="text-[13px] sm:text-sm font-medium break-words">{result.check_name}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 break-words">{result.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0 pl-7 sm:pl-0">
            <SeverityBadge severity={result.severity} />
            {hasFix && (
              <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="gap-1 text-xs h-7">
                <Wrench className="h-3 w-3" />How to fix
              </Button>
            )}
          </div>
        </div>
        {open && hasFix && <div className="mt-3 pl-7 sm:pl-0"><FixCard recommendation={result.fix_recommendation!} /></div>}
      </CardContent>
    </Card>
  );
}

function FixCard({ recommendation }: { recommendation: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
        <Wrench className="h-3 w-3" />How to fix
      </p>
      <p className="text-xs text-blue-800 dark:text-blue-300">{recommendation}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: ResultStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[severity]}`}>{severity}</span>;
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    running: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] || map.pending}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function ViewportIcon({ viewport }: { viewport: string }) {
  if (viewport === "mobile") return <Smartphone className="h-4 w-4" />;
  if (viewport === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground text-sm">
        No {label} checks were run.
      </CardContent>
    </Card>
  );
}

function PerformanceTabContent({ results }: { results: TestResult[] }) {
  // Group performance results by viewport
  const viewports = ["Mobile", "Desktop", "Tablet"];

  const byViewport = {
    mobile: results.filter(r => r.check_name.includes("(Mobile)")),
    desktop: results.filter(r => r.check_name.includes("(Desktop)")),
    tablet: results.filter(r => r.check_name.includes("(Tablet)")),
    other: results.filter(r => !viewports.some(v => r.check_name.includes(`(${v})`))),
  };

  return (
    <div className="space-y-8">
      {byViewport.mobile.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Mobile Performance
            </h3>
            <span className="text-xs text-muted-foreground">
              ({byViewport.mobile.filter(r => r.status === "pass").length}/{byViewport.mobile.length} passed)
            </span>
          </div>
          {byViewport.mobile.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {byViewport.desktop.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Desktop Performance
            </h3>
            <span className="text-xs text-muted-foreground">
              ({byViewport.desktop.filter(r => r.status === "pass").length}/{byViewport.desktop.length} passed)
            </span>
          </div>
          {byViewport.desktop.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {byViewport.tablet.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Tablet className="h-4 w-4" /> Tablet Performance
            </h3>
            <span className="text-xs text-muted-foreground">
              ({byViewport.tablet.filter(r => r.status === "pass").length}/{byViewport.tablet.length} passed)
            </span>
          </div>
          {byViewport.tablet.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {byViewport.other.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">Concurrent Users & Throughput</h3>
          </div>
          {byViewport.other.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
    </div>
  );
}

function OthersTabContent({ results }: { results: TestResult[] }) {
  // Categorize "others" results by sub-category
  const seoChecks = ["Page Title", "Meta Description", "Open Graph Tags", "Canonical URL", "HTML Lang Attribute", "H1 Heading", "Structured Data (JSON-LD)"];
  const accessibilityChecks = ["axe-core Scan", "Keyboard Navigable Elements"];
  const responsiveChecks = ["Viewport Meta Tag", "Horizontal Overflow", "Font Size", "Touch Target Size"];
  const visualChecks = ["Screenshot"];

  const categorizeResult = (result: TestResult) => {
    if (seoChecks.some(check => result.check_name.includes(check))) return "seo";
    if (accessibilityChecks.some(check => result.check_name.includes(check))) return "accessibility";
    if (responsiveChecks.some(check => result.check_name.includes(check))) return "responsive";
    if (visualChecks.some(check => result.check_name.includes(check))) return "visual";
    // Check for axe-core violation IDs (they don't match the check names above)
    if (result.check_name.includes("element") || result.check_name.includes("aria") || result.check_name.includes("color") || result.check_name.includes("label")) {
      return "accessibility";
    }
    return "other";
  };

  const bySubCategory = {
    seo: results.filter((r: TestResult) => categorizeResult(r) === "seo" || r.category === "seo"),
    quality: results.filter((r: TestResult) => r.category === "quality"),
    accessibility: results.filter((r: TestResult) => categorizeResult(r) === "accessibility"),
    responsive: results.filter((r: TestResult) => categorizeResult(r) === "responsive"),
    visual: results.filter((r: TestResult) => categorizeResult(r) === "visual"),
    other: results.filter((r: TestResult) => categorizeResult(r) === "other"),
  };

  return (
    <div className="space-y-6">
      {/* SEO Section */}
      {bySubCategory.seo.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <FileSearch className="h-4 w-4" /> SEO & Meta Data
            </h3>
            <span className="text-xs text-muted-foreground">
              ({bySubCategory.seo.filter(r => r.status === "pass").length}/{bySubCategory.seo.length} passed)
            </span>
          </div>
          {bySubCategory.seo.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {/* Page Quality Section */}
      {bySubCategory.quality.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Page Quality & Content
            </h3>
            <span className="text-xs text-muted-foreground">
              ({bySubCategory.quality.filter(r => r.status === "pass").length}/{bySubCategory.quality.length} passed)
            </span>
          </div>
          {bySubCategory.quality.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {/* Accessibility Section */}
      {bySubCategory.accessibility.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">♿ Accessibility Checks</h3>
            <span className="text-xs text-muted-foreground">
              ({bySubCategory.accessibility.filter(r => r.status === "pass").length}/{bySubCategory.accessibility.length} passed)
            </span>
          </div>
          {bySubCategory.accessibility.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {/* Responsive Section */}
      {bySubCategory.responsive.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">📱 Responsive Design Checks</h3>
            <span className="text-xs text-muted-foreground">
              ({bySubCategory.responsive.filter((r: TestResult) => r.status === "pass").length}/{bySubCategory.responsive.length} passed)
            </span>
          </div>
          {bySubCategory.responsive.map((r: TestResult) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      {/* Visual Section */}
      {bySubCategory.visual.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">📸 Visual Screenshots</h3>
            <span className="text-xs text-muted-foreground">
              ({bySubCategory.visual.length} screenshot{bySubCategory.visual.length !== 1 ? 's' : ''})
            </span>
          </div>
          {bySubCategory.visual.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
    </div>
  );
}

