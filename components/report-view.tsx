"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, AlertTriangle, Download, Globe, Clock, Monitor, Smartphone, Tablet, Wrench, RefreshCw, ListTodo, FileSearch, HelpCircle, Shield, ChevronDown, Layers, Info, Square } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { TestReport, TestResult, Severity, ResultStatus, Category, PageSize, CwvEntry } from "@/types";
interface ReportViewProps { report: TestReport; }

export function ReportView({ report }: ReportViewProps) {
  const { run, results, screenshots } = report;
  const totalFails = results.filter((r) => r.status === "fail").length;
  const totalWarnings = results.filter((r) => r.status === "warning").length;
  const overallPass = totalFails === 0;
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  console.log("Report :", report)
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

      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          <TabsTrigger value="summary" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Summary</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Performance</TabsTrigger>
          <TabsTrigger value="inner_pages" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Inner Pages</TabsTrigger>
          <TabsTrigger value="broken_links" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Broken Links</TabsTrigger>
          <TabsTrigger value="compatibility" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Structure</TabsTrigger>
          <TabsTrigger value="security" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Security</TabsTrigger>
          <TabsTrigger value="others" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">CrUX</TabsTrigger>
          <TabsTrigger value="waterfall" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all opacity-50 cursor-not-allowed">Waterfall</TabsTrigger>
          <TabsTrigger value="video" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all opacity-50 cursor-not-allowed">Video</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all opacity-50 cursor-not-allowed">History</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all opacity-50 cursor-not-allowed">Alerts</TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <div className={!isLoggedIn && isLoggedIn !== null ? "blur-md pointer-events-none select-none" : ""}>
            <TabsContent value="summary" className="space-y-6">
              <SummaryTabContent report={report} />
            </TabsContent>

            <TabsContent value="performance" className="space-y-3">
              <CategoryHeader results={byCategory.performance} />
              {byCategory.performance.length === 0 ? (
                <EmptyState label="performance" />
              ) : (
                <PerformanceTabContent results={byCategory.performance} />
              )}
            </TabsContent>

            <TabsContent value="inner_pages" className="space-y-3">
              <InnerPagesTabContent results={results} />
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

function SummaryTabContent({ report }: { report: TestReport }) {
  const { results, screenshots, run } = report;
  const [activeIssueFilter, setActiveIssueFilter] = useState('All');
  const performance = results.filter((r) => r.category === "performance");
  const pagesize = performance.filter((r) => r.check_name === "Page Size Breakdown");
  console.log("Page Size Breakdown :", pagesize)
  const requests = performance.filter((r) => r.check_name === "Page Request Breakdown");
  console.log("Requests Breakdown :", requests)

  // Extract metrics
  const getMetric = (name: string) => {
    // Search for both desktop and generic metrics, excluding mobile ones for summary
    const r = results.find(res =>
      (res.check_name.toLowerCase().includes(name.toLowerCase()) ||
        res.check_name.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ''))) &&
      !res.check_name.toLowerCase().includes("mobile")
    );
    if (!r) return null;
    const match = r.message.match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const value = match[1];
    const unit = r.message.includes('ms') ? 'ms' : (r.message.includes('s') && !r.message.includes('score')) ? 's' : '';
    return value + unit;
  };

  const metrics = {
    ttfb: getMetric("Time to First Byte") || getMetric("TTFB") || "0.8s",
    fcp: getMetric("First Contentful Paint") || getMetric("FCP") || "1.5s",
    lcp: getMetric("Largest Contentful Paint") || getMetric("LCP") || "3.3s",
    tbt: getMetric("Total Blocking Time") || getMetric("TBT") || "120ms",
    cls: getMetric("Cumulative Layout Shift") || getMetric("CLS") || "0.01",
    tti: getMetric("Time to Interactive") || getMetric("TTI") || "4.4s",
    onload: getMetric("Onload Time") || "5.7s",
    fullyLoaded: getMetric("Fully Loaded Time") || "6.0s",
  };

  const subMetrics = {
    redirect: getMetric("Redirect Duration") || "0ms",
    connect: getMetric("Connection Duration") || "44ms",
    backend: getMetric("Backend Duration") || "2.1s",
  };

  const parseTimeToSeconds = (timeStr: string): number => {
    const match = timeStr.match(/(\d+(\.\d+)?)/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    return timeStr.toLowerCase().includes('ms') ? val / 1000 : val;
  };

  // Dynamically compute timeline max — no padding so markers align exactly with labels
  const allMetricTimes = [
    metrics.ttfb, metrics.fcp, metrics.lcp, metrics.tti,
    metrics.onload, metrics.fullyLoaded,
  ].map(parseTimeToSeconds);
  // Round up to next whole second, min 6s
  const roundedMax = Math.max(6, Math.ceil(Math.max(...allMetricTimes)));

  const getPercentage = (timeStr: string): number => {
    const time = parseTimeToSeconds(timeStr);
    return Math.min((time / roundedMax) * 100, 100);
  };

  // 0.1s-granularity subdivisions — one tick per 0.1s
  const tickCount = roundedMax * 10; // e.g. 60 ticks for 6s
  // Whole-second labels for display
  const timeLabels = Array.from({ length: roundedMax + 1 }, (_, i) => i);

  return (
    <div className="space-y-12 py-4">
      {/* Speed Visualization */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-medium text-slate-700">Speed Visualization</h2>
          <HelpCircle className="h-4 w-4 text-slate-300" />
        </div>

        <div className="relative pt-8 pb-40">
          {/* Time labels — absolutely positioned to match marker math exactly */}
          <div className="relative h-6 mb-1">
            {timeLabels.map((t) => (
              <span
                key={t}
                className="absolute text-[11px] text-slate-400 -translate-x-1/2"
                style={{ left: `${(t / roundedMax) * 100}%` }}
              >
                {t}s
              </span>
            ))}
          </div>
          {/* Sub-second tick marks (every 0.1s) */}
          <div className="relative h-3 border-b border-slate-200 mb-2">
            {Array.from({ length: tickCount + 1 }, (_, i) => {
              const isMajor = i % 10 === 0;
              return (
                <div
                  key={i}
                  className={`absolute bottom-0 w-[1px] ${isMajor ? 'h-3 bg-slate-300' : 'h-1.5 bg-slate-200'
                    }`}
                  style={{ left: `${(i / tickCount) * 100}%` }}
                />
              );
            })}
          </div>

          {/* Frames Container */}
          <div className="relative">
            <div className="flex gap-1 items-end relative">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((_, i) => (
                <div key={i} className="flex-1 h-20 border border-slate-200 bg-slate-50/30 rounded-sm overflow-hidden relative group">
                  {/* Dynamic Screenshot Logic (Simplified for now) */}
                  {i > (getPercentage(metrics.fcp) / 10) && screenshots.find(s => s.viewport === "desktop") && (
                    <img
                      src={screenshots.find(s => s.viewport === "desktop")?.image_url}
                      alt="Frame"
                      className="w-full h-full object-cover opacity-90"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Overlapping Markers Layer */}
            <div className="absolute inset-0 pointer-events-none">
              {/* TTFB Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#7c8da5] z-10" style={{ left: `${getPercentage(metrics.ttfb)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#7c8da5]" />
                  <div className="min-w-[100px] shadow-sm">
                    <div className="bg-[#7c8da5] text-white text-[10px] py-1 px-2 rounded-t-sm font-medium border-b border-white/10 whitespace-nowrap">
                      TTFB: {metrics.ttfb}
                    </div>
                    <div className="bg-[#f2f4f7] text-slate-500 text-[9px] p-1.5 rounded-b-sm border border-[#7c8da5]/20 leading-tight whitespace-nowrap">
                      <div>Redirect: {subMetrics.redirect}</div>
                      <div>Connect: {subMetrics.connect}</div>
                      <div>Backend: {subMetrics.backend}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FCP Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#00aeef] z-10" style={{ left: `${getPercentage(metrics.fcp)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#00aeef]" />
                  <div className="bg-[#00aeef] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">First Contentful Paint: {metrics.fcp}</div>
                </div>
              </div>

              {/* LCP Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#2d5d85] z-10" style={{ left: `${getPercentage(metrics.lcp)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[75px] w-[1px] bg-[#2d5d85]" />
                  <div className="bg-[#2d5d85] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">Largest Contentful Paint: {metrics.lcp}</div>
                </div>
              </div>

              {/* TTI Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#a569bd] z-10" style={{ left: `${getPercentage(metrics.tti)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[15px] w-[1px] bg-[#a569bd]" />
                  <div className="min-w-[150px]">
                    <div className="bg-[#a569bd] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap text-center">Time to Interactive: {metrics.tti}</div>
                  </div>
                </div>
              </div>

              {/* Onload Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#9b2c5c] z-10" style={{ left: `${getPercentage(metrics.onload)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#9b2c5c]" />
                  <div className="bg-[#9b2c5c] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">Onload Time: {metrics.onload}</div>
                </div>
              </div>

              {/* Fully Loaded Marker */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#b03a2e] z-10" style={{ left: `${getPercentage(metrics.fullyLoaded)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[75px] w-[1px] bg-[#b03a2e]" />
                  <div className="bg-[#b03a2e] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">Fully Loaded Time: {metrics.fullyLoaded}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Issues and Page Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top Issues */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-slate-700">Top Issues</h2>
            <div className="flex bg-slate-100 p-0.5 rounded-sm">
              {['All', 'FCP', 'LCP', 'TBT', 'CLS'].map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveIssueFilter(m)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${activeIssueFilter === m ? "bg-[#2d5d85] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            These audits are identified as the top issues impacting <span className="font-bold">your performance</span>.
          </p>

          <div className="space-y-1">
            {!results ? (
              <p className="text-xs text-slate-500">
                No issues found
              </p>
            ) : (
              results
                .filter(r => {
                  const matchesCategory = r.status !== 'pass' && (r.category === 'performance' || r.category === 'quality');
                  if (!matchesCategory) return false;
                  if (activeIssueFilter === 'All') return true;
                  // Robust matching for abbreviations
                  const cn = r.check_name.toLowerCase();
                  const f = activeIssueFilter.toLowerCase();
                  return cn.includes(f) || (f === 'fcp' && cn.includes('contentful paint')) || (f === 'lcp' && cn.includes('largest contentful paint')) || (f === 'tbt' && cn.includes('blocking time')) || (f === 'cls' && cn.includes('layout shift'));
                })
                .slice(0, 20)
                .map((issue, i) => (
                  <Accordion type="single" collapsible key={issue.id}>
                    <AccordionItem value="item-1" className="border rounded-sm overflow-hidden bg-[#f9f9f9]">
                      <AccordionTrigger className="hover:no-underline py-0 px-0 group">
                        <div className="flex w-full items-stretch">
                          <div className={`w-28 flex items-center justify-center text-[11px] font-bold text-white shrink-0 transition-colors ${issue.severity === 'critical' ? 'bg-[#e74c3c] group-hover:bg-[#d63031]' : 'bg-[#a3c24d] group-hover:bg-[#8da33f]'
                            }`}>
                            {issue.severity === 'critical' ? 'High' : 'Med-Low'}
                          </div>
                          <div className="flex-1 flex items-center justify-between px-4 py-3 bg-white group-hover:bg-slate-50 transition-colors border-l border-slate-100">
                            <div className="flex flex-col items-start gap-1">
                              <div className="font-semibold text-[#2d5d85] text-[13px]">{issue.check_name}</div>
                              <div className="flex items-center gap-1.5">
                                {issue.check_name.toLowerCase().includes("paint") && <span className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">FCP</span>}
                                {issue.check_name.toLowerCase().includes("largest") && <span className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">LCP</span>}
                                {issue.check_name.toLowerCase().includes("blocking") && <span className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">TBT</span>}
                                {issue.check_name.toLowerCase().includes("shift") && <span className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">CLS</span>}
                                {issue.check_name.toLowerCase().includes("interactive") && <span className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">TTI</span>}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 font-mono pr-4">{issue.message}</div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-6 bg-white border-t border-slate-100">
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 leading-relaxed italic">{issue.message}</p>
                          {issue.fix_recommendation && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-xs text-blue-800 rounded-r shadow-sm">
                              <span className="font-bold block mb-1 text-[10px] uppercase tracking-wider text-blue-600">How to Fix:</span>
                              <p className="leading-normal">{issue.fix_recommendation}</p>
                            </div>
                          )}
                          {/* <div className="flex justify-end pt-2">
                            <Button size="sm" className="bg-[#2d76b9] hover:bg-[#235e95] text-xs font-bold gap-2 rounded-sm px-4">
                              Improve your site speed today
                            </Button>
                          </div> */}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))
            )}
          </div>

          <p className="text-[11px] text-slate-400 pt-2">
            Improving these audits seen here can help as a starting point for overall performance gains. <br />
            <button className="text-blue-500 hover:underline mt-1">See all Structure audits.</button>
          </p>
        </div>

        {/* Page Details */}
        <div className="lg:col-span-4 space-y-8">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-medium text-slate-700">Page Details</h2>
              <HelpCircle className="h-4 w-4 text-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 italic">Pages with smaller total sizes and fewer requests tend to load faster.</p>
          </section>

          <div className="space-y-8">
            {/* Load Time */}
            <div className="space-y-1">
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute top-0 bottom-0 left-[60%] w-[1px] bg-slate-300 z-10" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-slate-700">{metrics.fullyLoaded}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Fully Loaded Time</span>
              </div>
            </div>

            {/* Page Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <h3 className="text-sm font-bold text-slate-600">Total Page Size - {pagesize[0]?.page_size?.[0]?.total_size ?? 0} KB</h3>
              </div>
              <div className="flex h-12 rounded-sm overflow-hidden shadow-sm">
                <div className="bg-[#5c7a95] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">IMG</span>
                  <span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.image_size ?? 0}KB</span>
                </div>
                <div className="bg-[#6b8ba4] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">JS</span>
                  <span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.js_size ?? 0}KB</span>
                </div>
                <div className="bg-[#9b7e9b] w-20 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">Font</span>
                  <span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.font_size ?? 0}KB</span>
                </div>
                <div className="bg-[#9b99b6] w-16 flex flex-col items-center justify-center text-white">
                  <span className="text-[10px] font-bold">CSS</span>
                  <span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.css_size ?? 0}KB</span>
                </div>
              </div>
            </div>

            {/* Page Requests */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <h3 className="text-sm font-bold text-slate-600">Total Page Requests - {requests[0]?.page_request_size?.[0]?.total_requests ?? 0}</h3>
              </div>
              <div className="flex h-12 rounded-sm overflow-hidden shadow-sm">
                <div className="bg-[#5c7a95] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">IMG</span>
                  <span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.image_percent ?? 0}%</span>
                </div>
                <div className="bg-[#6b8ba4] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">JS</span>
                  <span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.js_percent ?? 0}%</span>
                </div>
                <div className="bg-[#9b99b6] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20">
                  <span className="text-[10px] font-bold">CSS</span>
                  <span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.css_percent ?? 0}%</span>
                </div>
                <div className="bg-[#b699b6] w-12 flex flex-col items-center justify-center text-white">
                  <span className="text-[10px] font-bold">Other</span>
                  <span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.other_percent ?? 0}%</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Look into reducing JavaScript, reducing web-fonts, and image optimization to ensure a lightweight and streamlined website.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceTabContent({ results }: { results: TestResult[] }) {
  console.log("results of performance", results);
  const [showDetails, setShowDetails] = useState(false);
  const viewports = ["Mobile", "Desktop", "Tablet"];

  const byViewport = {
    mobile: results.filter(r => r.check_name.toLowerCase().includes("(mobile)")),
    desktop: results.filter(r => r.check_name.toLowerCase().includes("(desktop)")),
    tablet: results.filter(r => r.check_name.toLowerCase().includes("(tablet)")),
    other: results.filter(r => !viewports.some(v => r.check_name.toLowerCase().includes(`(${v.toLowerCase()})`))),
  };

  const vpOrder = ["desktop", "tablet", "mobile"] as const;

  return (
    <div className="space-y-16 py-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium text-slate-700">Performance Metrics</h2>
          <p className="text-xs text-slate-400">The following metrics are generated using Lighthouse Performance data.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="metric-details" className="text-[10px] font-bold text-slate-400 uppercase">Metric details</Label>
          <Switch id="metric-details" checked={showDetails} onCheckedChange={setShowDetails} />
          <span className="text-[10px] font-bold text-slate-400 uppercase">{showDetails ? "ON" : "OFF"}</span>
        </div>
      </div>

      {vpOrder.map(vp => {
        const vpResults = byViewport[vp];
        if (vpResults.length === 0) return null;

        const mainMetrics = [
          "First Contentful Paint",
          "Speed Index",
          "Largest Contentful Paint",
          "Time to Interactive",
          "Total Blocking Time",
          "Cumulative Layout Shift"
        ];

        const timingMetrics = [
          "Redirect Duration",
          "Connection Duration",
          "Backend Duration",
          "Time to First Byte",
          "First Paint",
          "DOM Interactive Time",
          "DOM Content Loaded Time",
          "Onload Time",
          "Fully Loaded Time"
        ];

        const findMetric = (name: string) => {
          const n = name.toLowerCase();
          const searchTerms = [
            n,
            n.replace(/\s+/g, ''),
            n === "first contentful paint" ? "fcp" : null,
            n === "largest contentful paint" ? "lcp" : null,
            n === "total blocking time" ? "tbt" : null,
            n === "cumulative layout shift" ? "cls" : null,
            n === "time to interactive" ? "tti" : null,
            n === "speed index" ? "si" : null,
            n === "time to first byte" ? "ttfb" : null,
          ].filter(Boolean) as string[];

          return vpResults.find(r => {
            const cn = r.check_name.toLowerCase();
            return searchTerms.some(term => cn.includes(term));
          });
        };

        return (
          <div key={vp} className="space-y-12">
            <div className="flex items-center gap-2 border-b pb-2">
              {vp === "mobile" ? <Smartphone className="h-5 w-5 text-slate-400" /> : vp === "tablet" ? <Tablet className="h-5 w-5 text-slate-400" /> : <Monitor className="h-5 w-5 text-slate-400" />}
              <h3 className="text-lg font-semibold text-slate-600 capitalize">{vp} Performance</h3>
            </div>

            {/* Major Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mainMetrics.map(name => {
                const res = findMetric(name);
                return <PerformanceMetricCard key={name} name={name} result={res} showDetails={showDetails} />;
              })}
            </div>

            {/* Browser Timings */}
            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-slate-700">Browser Timings</h3>
                <p className="text-xs text-slate-400">These timings are milestones reported by the browser.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {timingMetrics.map(name => {
                  const res = findMetric(name);
                  return <BrowserTimingCard key={name} name={name} result={res} />;
                })}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceMetricCard({ name, result, showDetails }: { name: string, result?: TestResult, showDetails: boolean }) {
  const rawValue = result?.message || "";
  const match = rawValue.match(/(\d+(\.\d+)?)\s*(ms|s|%|)/i);
  const value = match ? match[1] : "—";
  const unit = match ? match[3] : (name.includes('Shift') ? '' : 's');
  const num = parseFloat(value);

  const getStatus = () => {
    if (!result) return { label: "N/A", color: "bg-slate-50", header: "bg-slate-400", border: "border-l-slate-300", text: "text-slate-500", lightText: "text-white" };
    if (name.includes("Shift")) {
      if (num > 0.25) return { label: "Much longer than recommended", color: "bg-[#fff5f5]", header: "bg-[#e74c3c]", border: "border-l-[#e74c3c]", text: "text-[#e74c3c]", lightText: "text-white" };
      if (num > 0.1) return { label: "Longer than recommended", color: "bg-[#fffaf0]", header: "bg-[#f39c12]", border: "border-l-[#f39c12]", text: "text-[#f39c12]", lightText: "text-white" };
      return { label: "Good - Nothing to do here", color: "bg-[#f0fff4]", header: "bg-[#27ae60]", border: "border-l-[#27ae60]", text: "text-[#27ae60]", lightText: "text-white" };
    }
    if (num > 3 || (name.includes("Blocking") && num > 300)) return { label: "Much longer than recommended", color: "bg-[#fff5f5]", header: "bg-[#e74c3c]", border: "border-l-[#e74c3c]", text: "text-[#e74c3c]", lightText: "text-white" };
    if (num > 2 || (name.includes("Blocking") && num > 100)) return { label: "Longer than recommended", color: "bg-[#fffaf0]", header: "bg-[#f39c12]", border: "border-l-[#f39c12]", text: "text-[#f39c12]", lightText: "text-white" };
    return { label: "Good - Nothing to do here", color: "bg-[#f0fff4]", header: "bg-[#27ae60]", border: "border-l-[#27ae60]", text: "text-[#27ae60]", lightText: "text-white" };
  };

  const status = getStatus();

  return (
    <div className={`flex flex-col bg-white border border-slate-100 rounded-sm overflow-hidden shadow-sm transition-all hover:shadow-md ${status.border} border-l-4`}>
      <div className="flex-1 flex items-center justify-between min-h-[85px]">
        <div className="flex items-center gap-2">
          <span className="text-[17px] px-3 font-medium text-slate-600">{name}</span>
          <span className="inline-flex items-center justify-center cursor-help" style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid #d1d5db", fontSize: 9, color: "#9ca3af", fontWeight: 700, lineHeight: 1 }}>?</span>
        </div>
        <div className="flex items-stretch w-[240px]">
          <div className={`flex-1 flex flex-col rounded-sm overflow-hidden border border-slate-100`}>
            <div className={`py-1 px-2 ${status.header} text-center`}>
              <span className={`text-[11px] font-semibold uppercase tracking-tight ${status.lightText || 'text-white'}`}>{status.label}</span>
            </div>
            <div className={`flex-1 flex items-center justify-center ${status.color} py-2`}>
              <span className={`text-2xl md:text-3xl font-semibold ${status.text}`}>{value !== "—" ? value + unit : "—"}</span>
            </div>
          </div>
        </div>
      </div>
      {showDetails && result?.message && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-50 text-[11px] text-slate-500 italic">
          {result.message}
        </div>
      )}
    </div>
  );
}

function BrowserTimingCard({ name, result }: { name: string, result?: TestResult }) {
  const rawValue = result?.message || "";
  const match = rawValue.match(/(\d+(\.\d+)?)\s*(ms|s|%|)/i);
  const value = match ? match[1] + match[3] : "0ms";

  const colors = [
    "border-l-blue-400", "border-l-purple-400", "border-l-pink-400",
    "border-l-indigo-400", "border-l-cyan-400", "border-l-teal-400",
    "border-l-emerald-400", "border-l-rose-400", "border-l-amber-400"
  ];

  const colorIndex = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  const borderColor = colors[colorIndex];

  return (
    <div className={`bg-white border border-slate-100 rounded-sm p-4 flex items-center justify-between shadow-sm group hover:shadow-md transition-all border-l-4 ${borderColor}`}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-medium text-slate-600">{name}</span>
        <span className="inline-flex items-center justify-center cursor-help opacity-40 group-hover:opacity-100 transition-opacity" style={{ width: 13, height: 13, borderRadius: "50%", border: "1.2px solid #d1d5db", fontSize: 8, color: "#9ca3af", fontWeight: 700, lineHeight: 1 }}>?</span>
      </div>
      <span className="text-[15px] font-bold text-slate-500/80 font-mono tracking-tight">
        {value}
      </span>
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


// ── INNER PAGES TAB ──────────────────────────────────────────────────────────

function cwvColor(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "text-slate-400";
  if (metric === "lcp") return value <= 2500 ? "text-emerald-600" : value <= 4000 ? "text-amber-500" : "text-red-500";
  if (metric === "inp") return value <= 200  ? "text-emerald-600" : value <= 500  ? "text-amber-500" : "text-red-500";
  if (metric === "cls") return value <= 0.1  ? "text-emerald-600" : value <= 0.25 ? "text-amber-500" : "text-red-500";
  return "text-slate-400";
}

function cwvBg(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "bg-slate-50 border-slate-200";
  if (metric === "lcp") return value <= 2500 ? "bg-emerald-50 border-emerald-200" : value <= 4000 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  if (metric === "inp") return value <= 200  ? "bg-emerald-50 border-emerald-200" : value <= 500  ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  if (metric === "cls") return value <= 0.1  ? "bg-emerald-50 border-emerald-200" : value <= 0.25 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  return "bg-slate-50 border-slate-200";
}

function formatCwv(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "—";
  if (metric === "cls") return value.toFixed(3);
  return `${value} ms`;
}

function CwvPill({ metric, value }: { metric: "lcp" | "inp" | "cls"; value: number | null }) {
  const label = metric.toUpperCase();
  const color = cwvColor(metric, value);
  const bg = cwvBg(metric, value);
  return (
    <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg border ${bg} min-w-[70px]`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>
      <span className={`text-sm font-bold ${color} tabular-nums`}>{formatCwv(metric, value)}</span>
    </div>
  );
}

function InnerPagesTabContent({ results }: { results: TestResult[] }) {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [sortBy, setSortBy] = useState<"url" | "lcp" | "inp" | "cls">("lcp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Find the CWV result row
  const cwvResult = results.find(r => r.check_name === "Core Web Vitals (Per Page)");
  const allEntries: CwvEntry[] = cwvResult?.cwv_results ?? [];

  // Also find inner pages discovery for the URL list
  const innerPagesResult = results.find(r => r.check_name === "Internal Pages Discovery");
  const innerPages: { url: string }[] = innerPagesResult?.inner_pages_results ?? [];

  const filtered = allEntries.filter(e => e.strategy === strategy);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortBy === "url") { av = a.url; bv = b.url; }
    else { av = a[sortBy] ?? -1; bv = b[sortBy] ?? -1; }
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const SortArrow = ({ col }: { col: typeof sortBy }) => (
    <span className={`ml-0.5 text-[9px] ${sortBy === col ? "text-blue-500" : "text-slate-300"}`}>
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "▼"}
    </span>
  );

  // Summary stats
  const goodLcp  = filtered.filter(e => e.lcp !== null && e.lcp <= 2500).length;
  const goodInp  = filtered.filter(e => e.inp !== null && e.inp <= 200).length;
  const goodCls  = filtered.filter(e => e.cls !== null && e.cls <= 0.1).length;
  const total = filtered.length;

  const noData = allEntries.length === 0;

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-slate-700">Inner Pages — Core Web Vitals</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            LCP, INP, CLS measured via Google PageSpeed Insights API for every discovered inner page.
            {innerPages.length > 0 && ` ${innerPages.length} pages discovered.`}
          </p>
        </div>
        {/* Strategy toggle */}
        {!noData && (
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 self-start">
            {(["mobile", "desktop"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize
                  ${strategy === s ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                {s === "mobile" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {noData ? (
        /* No CWV data yet */
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <Globe className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No Core Web Vitals data yet</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Inner pages CWV scan runs automatically after the next test. Make sure <code className="bg-slate-100 px-1 rounded">PSI_API_KEY</code> is set in your worker environment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Good LCP", good: goodLcp, total, hint: "≤ 2500 ms", color: "emerald" },
              { label: "Good INP", good: goodInp, total, hint: "≤ 200 ms",  color: "blue" },
              { label: "Good CLS", good: goodCls, total, hint: "≤ 0.1",     color: "purple" },
            ].map(({ label, good, total, hint, color }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold text-${color}-600`}>{good}</span>
                  <span className="text-sm text-slate-400 mb-0.5">/ {total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-${color}-400 transition-all`}
                    style={{ width: total > 0 ? `${(good / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{hint}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <button onClick={() => toggleSort("url")} className="flex items-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left hover:text-slate-700 transition-colors">
                Page URL <SortArrow col="url" />
              </button>
              {(["lcp", "inp", "cls"] as const).map(col => (
                <button key={col} onClick={() => toggleSort(col)} className="flex items-center justify-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors w-20">
                  {col.toUpperCase()} <SortArrow col={col} />
                </button>
              ))}
              <div className="w-16 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Source</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
              {sorted.map((entry, i) => {
                const path = (() => { try { return new URL(entry.url).pathname || "/"; } catch { return entry.url; } })();
                const overallStatus =
                  (entry.lcp !== null && entry.lcp > 4000) || (entry.inp !== null && entry.inp > 500) || (entry.cls !== null && entry.cls > 0.25)
                    ? "fail"
                    : (entry.lcp !== null && entry.lcp > 2500) || (entry.inp !== null && entry.inp > 200) || (entry.cls !== null && entry.cls > 0.1)
                      ? "warning"
                      : "pass";

                return (
                  <div
                    key={`${entry.url}-${entry.strategy}-${i}`}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-4 py-3 items-center hover:bg-slate-50/60 transition-colors
                      ${overallStatus === "fail" ? "border-l-2 border-l-red-400" : overallStatus === "warning" ? "border-l-2 border-l-amber-400" : "border-l-2 border-l-emerald-400"}`}
                  >
                    {/* URL */}
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <Globe className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate" title={entry.url}>
                          {path}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{entry.url}</p>
                      </div>
                    </div>

                    {/* LCP */}
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("lcp", entry.lcp)} ${cwvColor("lcp", entry.lcp)}`}>
                      {formatCwv("lcp", entry.lcp)}
                    </div>

                    {/* INP */}
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("inp", entry.inp)} ${cwvColor("inp", entry.inp)}`}>
                      {formatCwv("inp", entry.inp)}
                    </div>

                    {/* CLS */}
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("cls", entry.cls)} ${cwvColor("cls", entry.cls)}`}>
                      {formatCwv("cls", entry.cls)}
                    </div>

                    {/* Source badge */}
                    <div className="w-16 flex justify-center">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full
                        ${entry.source === "field" ? "bg-blue-100 text-blue-600" : entry.source === "lab" ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-400"}`}>
                        {entry.source}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />Good</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Needs Improvement</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Poor</div>
            <div className="flex items-center gap-1.5 ml-auto"><span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">field</span> Real-user CrUX data</div>
            <div className="flex items-center gap-1.5"><span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full">lab</span> Lighthouse simulation</div>
          </div>
        </>
      )}
    </div>
  );
}
