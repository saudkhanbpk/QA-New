"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { TestReport, TestResult } from "@/types";

export function SummaryTabContent({ report }: { report: TestReport }) {
  const { results, screenshots } = report;
  const [activeIssueFilter, setActiveIssueFilter] = useState("All");
  const performance = results.filter((r) => r.category === "performance");
  const pagesize = performance.filter((r) => r.check_name === "Page Size Breakdown");
  const requests = performance.filter((r) => r.check_name === "Page Request Breakdown");

  const getMetric = (name: string) => {
    const r = results.find(
      (res) =>
        (res.check_name.toLowerCase().includes(name.toLowerCase()) ||
          res.check_name.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ""))) &&
        !res.check_name.toLowerCase().includes("mobile")
    );
    if (!r) return null;
    const match = r.message.match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const value = match[1];
    const unit = r.message.includes("ms") ? "ms" : r.message.includes("s") && !r.message.includes("score") ? "s" : "";
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
    return timeStr.toLowerCase().includes("ms") ? val / 1000 : val;
  };

  const allMetricTimes = [metrics.ttfb, metrics.fcp, metrics.lcp, metrics.tti, metrics.onload, metrics.fullyLoaded].map(parseTimeToSeconds);
  const roundedMax = Math.max(6, Math.ceil(Math.max(...allMetricTimes)));

  const getPercentage = (timeStr: string): number => {
    const time = parseTimeToSeconds(timeStr);
    return Math.min((time / roundedMax) * 100, 100);
  };

  const tickCount = roundedMax * 10;
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
          <div className="relative h-6 mb-1">
            {timeLabels.map((t) => (
              <span key={t} className="absolute text-[11px] text-slate-400 -translate-x-1/2" style={{ left: `${(t / roundedMax) * 100}%` }}>{t}s</span>
            ))}
          </div>
          <div className="relative h-3 border-b border-slate-200 mb-2">
            {Array.from({ length: tickCount + 1 }, (_, i) => {
              const isMajor = i % 10 === 0;
              return <div key={i} className={`absolute bottom-0 w-[1px] ${isMajor ? "h-3 bg-slate-300" : "h-1.5 bg-slate-200"}`} style={{ left: `${(i / tickCount) * 100}%` }} />;
            })}
          </div>
          <div className="relative">
            <div className="flex gap-1 items-end relative">
              {[1,2,3,4,5,6,7,8,9,10].map((_, i) => (
                <div key={i} className="flex-1 h-20 border border-slate-200 bg-slate-50/30 rounded-sm overflow-hidden relative group">
                  {i > (getPercentage(metrics.fcp) / 10) && screenshots.find((s) => s.viewport === "desktop") && (
                    <img src={screenshots.find((s) => s.viewport === "desktop")?.image_url} alt="Frame" className="w-full h-full object-cover opacity-90" />
                  )}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 pointer-events-none">
              {/* TTFB */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#7c8da5] z-10" style={{ left: `${getPercentage(metrics.ttfb)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#7c8da5]" />
                  <div className="min-w-[100px] shadow-sm">
                    <div className="bg-[#7c8da5] text-white text-[10px] py-1 px-2 rounded-t-sm font-medium border-b border-white/10 whitespace-nowrap">TTFB: {metrics.ttfb}</div>
                    <div className="bg-[#f2f4f7] text-slate-500 text-[9px] p-1.5 rounded-b-sm border border-[#7c8da5]/20 leading-tight whitespace-nowrap">
                      <div>Redirect: {subMetrics.redirect}</div>
                      <div>Connect: {subMetrics.connect}</div>
                      <div>Backend: {subMetrics.backend}</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* FCP */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#00aeef] z-10" style={{ left: `${getPercentage(metrics.fcp)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#00aeef]" />
                  <div className="bg-[#00aeef] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">First Contentful Paint: {metrics.fcp}</div>
                </div>
              </div>
              {/* LCP */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#2d5d85] z-10" style={{ left: `${getPercentage(metrics.lcp)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[75px] w-[1px] bg-[#2d5d85]" />
                  <div className="bg-[#2d5d85] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">Largest Contentful Paint: {metrics.lcp}</div>
                </div>
              </div>
              {/* TTI */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#a569bd] z-10" style={{ left: `${getPercentage(metrics.tti)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[15px] w-[1px] bg-[#a569bd]" />
                  <div className="min-w-[150px]">
                    <div className="bg-[#a569bd] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap text-center">Time to Interactive: {metrics.tti}</div>
                  </div>
                </div>
              </div>
              {/* Onload */}
              <div className="absolute top-0 h-20 w-[1px] bg-[#9b2c5c] z-10" style={{ left: `${getPercentage(metrics.onload)}%` }}>
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-[45px] w-[1px] bg-[#9b2c5c]" />
                  <div className="bg-[#9b2c5c] text-white text-[10px] py-1 px-2 rounded-sm shadow-sm font-medium whitespace-nowrap">Onload Time: {metrics.onload}</div>
                </div>
              </div>
              {/* Fully Loaded */}
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

      {/* Issues + Page Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top Issues */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-slate-700">Top Issues</h2>
            <div className="flex bg-slate-100 p-0.5 rounded-sm">
              {["All","FCP","LCP","TBT","CLS"].map((m) => (
                <button key={m} onClick={() => setActiveIssueFilter(m)} className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${activeIssueFilter === m ? "bg-[#2d5d85] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"}`}>{m}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">These audits are identified as the top issues impacting <span className="font-bold">your performance</span>.</p>
          <div className="space-y-1">
            {results.filter((r) => {
              if (r.status === "pass") return false;
              if (!(r.category === "performance" || r.category === "quality")) return false;
              if (activeIssueFilter === "All") return true;
              const cn = r.check_name.toLowerCase();
              const f = activeIssueFilter.toLowerCase();
              return cn.includes(f) || (f === "fcp" && cn.includes("contentful paint")) || (f === "lcp" && cn.includes("largest contentful paint")) || (f === "tbt" && cn.includes("total blocking time")) || (f === "cls" && cn.includes("layout shift"));
            }).slice(0, 20).map((issue) => (
              <Accordion type="single" collapsible key={issue.id}>
                <AccordionItem value="item-1" className="border rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <AccordionTrigger className="hover:no-underline py-0 px-0 group">
                    <div className="flex w-full items-stretch">
                      <div className={`w-28 flex items-center justify-center text-[11px] font-bold text-white shrink-0 transition-colors ${issue.severity === "critical" ? "bg-[#e74c3c] group-hover:bg-[#d63031]" : "bg-[#a3c24d] group-hover:bg-[#8da33f]"}`}>
                        {issue.severity === "critical" ? "High" : "Med-Low"}
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 pt-2">Improving these audits seen here can help as a starting point for overall performance gains.</p>
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
            <div className="space-y-1">
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute top-0 bottom-0 left-[60%] w-[1px] bg-slate-300 z-10" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-slate-700">{metrics.fullyLoaded}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Fully Loaded Time</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-600">Total Page Size - {pagesize[0]?.page_size?.[0]?.total_size ?? 0} KB</h3>
              <div className="flex h-12 rounded-sm overflow-hidden shadow-sm">
                <div className="bg-[#5c7a95] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">IMG</span><span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.image_size ?? 0}KB</span></div>
                <div className="bg-[#6b8ba4] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">JS</span><span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.js_size ?? 0}KB</span></div>
                <div className="bg-[#9b7e9b] w-20 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">Font</span><span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.font_size ?? 0}KB</span></div>
                <div className="bg-[#9b99b6] w-16 flex flex-col items-center justify-center text-white"><span className="text-[10px] font-bold">CSS</span><span className="text-[9px] opacity-80">{pagesize[0]?.page_size?.[0]?.css_size ?? 0}KB</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-600">Total Page Requests - {requests[0]?.page_request_size?.[0]?.total_requests ?? 0}</h3>
              <div className="flex h-12 rounded-sm overflow-hidden shadow-sm">
                <div className="bg-[#5c7a95] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">IMG</span><span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.image_percent ?? 0}%</span></div>
                <div className="bg-[#6b8ba4] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">JS</span><span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.js_percent ?? 0}%</span></div>
                <div className="bg-[#9b99b6] flex-1 flex flex-col items-center justify-center text-white border-r border-white/20"><span className="text-[10px] font-bold">CSS</span><span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.css_percent ?? 0}%</span></div>
                <div className="bg-[#b699b6] w-12 flex flex-col items-center justify-center text-white"><span className="text-[10px] font-bold">Other</span><span className="text-[9px] opacity-80">{requests[0]?.page_request_size?.[0]?.other_percent ?? 0}%</span></div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic">Look into reducing JavaScript, reducing web-fonts, and image optimization.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
