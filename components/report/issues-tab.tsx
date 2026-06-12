"use client";

import { XCircle, AlertTriangle, Info, Wrench, Zap, Phone, Mail } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { TestResult } from "@/types";

interface IssueCategoryConfig {
  key: string;
  label: string;
  icon: string;
  gradient: string;
  borderColor: string;
  categories: string[];
}

const ISSUE_CATEGORIES: IssueCategoryConfig[] = [
  { key: "broken_links", label: "Broken Links", icon: "🔗", gradient: "from-red-500/10 to-red-500/5", borderColor: "border-red-200", categories: ["broken_links"] },
  { key: "structure", label: "Structure Issues", icon: "🏗️", gradient: "from-orange-500/10 to-orange-500/5", borderColor: "border-orange-200", categories: ["structure"] },
  { key: "compatibility", label: "Cross-Browser", icon: "🌐", gradient: "from-purple-500/10 to-purple-500/5", borderColor: "border-purple-200", categories: ["compatibility"] },
  { key: "security", label: "Security", icon: "🔒", gradient: "from-blue-500/10 to-blue-500/5", borderColor: "border-blue-200", categories: ["security"] },
  { key: "performance", label: "Performance", icon: "⚡", gradient: "from-yellow-500/10 to-yellow-500/5", borderColor: "border-yellow-200", categories: ["performance"] },
  { key: "seo_quality", label: "SEO & Quality", icon: "📝", gradient: "from-emerald-500/10 to-emerald-500/5", borderColor: "border-emerald-200", categories: ["seo", "quality", "others"] },
];

export function IssuesOverviewTabContent({ results }: { results: TestResult[] }) {
  const allIssues = results.filter((r) => r.status !== "pass");
  const criticalCount = allIssues.filter((r) => r.severity === "critical").length;
  const mediumCount = allIssues.filter((r) => r.severity === "medium").length;
  const lowCount = allIssues.filter((r) => r.severity === "low").length;
  const failCount = allIssues.filter((r) => r.status === "fail").length;
  const warnCount = allIssues.filter((r) => r.status === "warning").length;
  const totalChecks = results.length;
  const passedChecks = results.filter((r) => r.status === "pass").length;
  const isHealthy = allIssues.length === 0;

  const issuesByCategory = ISSUE_CATEGORIES.map((cat) => {
    const catIssues = allIssues.filter((r) => cat.categories.includes(r.category));
    return { ...cat, issues: catIssues, fails: catIssues.filter((r) => r.status === "fail").length, warns: catIssues.filter((r) => r.status === "warning").length };
  });

  return (
    <div className="space-y-6">
      {/* ── CTA ── */}
      <div className="relative overflow-hidden rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#22c55e" strokeWidth="2" />
            <circle cx="100" cy="100" r="60" fill="none" stroke="#22c55e" strokeWidth="1" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="#22c55e" strokeWidth="1" />
          </svg>
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-800">Need Help Fixing These Issues?</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Our team of expert developers can resolve{" "}
              {allIssues.length > 0 ? (<>all <span className="font-semibold text-emerald-700">{allIssues.length} issues</span></>) : ("any issues")}{" "}
              in your report quickly and professionally.
            </p>
            <div className="flex items-center gap-4 text-[13px] text-slate-400">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Average fix: {allIssues.length * 1.5} hrs</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md hover:shadow-lg transition-all px-6 py-5 text-sm font-semibold"
              onClick={() => window.open("https://wa.me/+923119265290", "_self")}
            >
              <Phone className="h-4 w-4" /> Whatsapp Now
            </Button>
            <Button
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-2 px-6 py-5 text-sm"
              onClick={() => window.open("https://techcreator.co/contact", "_blank")}
            >
              <Mail className="h-4 w-4" /> Get a Free Quote
            </Button>
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <div className={`relative overflow-hidden rounded-xl border-2 p-6 ${isHealthy ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50" : criticalCount > 0 ? "border-red-300 bg-gradient-to-br from-red-50 to-orange-50" : "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50"}`}>
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-10" style={{ background: isHealthy ? "#22c55e" : criticalCount > 0 ? "#ef4444" : "#f59e0b" }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-5" style={{ background: isHealthy ? "#22c55e" : criticalCount > 0 ? "#ef4444" : "#f59e0b" }} />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${isHealthy ? "bg-emerald-100" : criticalCount > 0 ? "bg-red-100" : "bg-amber-100"}`}>
                {isHealthy ? "✅" : criticalCount > 0 ? "🚨" : "⚠️"}
              </div>
              <div>
                <h2 className={`text-xl md:text-2xl font-bold ${isHealthy ? "text-emerald-800" : criticalCount > 0 ? "text-red-800" : "text-amber-800"}`}>
                  {isHealthy ? "Your Site is Healthy!" : `${allIssues.length} Issue${allIssues.length !== 1 ? "s" : ""} Found`}
                </h2>
                <p className="text-sm text-muted-foreground">{passedChecks} of {totalChecks} checks passed</p>
              </div>
            </div>
          </div>
          {!isHealthy && (
            <div className="flex items-center gap-2 flex-wrap">
              {criticalCount > 0 && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm"><XCircle className="h-3.5 w-3.5" />{criticalCount} Critical</span>}
              {mediumCount > 0 && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm"><AlertTriangle className="h-3.5 w-3.5" />{mediumCount} Medium</span>}
              {lowCount > 0 && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"><Info className="h-3.5 w-3.5" />{lowCount} Low</span>}
            </div>
          )}
        </div>
        {!isHealthy && (
          <div className="relative mt-4">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{passedChecks} passed</span>
              <span>{failCount} failed, {warnCount} warnings</span>
            </div>
            <div className="h-2.5 bg-white/60 rounded-full overflow-hidden shadow-inner">
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.round((passedChecks / totalChecks) * 100)}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── PROBLEMS & FIXES ── */}
      {allIssues.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-slate-100"><Wrench className="h-3.5 w-3.5 text-slate-500" /></div>
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800 leading-none">Problems &amp; recommended fixes</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{allIssues.length} issues across {issuesByCategory.filter((c) => c.issues.length > 0).length} categories</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {failCount > 0 && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-100">{failCount} failed</span>}
              {warnCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-100">{warnCount} warnings</span>}
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {issuesByCategory.filter((cat) => cat.issues.length > 0).map((cat) => (
              <AccordionItem key={cat.key} value={cat.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50/70 data-[state=open]:bg-slate-50/70 [&>svg]:hidden group">
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl leading-none">{cat.icon}</span>
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-slate-800 leading-snug">{cat.label}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {cat.fails > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 ring-1 ring-red-100"><XCircle className="h-2.5 w-2.5" />{cat.fails} failed</span>}
                          {cat.warns > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 ring-1 ring-amber-100"><AlertTriangle className="h-2.5 w-2.5" />{cat.warns} {cat.warns === 1 ? "warning" : "warnings"}</span>}
                        </div>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="h-px bg-slate-100 mb-3" />
                  <div className="space-y-2.5">
                    {cat.issues.sort((a, b) => ({ critical: 0, medium: 1, low: 2 }[a.severity] ?? 3) - ({ critical: 0, medium: 1, low: 2 }[b.severity] ?? 3)).map((issue, idx) => (
                      <div key={idx} className={`rounded-xl border p-4 ${issue.status === "fail" ? "border-red-100 bg-red-50/40" : "border-amber-100 bg-amber-50/30"}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-2">
                            {issue.status === "fail" ? <XCircle className="h-[15px] w-[15px] text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle className="h-[15px] w-[15px] text-amber-500 mt-0.5 shrink-0" />}
                            <span className="text-[13px] font-semibold text-slate-800 leading-snug">{issue.check_name}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ${issue.severity === "critical" ? "bg-red-50 text-red-700 ring-red-200" : issue.severity === "medium" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                            {issue.severity}
                          </span>
                        </div>
                        <div className="ml-[23px] space-y-2.5">
                          <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Problem</p>
                            <p className="text-[12px] text-slate-600 leading-relaxed">{issue.message}</p>
                          </div>
                          {issue.fix_recommendation && (
                            <div className="rounded-lg bg-white border border-blue-100 p-3">
                              <p className="text-[10px] font-bold tracking-widest uppercase text-blue-500 mb-1 flex items-center gap-1.5"><Wrench className="h-2.5 w-2.5" />Solution</p>
                              <p className="text-[12px] text-slate-700 leading-relaxed">{issue.fix_recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
