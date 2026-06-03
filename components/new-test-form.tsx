"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play } from "lucide-react";
import type { Viewport } from "@/types";

const VIEWPORTS: { id: Viewport; label: string; desc: string }[] = [
  { id: "desktop", label: "Desktop", desc: "1440px" },
  { id: "tablet", label: "Tablet", desc: "768px" },
  { id: "mobile", label: "Mobile", desc: "375px" },
];

const CHECKS = [
  { id: "performance", label: "Performance Testing", desc: "Lighthouse: LCP, FCP, TTFB, CLS, TBT, Speed Index, TTI" },
  { id: "broken_links", label: "Broken Links", desc: "Check all links for 404, 410, 500+ errors (up to 30 links)" },
  { id: "compatibility", label: "Cross-Browser Testing", desc: "Test on Chrome, Firefox, Safari - layout & JS errors" },
  { id: "security", label: "Security Headers", desc: "HTTPS, CSP, HSTS, X-Frame-Options, cookies, referrer policy" },
  { id: "others", label: "Others (SEO, Accessibility, Responsive)", desc: "Additional checks: SEO tags, WCAG compliance, responsive design, visual screenshots" },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];

export function NewTestForm({ prefillUrl }: { prefillUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(prefillUrl || "");
  const [multipleMode, setMultipleMode] = useState(false);
  const [urls, setUrls] = useState("");
  const [viewports, setViewports] = useState<Viewport[]>(["desktop", "tablet", "mobile"]);
  const [checks, setChecks] = useState<Record<CheckId, boolean>>({
    performance: true,
    broken_links: true,
    compatibility: true,
    security: true,
    others: true,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveViewport, setLiveViewport] = useState<string | null>("desktop");

  const hasAutoStarted = useRef(false);

  useEffect(() => {
    if (prefillUrl && !hasAutoStarted.current && !loading) {
      hasAutoStarted.current = true;
      // Small delay to ensure state is ready
      setTimeout(() => {
        handleSubmit();
      }, 500);
    }
  }, [prefillUrl]);

  function toggleViewport(v: Viewport) {
    setViewports((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }
  function toggleCheck(id: CheckId) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();

    // Get URLs based on mode
    const urlsToTest = multipleMode
      ? urls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
      : [url.trim()];

    if (urlsToTest.length === 0) {
      setError("Enter at least one URL.");
      return;
    }


    if (viewports.length === 0) { setError("Select at least one viewport."); return; }
    if (!Object.values(checks).some(Boolean)) { setError("Select at least one check."); return; }

    setLoading(true); setError(""); setProgress(10);
    setStatusMsg(`Starting test${urlsToTest.length > 1 ? `s for ${urlsToTest.length} URLs` : ''}...`);

    try {
      const testRunIds: string[] = [];
      const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      const batchId = urlsToTest.length > 1 ? generateId() : null;
      const batchName = urlsToTest.length > 1 ? `Batch Test - ${new Date().toLocaleString()}` : null;

      // ⚡ Submit all URLs in parallel (much faster than sequential)
      setStatusMsg(`Submitting ${urlsToTest.length} test${urlsToTest.length > 1 ? 's' : ''} in parallel...`);

      const submissions = await Promise.allSettled(
        urlsToTest.map(async (testUrl, index) => {
          // ⚡ Stagger submissions by 150ms to avoid hammering the API/ECS
          if (index > 0) await new Promise(r => setTimeout(r, index * 150));

          return fetch("/api/test/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: testUrl,
              viewports,
              checks,
              batchId,
              batchName
            }),
          }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed to start test for ${testUrl}`);
            return { testRunId: data.testRunId, url: testUrl };
          });
        })
      );

      // Collect successful submissions
      const successful = submissions.filter(s => s.status === "fulfilled") as PromiseFulfilledResult<{ testRunId: string; url: string }>[];
      const failed = submissions.filter(s => s.status === "rejected") as PromiseRejectedResult[];

      if (successful.length === 0) {
        throw new Error("All test submissions failed");
      }

      testRunIds.push(...successful.map(s => s.value.testRunId));

      if (failed.length > 0) {
        console.warn(`${failed.length} test(s) failed to submit:`, failed.map(f => f.reason));
      }

      setProgress(20);
      setStatusMsg(`Running ${testRunIds.length} test${testRunIds.length > 1 ? 's' : ''} in parallel...`);

      // ⚡ Use Server-Sent Events (SSE) for real-time updates instead of polling
      const eventSources: EventSource[] = [];
      const testStatuses = new Map<string, string>();

      testRunIds.forEach(testRunId => {
        const eventSource = new EventSource(`/api/test/stream?testRunId=${testRunId}`);
        eventSources.push(eventSource);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.screenshot_url) {
              setLiveScreenshot(data.screenshot_url);
            }
            if (data.viewport) {
              setLiveViewport(data.viewport);
            }

            // ⚡ Update local status map to track completion
            testStatuses.set(testRunId, data.status);

            // Update progress
            const completed = Array.from(testStatuses.values()).filter(s => s === "completed").length;
            const failedCounts = Array.from(testStatuses.values()).filter(s => s === "failed").length;
            const totalTests = testRunIds.length;

            setProgress(20 + (completed / totalTests) * 70);
            const runningTests = totalTests - completed - failedCounts;
            setStatusMsg(`${completed} completed, ${runningTests} running${failedCounts > 0 ? `, ${failedCounts} failed` : ''}`);

            // Check if all tests are done
            if (completed + failedCounts === totalTests) {
              // Close all event sources
              eventSources.forEach(es => es.close());

              setProgress(100);

              if (totalTests === 1) {
                setStatusMsg("Complete! Redirecting...");
                setTimeout(() => {
                  window.location.href = `/test/${testRunIds[0]}`;
                }, 800);
              } else {
                setStatusMsg(`All tests complete! ${completed} succeeded, ${failedCounts} failed.`);
                setTimeout(() => {
                  // Redirect to batch view
                  window.location.href = `/test/batch/${batchId}`;
                }, 2000);
              }
            }
          } catch (err) {
            console.error("Failed to parse SSE data:", err);
          }
        };

        eventSource.onerror = (error) => {
          console.error(`SSE error for ${testRunId}:`, error);
          testStatuses.set(testRunId, "failed");
          eventSource.close();
        };
      });

      // Cleanup on unmount
      return () => {
        eventSources.forEach(es => es.close());
      };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false); setProgress(0);
    }
  }

  if (loading) {
    return (
      <div className="w-full md:px-10 mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header: Exact GTmetrix Hierarchy (Light Theme) */}
        <div className="space-y-2 border-b border-slate-300 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#3388cc] flex items-center gap-3">
            Analyzing your URL...
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-gray-500 truncate max-w-4xl">
            {url || (urls.split('\n')[0])}
          </p>
        </div>

        {/* 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left: Preview & Details (7/12) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex flex-col items-center justify-center space-y-8">

              {/* Dynamic Device Frames */}
              <div className="w-full flex flex-col items-center">

                {/* Desktop Frame */}
                {liveViewport === "desktop" && (
                  <div className="w-full relative animate-in fade-in zoom-in duration-500">
                    <div className="bg-white border border-slate-300 border-b-0 rounded-t-2xl py-3 px-5 flex items-center justify-between shadow-sm">
                      <div className="flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-yellow-400" />
                        <div className="h-3 w-3 rounded-full bg-green-400" />
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Desktop Preview</div>
                    </div>
                    <div className="aspect-video rounded-b-2xl overflow-hidden border border-slate-300 bg-white shadow-xl relative group">
                      {liveScreenshot ? (
                        <img src={liveScreenshot} alt="Desktop" className="w-full h-full object-cover object-top transition-all duration-700" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initializing Browser...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tablet Frame (iPad style) */}
                {/* {liveViewport === "tablet" && (
                  <div className="relative w-[510px] h-[680px] bg-slate-900 rounded-[2.5rem] p-2 shadow-2xl border-[3px] border-slate-700 animate-in fade-in zoom-in duration-500">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-800 rounded-b-xl" />
                    <div className="w-full h-full bg-white rounded-2xl overflow-hidden border border-slate-600 relative">
                      {liveScreenshot ? (
                        <img src={liveScreenshot} alt="Tablet" className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" /></div>
                      )}
                    </div>
                  </div>
                )} */}
                {liveViewport === "tablet" && (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                    {/* iPad body */}
                    <div
                      className="relative bg-[#1a1a1a] border-[3px] border-[#3a3a3a] rounded-[22px] flex flex-col items-center"
                      style={{ aspectRatio: '3/4', height: 'clamp(300px, 55vw, 460px)', padding: '10px 6px' }}
                    >
                      {/* Left volume button */}
                      <div className="absolute -left-[5px] top-12 w-[3px] h-6 bg-[#2e2e2e] rounded-l" />
                      {/* Camera */}
                      <div className="w-2 h-2 rounded-full bg-[#2a2a2a] border border-[#444] mb-2 shrink-0" />
                      {/* Screen */}
                      <div className="flex-1 w-full bg-white rounded-xl overflow-hidden relative">
                        {liveScreenshot ? (
                          <img src={liveScreenshot} alt="Tablet preview" className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                          </div>
                        )}
                      </div>
                      {/* Home indicator */}
                      <div className="w-10 h-1.5 bg-[#333] rounded-full mt-2 shrink-0" />
                    </div>
                  </div>
                )}

                {/* Mobile Frame (iPhone 14 style) */}
                {/* {liveViewport === "mobile" && (
                  <div className="relative w-[340px] h-[680px] bg-slate-900 rounded-[3.5rem] p-2.5 shadow-2xl border-[6px] border-slate-700 animate-in fade-in zoom-in duration-500">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-full z-20 border border-slate-800/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a] absolute right-4" />
                    </div>
                    <div className="w-full h-full bg-white rounded-[3rem] overflow-hidden border border-slate-600 relative">
                      {liveScreenshot ? (
                        <img src={liveScreenshot} alt="Mobile" className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" /></div>
                      )}
                    </div>
                  </div>
                )} */}
                {liveViewport === "mobile" && (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                    {/* iPhone body */}
                    <div
                      className="relative bg-[#1a1a1a] border-[1px] border-[#3a3a3a] flex flex-col items-center"
                      style={{ aspectRatio: '9/19.5', height: 'clamp(300px, 60vw, 480px)', borderRadius: '42px', padding: '5px 5px 10px' }}
                    >
                      {/* Side button */}
                      <div className="absolute -right-[5px] top-20 w-[3px] h-14 bg-[#2e2e2e] rounded-r" />
                      {/* Dynamic Island */}
                      <div className="w-20 h-[22px] bg-gray-400 rounded-full mb-2 shrink-0 flex items-center justify-end pr-2 gap-1">
                        <div className="w-[7px] h-[7px] rounded-full bg-[#1a1a1a]" />
                        <div className="w-[9px] h-[9px] rounded-full bg-[#1c1c1c] border border-[#2a2a2a]" />
                      </div>
                      {/* Screen */}
                      <div className="flex-1 w-full bg-white rounded-[28px] overflow-hidden relative">
                        {liveScreenshot ? (
                          <img src={liveScreenshot} alt="Mobile preview" className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                          </div>
                        )}
                      </div>
                      {/* Home indicator */}
                      <div className="w-11 h-1.5 bg-[#333] rounded-full mt-2 shrink-0" />
                    </div>
                  </div>
                )}

                {/* Device Status Label */}
                <div className="mt-4 px-4 py-1.5 bg-white rounded-full border border-slate-300 shadow-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                    Live: {liveViewport} testing in progress
                  </span>
                </div>
              </div>

              {/* Runner Identity Box */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-300 shadow-sm flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-xl">🇺🇸</div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Test Server</p>
                    <p className="text-sm font-bold text-slate-800">Virginia, USA</p>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-300 shadow-sm flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Play className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Browser Engine</p>
                    <p className="text-sm font-bold text-slate-800">Playwright / Chromium</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Steps (5/12) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              {[
                { label: "Adding job to queue...", minPrg: 0, maxPrg: 20 },
                { label: "Starting browser instance...", minPrg: 20, maxPrg: 40 },
                { label: "Auditing performance metrics...", minPrg: 40, maxPrg: 65 },
                { label: "Technical QA & Security scan...", minPrg: 65, maxPrg: 90 },
                { label: "Generating final report...", minPrg: 90, maxPrg: 100 },
              ].map((step, i) => {
                const stepPrg = Math.min(100, Math.max(0, ((progress - step.minPrg) / (step.maxPrg - step.minPrg)) * 100));
                const isActive = progress >= step.minPrg && progress < step.maxPrg;
                const isDone = progress >= step.maxPrg;

                return (
                  <div key={i} className={`p-5 rounded-2xl border transition-all duration-500 shadow-sm ${isActive ? "bg-white border-primary/40 shadow-xl shadow-primary/5 scale-[1.02]" :
                    isDone ? "bg-green-50/50 border-green-200" : "bg-white/40 border-slate-200 opacity-60 grayscale"
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-black w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isDone ? "bg-green-100 text-green-600" : isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                          }`}>
                          {i + 1}
                        </span>
                        <h3 className={`text-sm font-bold tracking-tight ${isDone ? "text-slate-800" : isActive ? "text-slate-900" : "text-slate-400"}`}>
                          {step.label}
                        </h3>
                      </div>
                      {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {isDone && (
                        <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                    {(isActive || isDone) && (
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isDone ? "w-full bg-green-500" : "bg-primary"}`} style={{ width: `${stepPrg}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Premium Tip Section (Light) */}
            <div className="p-8 rounded-3xl bg-white border border-slate-300 shadow-lg group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] group-hover:bg-primary/10 transition-all duration-700" />
              <div className="relative z-10">
                <div className="bg-blue-50 text-primary text-[10px] font-black px-3 py-1.5 rounded-full w-fit mb-4 uppercase tracking-[0.2em] border border-blue-100">
                  Pro Insight
                </div>
                <p className="text-sm font-bold text-slate-900 mb-2 leading-tight">Optimizing User Experience</p>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  We use a specialized cluster of 24 high-performance CPUs to ensure zero-jitter performance profiling and accurate Core Web Vitals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-6 transition-all duration-500">
      <Card className="bg-white border-slate-300 shadow-xl overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-focus-within:bg-primary transition-colors" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight text-slate-900">Enter Website URL</CardTitle>
            <button
              type="button"
              onClick={() => setMultipleMode(!multipleMode)}
              disabled={loading}
              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
            >
              {multipleMode ? 'Switch to Single URL' : 'Multiple URL Batch Mode'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {multipleMode ? (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  placeholder="https://example.com&#10;https://another-site.com"
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  required
                  disabled={loading}
                  rows={6}
                  className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-slate-900 placeholder:text-slate-400"
                />
                <div className="absolute bottom-3 right-4 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500">
                  {urls.split('\n').filter(u => u.trim()).length} URLs
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Maximum 5 URLs for guest batch testing.</p>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="url"
                placeholder="https://your-website.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
                className="h-14 px-5 text-base bg-white border-slate-300 rounded-xl focus:ring-primary/50 focus:border-primary text-slate-900 placeholder:text-slate-400 shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 text-primary pointer-events-none">
                <Play className="h-4 w-4" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-center gap-3 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl shadow-sm">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:grayscale"
        disabled={loading}
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Initializing Analysis...</>
        ) : (
          <><Play className="h-5 w-5 mr-2" /> RUN COMPREHENSIVE QA TEST</>
        )}
      </Button>

      <p className="text-center text-slate-500 text-[11px] uppercase tracking-widest font-medium">
        Powered by Autonomous QA Intelligence
      </p>
    </form>
  );
}
