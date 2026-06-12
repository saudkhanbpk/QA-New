"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { TestResult } from "@/types";

const CHECK_DESCRIPTIONS: Record<string, { desc: string; icon: string }> = {
  "Enable Keep-Alive": { icon: "🔗", desc: "Checks whether your server reuses HTTP connections. Without Keep-Alive, each file opens a new connection — slower for HTTP/1.1 sites." },
  "Combine Images Using CSS Sprites": { icon: "🖼️", desc: "Checks if multiple small images can be combined into a single sprite sheet to reduce HTTP requests. Less critical on HTTP/2." },
  "Use a Content Delivery Network (CDN)": { icon: "🌍", desc: "Checks whether static assets are served from a CDN instead of your origin server. A CDN reduces latency for global users." },
  "Avoid Chaining Critical Requests": { icon: "🔗", desc: "Checks whether important resources depend on other resources before loading. Each chain level adds a full network round-trip." },
  "Avoid Enormous Network Payloads": { icon: "📦", desc: "Checks the total download size of all page resources. Google recommends keeping total payload under 1,600KB." },
  "Properly Size Images": { icon: "🖼️", desc: "Checks whether images are served at the correct display dimensions. Oversized images waste bandwidth." },
  "Avoid Large Layout Shifts": { icon: "📐", desc: "Checks whether visible elements move after appearing on screen. Common causes: images without dimensions, late-loading fonts." },
  "Serve Static Assets With Efficient Cache Policy": { icon: "💾", desc: "Checks cache headers on static resources. Short cache lifetimes force repeat visitors to re-download files unnecessarily." },
};

export function StructureTabContent({ results }: { results: TestResult[] }) {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const structureResults = results.filter((r) =>
    r.category === "structure" &&
    r.check_name !== "Internal Pages Discovery" &&
    !r.check_name.toLowerCase().includes("(mobile)") &&
    !r.check_name.toLowerCase().includes("(tablet)")
  );

  const filters = ["All","LCP","TBT","CLS","CDN","Cache"];

  const filtered = structureResults.filter((r) => {
    if (activeFilter === "All") return true;
    const cn = r.check_name.toLowerCase();
    const f = activeFilter.toLowerCase();
    if (f === "lcp") return cn.includes("largest") || cn.includes("image") || cn.includes("payload");
    if (f === "tbt") return cn.includes("blocking") || cn.includes("chain") || cn.includes("task");
    if (f === "cls") return cn.includes("layout") || cn.includes("shift");
    if (f === "cdn") return cn.includes("cdn") || cn.includes("content delivery");
    if (f === "cache") return cn.includes("cache");
    return cn.includes(f);
  });

  const passCount = structureResults.filter((r) => r.status === "pass").length;

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium text-slate-700">Structure Audits</h2>
          <p className="text-xs text-slate-500">How well your page is built for optimal performance. {passCount}/{structureResults.length} checks passed.</p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-sm">
          {filters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${activeFilter === f ? "bg-[#2d5d85] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"}`}>{f}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">No structure issues found for this filter.</div>
      ) : (
        <div className="space-y-1">
          {filtered.slice(0, 30).map((issue) => {
            const summaryLine = issue.message.split("\n")[0];
            const detailLines = issue.message.includes("\n") ? issue.message.split("\n").slice(1).filter(Boolean) : [];
            const metricTags = [
              { label: "LCP", show: issue.check_name.toLowerCase().includes("largest") || issue.check_name.toLowerCase().includes("image") },
              { label: "CLS", show: issue.check_name.toLowerCase().includes("shift") || issue.check_name.toLowerCase().includes("layout") },
              { label: "TBT", show: issue.check_name.toLowerCase().includes("blocking") || issue.check_name.toLowerCase().includes("chain") },
              { label: "CDN", show: issue.check_name.toLowerCase().includes("cdn") },
              { label: "Cache", show: issue.check_name.toLowerCase().includes("cache") },
            ];

            return (
              <Accordion type="single" collapsible key={issue.id}>
                <AccordionItem value="item-1" className="border rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <AccordionTrigger className="hover:no-underline py-0 px-0 group">
                    <div className="flex w-full items-stretch">
                      <div className={`w-28 flex items-center justify-center text-[11px] font-bold text-white shrink-0 transition-colors ${issue.severity === "critical" ? "bg-[#e74c3c] group-hover:bg-[#d63031]" : issue.severity === "medium" ? "bg-[#f39c12] group-hover:bg-[#d68910]" : "bg-[#a3c24d] group-hover:bg-[#8da33f]"}`}>
                        {issue.severity === "critical" ? "High" : issue.severity === "medium" ? "Medium" : issue.status === "pass" ? "Pass" : "Low"}
                      </div>
                      <div className="flex-1 flex items-center justify-between px-4 py-3 bg-white group-hover:bg-slate-50 transition-colors border-l border-slate-100">
                        <div className="flex flex-col items-start gap-1">
                          <div className="font-semibold text-[#2d5d85] text-[13px]">{issue.check_name.replace(/\s*\((Desktop|Mobile|Tablet)\)\s*$/i, "")}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {metricTags.filter((t) => t.show).map((t) => (
                              <span key={t.label} className="bg-slate-100 text-[9px] px-1 py-0.5 rounded text-slate-400 font-bold uppercase tracking-tight">{t.label}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono pr-4 max-w-xs text-right truncate">{summaryLine}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 bg-white border-t border-slate-100">
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-slate-600 leading-relaxed italic">{summaryLine}</p>
                      {detailLines.length > 0 && (
                        <div className="bg-slate-50 rounded border border-slate-100 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{detailLines[0]?.startsWith("CHAIN_NODE:") ? "Initial Navigation" : "Affected Resources"}</span>
                          </div>
                          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                            {detailLines.map((line, i) => {
                              if (line.startsWith("CHAIN_NODE:")) {
                                const parts = line.replace("CHAIN_NODE:", "").split("|");
                                const depth = parseInt(parts[0] ?? "0");
                                const nodeUrl = parts[1] ?? "";
                                const sizeKB = parts[2] ?? "0";
                                const durationMs = parts[3] ?? "0";
                                const isRoot = depth === 0;
                                return (
                                  <div key={i} className="flex items-center px-3 py-2 hover:bg-slate-50 transition-colors" style={{ paddingLeft: `${12 + depth * 20}px` }}>
                                    {depth > 0 && <span className="text-slate-300 mr-2 shrink-0 font-mono text-xs">└─</span>}
                                    <div className="min-w-0 flex-1 flex items-center gap-2">
                                      <a href={nodeUrl} target="_blank" rel="noopener noreferrer" className={`text-[11px] hover:underline break-all font-mono truncate max-w-xs ${isRoot ? "text-slate-700 font-semibold" : "text-[#2d5d85]"}`} title={nodeUrl}>
                                        {nodeUrl.length > 60 ? nodeUrl.slice(0, 60) + "…" : nodeUrl}
                                      </a>
                                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">— {sizeKB}KB, {durationMs}ms</span>
                                    </div>
                                  </div>
                                );
                              }
                              const clean = line.replace(/^•\s*/, "");
                              const urlMatch = clean.match(/^(https?:\/\/[^\s]+)/);
                              const rest = urlMatch ? clean.slice(urlMatch[1].length) : clean;
                              return (
                                <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
                                  <span className="text-slate-300 text-[10px] mt-0.5 shrink-0">▸</span>
                                  <div className="min-w-0 flex-1">
                                    {urlMatch ? (
                                      <div>
                                        <a href={urlMatch[1]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#2d5d85] hover:underline break-all font-mono">{urlMatch[1].length > 70 ? urlMatch[1].slice(0, 70) + "…" : urlMatch[1]}</a>
                                        {rest && <span className="text-[10px] text-slate-400 ml-1">{rest}</span>}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-600">{clean}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {issue.fix_recommendation && issue.status !== "pass" && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-xs text-blue-800 rounded-r shadow-sm">
                          <span className="font-bold block mb-1 text-[10px] uppercase tracking-wider text-blue-600">How to Fix:</span>
                          <p className="leading-normal">{issue.fix_recommendation}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>
      )}
    </div>
  );
}
