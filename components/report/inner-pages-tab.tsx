"use client";

import { useState } from "react";
import { Globe, Monitor, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TestResult, CwvEntry } from "@/types";

function cwvColor(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "text-slate-400";
  if (metric === "lcp") return value <= 2500 ? "text-emerald-600" : value <= 4000 ? "text-amber-500" : "text-red-500";
  if (metric === "inp") return value <= 200 ? "text-emerald-600" : value <= 500 ? "text-amber-500" : "text-red-500";
  if (metric === "cls") return value <= 0.1 ? "text-emerald-600" : value <= 0.25 ? "text-amber-500" : "text-red-500";
  return "text-slate-400";
}

function cwvBg(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "bg-slate-50 border-slate-200";
  if (metric === "lcp") return value <= 2500 ? "bg-emerald-50 border-emerald-200" : value <= 4000 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  if (metric === "inp") return value <= 200 ? "bg-emerald-50 border-emerald-200" : value <= 500 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  if (metric === "cls") return value <= 0.1 ? "bg-emerald-50 border-emerald-200" : value <= 0.25 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  return "bg-slate-50 border-slate-200";
}

function formatCwv(metric: "lcp" | "inp" | "cls", value: number | null): string {
  if (value === null) return "—";
  if (metric === "cls") return value.toFixed(3);
  return `${value} ms`;
}

export function InnerPagesTabContent({ results }: { results: TestResult[] }) {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [sortBy, setSortBy] = useState<"url" | "lcp" | "inp" | "cls">("lcp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const cwvResult = results.find((r) => r.check_name === "Core Web Vitals (Per Page)");
  const allEntries: CwvEntry[] = cwvResult?.cwv_results ?? [];
  const innerPagesResult = results.find((r) => r.check_name === "Internal Pages Discovery");
  const innerPages: { url: string }[] = innerPagesResult?.inner_pages_results ?? [];

  const filtered = allEntries.filter((e) => e.strategy === strategy);
  const sorted = [...filtered].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortBy === "url") { av = a.url; bv = b.url; }
    else { av = a[sortBy] ?? -1; bv = b[sortBy] ?? -1; }
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  const SortArrow = ({ col }: { col: typeof sortBy }) => (
    <span className={`ml-0.5 text-[9px] ${sortBy === col ? "text-blue-500" : "text-slate-300"}`}>
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "▼"}
    </span>
  );

  const goodLcp = filtered.filter((e) => e.lcp !== null && e.lcp <= 2500).length;
  const goodInp = filtered.filter((e) => e.inp !== null && e.inp <= 200).length;
  const goodCls = filtered.filter((e) => e.cls !== null && e.cls <= 0.1).length;
  const total = filtered.length;
  const noData = allEntries.length === 0;

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-slate-700">Inner Pages — Core Web Vitals</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            LCP, INP, CLS measured via Google PageSpeed Insights API for every discovered inner page.
            {innerPages.length > 0 && ` ${innerPages.length} pages discovered.`}
          </p>
        </div>
        {!noData && (
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 self-start">
            {(["mobile","desktop"] as const).map((s) => (
              <button key={s} onClick={() => setStrategy(s)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${strategy === s ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                {s === "mobile" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {noData ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <Globe className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No Core Web Vitals data yet</p>
            <p className="text-xs text-slate-400 max-w-xs">Inner pages CWV scan runs automatically after the next test. Make sure <code className="bg-slate-100 px-1 rounded">PSI_API_KEY</code> is set in your worker environment.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Good LCP", good: goodLcp, total, hint: "≤ 2500 ms", color: "emerald" },
              { label: "Good INP", good: goodInp, total, hint: "≤ 200 ms", color: "blue" },
              { label: "Good CLS", good: goodCls, total, hint: "≤ 0.1", color: "purple" },
            ].map(({ label, good, total, hint, color }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold text-${color}-600`}>{good}</span>
                  <span className="text-sm text-slate-400 mb-0.5">/ {total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full bg-${color}-400 transition-all`} style={{ width: total > 0 ? `${(good / total) * 100}%` : "0%" }} />
                </div>
                <span className="text-[10px] text-slate-400">{hint}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <button onClick={() => toggleSort("url")} className="flex items-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left hover:text-slate-700 transition-colors">Page URL <SortArrow col="url" /></button>
              {(["lcp","inp","cls"] as const).map((col) => (
                <button key={col} onClick={() => toggleSort(col)} className="flex items-center justify-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors w-20">{col.toUpperCase()} <SortArrow col={col} /></button>
              ))}
              <div className="w-16 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Source</div>
            </div>
            <div className="divide-y divide-slate-50">
              {sorted.map((entry, i) => {
                const path = (() => { try { return new URL(entry.url).pathname || "/"; } catch { return entry.url; } })();
                const overallStatus = (entry.lcp !== null && entry.lcp > 4000) || (entry.inp !== null && entry.inp > 500) || (entry.cls !== null && entry.cls > 0.25) ? "fail" : (entry.lcp !== null && entry.lcp > 2500) || (entry.inp !== null && entry.inp > 200) || (entry.cls !== null && entry.cls > 0.1) ? "warning" : "pass";
                return (
                  <div key={`${entry.url}-${entry.strategy}-${i}`} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-4 py-3 items-center hover:bg-slate-50/60 transition-colors ${overallStatus === "fail" ? "border-l-2 border-l-red-400" : overallStatus === "warning" ? "border-l-2 border-l-amber-400" : "border-l-2 border-l-emerald-400"}`}>
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <Globe className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate" title={entry.url}>{path}</p>
                        <p className="text-[10px] text-slate-400 truncate">{entry.url}</p>
                      </div>
                    </div>
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("lcp", entry.lcp)} ${cwvColor("lcp", entry.lcp)}`}>{formatCwv("lcp", entry.lcp)}</div>
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("inp", entry.inp)} ${cwvColor("inp", entry.inp)}`}>{formatCwv("inp", entry.inp)}</div>
                    <div className={`w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${cwvBg("cls", entry.cls)} ${cwvColor("cls", entry.cls)}`}>{formatCwv("cls", entry.cls)}</div>
                    <div className="w-16 flex justify-center">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${entry.source === "field" ? "bg-blue-100 text-blue-600" : entry.source === "lab" ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-400"}`}>{entry.source}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
