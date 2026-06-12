"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronDown } from "lucide-react";
import type { TestResult, ThirdPartyAnalysis } from "@/types";

// ── ThirdPartyAnalysisCard ────────────────────────────────────────────────────

const ENTITY_TYPE_COLORS: Record<string, string> = {
  analytics: "bg-purple-100 text-purple-700 border-purple-200",
  cdn: "bg-blue-100 text-blue-700 border-blue-200",
  database: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-pink-100 text-pink-700 border-pink-200",
  ads: "bg-red-100 text-red-700 border-red-200",
  social: "bg-sky-100 text-sky-700 border-sky-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};

const ENTITY_TYPE_ICONS: Record<string, string> = {
  analytics: "📊", cdn: "🌐", database: "🗄️", media: "🖼️", ads: "📣", social: "👥", other: "🔌",
};

const VERDICT_CONFIG = {
  clean: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: "", label: "Site is Clean", barColor: "bg-emerald-400" },
  site_issue: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700 border-red-300", icon: "❌", label: "Your Code is the Issue", barColor: "bg-red-400" },
  third_party_issue: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-300", icon: "⚠️", label: "Third-Party Services Causing Issues", barColor: "bg-amber-400" },
  mixed: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700 border-orange-300", icon: "🔀", label: "Mixed: Both Site & Third-Party Issues", barColor: "bg-orange-400" },
};

function ThirdPartyAnalysisCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = result.third_party_analysis;
  if (!analysis) return null;

  const cfg = VERDICT_CONFIG[analysis.verdict];
  const totalTbt = analysis.firstPartyTbt + analysis.thirdPartyTbt;
  const firstPartyPercent = totalTbt > 0 ? Math.round((analysis.firstPartyTbt / totalTbt) * 100) : 0;

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} overflow-hidden shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-current/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{result.check_name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{result.message}</p>
          </div>
        </div>
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200 transition-all hover:bg-white">
          {expanded ? "Hide" : "Details"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-semibold">Blocking Time Split</span>
          <span className="tabular-nums">{totalTbt}ms total</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-slate-200 flex">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${firstPartyPercent}%` }} title={`Your code: ${analysis.firstPartyTbt}ms`} />
          <div className={`h-full ${cfg.barColor} transition-all`} style={{ width: `${analysis.thirdPartyTbtPercent}%` }} title={`Third parties: ${analysis.thirdPartyTbt}ms`} />
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[11px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Your code: <strong>{analysis.firstPartyTbt}ms</strong> ({firstPartyPercent}%)</span>
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${cfg.barColor} inline-block`} />Third parties: <strong>{analysis.thirdPartyTbt}ms</strong> ({analysis.thirdPartyTbtPercent}%)</span>
        </div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
        <div className="bg-white/70 rounded-lg border border-slate-100 p-3 text-center"><p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Your Assets</p><p className="text-lg font-bold text-blue-600">{analysis.firstPartySizeKB} KB</p></div>
        <div className="bg-white/70 rounded-lg border border-slate-100 p-3 text-center"><p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Third-Party Assets</p><p className={`text-lg font-bold ${analysis.thirdPartySizePercent > 50 ? "text-amber-600" : "text-slate-600"}`}>{analysis.thirdPartySizeKB} KB <span className="text-xs font-normal text-slate-400">({analysis.thirdPartySizePercent}%)</span></p></div>
        <div className="bg-white/70 rounded-lg border border-slate-100 p-3 text-center"><p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">LCP Image</p><p className={`text-sm font-bold ${analysis.lcpIsThirdParty ? "text-amber-600" : "text-emerald-600"}`}>{analysis.lcpIsThirdParty ? "⚠️ External" : "Self-hosted"}</p>{analysis.lcpDomain && <p className="text-[9px] text-slate-400 truncate mt-0.5">{analysis.lcpDomain}</p>}</div>
      </div>

      {analysis.renderBlockingThirdParties.length > 0 && (
        <div className="px-5 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[11px] font-bold text-red-700 mb-1.5">🚫 Render-Blocking Third-Party Scripts</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.renderBlockingThirdParties.map((name) => (
                <span key={name} className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">{name}</span>
              ))}
            </div>
            <p className="text-[10px] text-red-600 mt-1.5">These scripts are loaded synchronously and delay page rendering. Move them to async/defer.</p>
          </div>
        </div>
      )}

      {expanded && analysis.entities.length > 0 && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Third-Party Services Detected</h4>
          <div className="space-y-2">
            {analysis.entities.map((entity, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-slate-100 px-3 py-2.5 shadow-sm">
                <span className="text-lg">{ENTITY_TYPE_ICONS[entity.type] ?? "🔌"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">{entity.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ENTITY_TYPE_COLORS[entity.type]}`}>{entity.type}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{entity.domain}</p>
                </div>
                <div className="flex gap-3 shrink-0 text-right">
                  {entity.blockingTimeMs > 0 && <div><p className={`text-xs font-bold tabular-nums ${entity.blockingTimeMs > 200 ? "text-red-600" : entity.blockingTimeMs > 50 ? "text-amber-600" : "text-slate-500"}`}>{entity.blockingTimeMs}ms</p><p className="text-[9px] text-slate-400">blocking</p></div>}
                  {entity.transferSizeKB > 0 && <div><p className="text-xs font-bold tabular-nums text-slate-600">{entity.transferSizeKB}KB</p><p className="text-[9px] text-slate-400">size</p></div>}
                  <div><p className="text-xs font-bold tabular-nums text-slate-600">{entity.requestCount}</p><p className="text-[9px] text-slate-400">req</p></div>
                </div>
              </div>
            ))}
          </div>
          {result.fix_recommendation && (
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Recommended Fix</p>
              <p className="text-xs text-blue-800">{result.fix_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PerformanceMetricCard ─────────────────────────────────────────────────────

function PerformanceMetricCard({ name, result, showDetails }: { name: string; result?: TestResult; showDetails: boolean }) {
  const rawValue = result?.message || "";
  const match = rawValue.match(/(\d+(\.\d+)?)\s*(ms|s|%|)/i);
  const value = match ? match[1] : "—";
  const unit = match ? match[3] : name.includes("Shift") ? "" : "s";
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
          <div className="flex-1 flex flex-col rounded-sm overflow-hidden border border-slate-100">
            <div className={`py-1 px-2 ${status.header} text-center`}>
              <span className={`text-[11px] font-semibold uppercase tracking-tight ${status.lightText || "text-white"}`}>{status.label}</span>
            </div>
            <div className={`flex-1 flex items-center justify-center ${status.color} py-2`}>
              <span className={`text-2xl md:text-3xl font-semibold ${status.text}`}>{value !== "—" ? value + unit : "—"}</span>
            </div>
          </div>
        </div>
      </div>
      {showDetails && result?.message && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-50 text-[11px] text-slate-500 italic">{result.message}</div>
      )}
    </div>
  );
}

function BrowserTimingCard({ name, result }: { name: string; result?: TestResult }) {
  const rawValue = result?.message || "";
  const match = rawValue.match(/(\d+(\.\d+)?)\s*(ms|s|%|)/i);
  const value = match ? match[1] + match[3] : "0ms";
  const colors = ["border-l-blue-400","border-l-purple-400","border-l-pink-400","border-l-indigo-400","border-l-cyan-400","border-l-teal-400","border-l-emerald-400","border-l-rose-400","border-l-amber-400"];
  const colorIndex = Math.abs(name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  return (
    <div className={`bg-white border border-slate-100 rounded-sm p-4 flex items-center justify-between shadow-sm group hover:shadow-md transition-all border-l-4 ${colors[colorIndex]}`}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-medium text-slate-600">{name}</span>
      </div>
      <span className="text-[15px] font-bold text-slate-500/80 font-mono tracking-tight">{value}</span>
    </div>
  );
}

// ── PerformanceTabContent ─────────────────────────────────────────────────────

export function PerformanceTabContent({ results }: { results: TestResult[] }) {
  const [showDetails, setShowDetails] = useState(false);
  const viewports = ["Mobile", "Desktop", "Tablet"];
  const vpOrder = ["desktop", "tablet", "mobile"] as const;

  const thirdPartyResults = results.filter((r) => r.check_name.startsWith("Third-Party Impact Analysis"));
  const metricResults = results.filter((r) => !r.check_name.startsWith("Third-Party Impact Analysis"));

  const mainMetrics = ["First Contentful Paint","Speed Index","Largest Contentful Paint","Time to Interactive","Total Blocking Time","Cumulative Layout Shift"];
  const timingMetrics = ["Redirect Duration","Connection Duration","Backend Duration","Time to First Byte","First Paint","DOM Interactive Time","DOM Content Loaded Time","Onload Time","Fully Loaded Time"];

  return (
    <div className="space-y-16 py-4">
      {thirdPartyResults.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-medium text-slate-700">Third-Party Impact Analysis</h2>
            <p className="text-xs text-slate-400">Breaks down whether poor performance is caused by your own code or by external services.</p>
          </div>
          <div className="space-y-4">{thirdPartyResults.map((r) => <ThirdPartyAnalysisCard key={r.id} result={r} />)}</div>
        </div>
      )}

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

      {vpOrder.map((vp) => {
        const vpResults = metricResults.filter((r) =>
          r.check_name.toLowerCase().includes(`(${vp})`) ||
          (vp === "desktop" && !["mobile","tablet"].some((v) => r.check_name.toLowerCase().includes(`(${v})`)) && !viewports.some((v) => r.check_name.toLowerCase().includes(`(${v.toLowerCase()})`)))
        );
        if (vpResults.length === 0) return null;

        const findMetric = (name: string) => {
          const n = name.toLowerCase();
          const searchTerms = [n, n.replace(/\s+/g,""), n === "first contentful paint" ? "fcp" : null, n === "largest contentful paint" ? "lcp" : null, n === "total blocking time" ? "tbt" : null, n === "total blocking time" ? "smoothness" : null, n === "total blocking time" ? "phone processing load" : null, n === "cumulative layout shift" ? "cls" : null, n === "time to interactive" ? "tti" : null, n === "speed index" ? "si" : null, n === "time to first byte" ? "ttfb" : null].filter(Boolean) as string[];
          return vpResults.find((r) => { const cn = r.check_name.toLowerCase(); return searchTerms.some((term) => cn.includes(term)); });
        };

        return (
          <div key={vp} className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              {vp === "mobile" ? <Smartphone className="h-5 w-5 text-slate-400" /> : vp === "tablet" ? <Tablet className="h-5 w-5 text-slate-400" /> : <Monitor className="h-5 w-5 text-slate-400" />}
              <h3 className="text-lg font-semibold text-slate-600 capitalize">{vp} Performance</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mainMetrics.map((name) => <PerformanceMetricCard key={name} name={name} result={findMetric(name)} showDetails={showDetails} />)}
            </div>
            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-slate-700">Browser Timings</h3>
                <p className="text-xs text-slate-400">These timings are milestones reported by the browser.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {timingMetrics.map((name) => <BrowserTimingCard key={name} name={name} result={findMetric(name)} />)}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
