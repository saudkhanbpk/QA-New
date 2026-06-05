"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReportView } from "@/components/report-view";
import type { Viewport, TestReport } from "@/types";

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

export function NewTestForm({ prefillUrl, testRunId }: { prefillUrl?: string; testRunId?: string }) {
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
  const [showReport, setShowReport] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveViewport, setLiveViewport] = useState<string | null>("desktop");

  const [runStatus, setRunStatus] = useState<string>("pending");
  const [runMessage, setRunMessage] = useState<string>("");
  const [report, setReport] = useState<TestReport | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasAutoStarted = useRef(false);
  const lastScreenshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (testRunId && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      loadRunStatus();
    }
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [testRunId]);

  useEffect(() => {
    if (prefillUrl && !testRunId && !hasAutoStarted.current && !loading) {
      hasAutoStarted.current = true;
      setTimeout(() => { handleSubmit(); }, 500);
    }
  }, [prefillUrl, testRunId]);

  async function loadRunStatus() {
    if (!testRunId) return;
    setLoading(true);
    setRunMessage("Loading test run...");
    try {
      const res = await fetch(`/api/test/${encodeURIComponent(testRunId)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Unable to load test run."); setLoading(false); return; }
      setUrl(data.run.page_url);
      setRunStatus(data.run.status || "pending");

      if (data.run.status === "completed" || data.run.status === "failed") {
        setReport(data);
        setRunMessage(data.run.status === "completed" ? "Test completed." : "Test finished with errors.");
        setShowReport(true);
        setLoading(false);
        return;
      }
      if (data.run.status === "running") {
        setRunMessage("Test is already running.");
        openStream();
        // keep loading: true
        return;
      }
      if (data.run.status === "pending") {
        setRunMessage("Test is pending, starting now...");
        await startRun();
        // keep loading: true — startRun opens the stream
        return;
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load test run.");
      setLoading(false);
    }
  }

  async function startRun() {
    if (!testRunId) return;
    try {
      const res = await fetch(`/api/test/start/${encodeURIComponent(testRunId)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Unable to start the test."); setLoading(false); return; }
      setRunStatus(data.status || "running");
      setRunMessage("Starting the test...");
      openStream();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start the test.");
      setLoading(false);
    }
  }

  function openStream() {
    if (!testRunId || eventSourceRef.current) return;
    const source = new EventSource(`/api/test/stream?testRunId=${encodeURIComponent(testRunId)}`);
    eventSourceRef.current = source;

    source.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.screenshot_url) setLiveScreenshot(data.screenshot_url);
        lastScreenshotRef.current = data.screenshot_url;
        if (data.viewport) setLiveViewport(data.viewport);

        if (data.status) {
          setRunStatus(data.status);

          if (data.status === "running") {
            setRunMessage("Test is running...");
          } else if (data.status === "completed") {
            setRunMessage("Test completed.");
            await loadResults();
            setShowReport(true);
            setLoading(false);
            source.close();
            eventSourceRef.current = null;
          } else if (data.status === "failed") {
            setRunMessage("Test failed.");
            await loadResults();
            setShowReport(true);
            setLoading(false);
            source.close();
            eventSourceRef.current = null;
          }
        }
      } catch (err) {
        console.error("Failed to parse stream message:", err);
      }
    };

    source.onerror = () => {
      setRunMessage("Waiting for updates...");
      source.close();
      eventSourceRef.current = null;
    };
  }

  async function loadResults() {
    if (!testRunId) return;
    try {
      const res = await fetch(`/api/test/${encodeURIComponent(testRunId)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Unable to load results."); return; }
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load results.");
    }
  }

  function toggleViewport(v: Viewport) {
    setViewports((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }
  function toggleCheck(id: CheckId) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const urlsToTest = multipleMode
      ? urls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
      : [url.trim()];
    if (urlsToTest.length === 0) { setError("Enter at least one URL."); return; }
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
      setStatusMsg(`Submitting ${urlsToTest.length} test${urlsToTest.length > 1 ? 's' : ''} in parallel...`);
      const submissions = await Promise.allSettled(
        urlsToTest.map(async (testUrl, index) => {
          if (index > 0) await new Promise(r => setTimeout(r, index * 150));
          return fetch("/api/test/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: testUrl, viewports, checks, batchId, batchName }),
          }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed to start test for ${testUrl}`);
            return { testRunId: data.testRunId, url: testUrl };
          });
        })
      );
      const successful = submissions.filter(s => s.status === "fulfilled") as PromiseFulfilledResult<{ testRunId: string; url: string }>[];
      const failed = submissions.filter(s => s.status === "rejected") as PromiseRejectedResult[];
      if (successful.length === 0) throw new Error("All test submissions failed");
      testRunIds.push(...successful.map(s => s.value.testRunId));
      if (failed.length > 0) console.warn(`${failed.length} test(s) failed to submit:`, failed.map(f => f.reason));
      setProgress(20);
      setStatusMsg(`Running ${testRunIds.length} test${testRunIds.length > 1 ? 's' : ''} in parallel...`);
      const eventSources: EventSource[] = [];
      const testStatuses = new Map<string, string>();
      testRunIds.forEach(id => {
        const eventSource = new EventSource(`/api/test/stream?testRunId=${id}`);
        eventSources.push(eventSource);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.screenshot_url) setLiveScreenshot(data.screenshot_url);
            lastScreenshotRef.current = data.screenshot_url;
            if (data.viewport) setLiveViewport(data.viewport);
            testStatuses.set(id, data.status);
            const completed = Array.from(testStatuses.values()).filter(s => s === "completed").length;
            const failedCounts = Array.from(testStatuses.values()).filter(s => s === "failed").length;
            const totalTests = testRunIds.length;
            setProgress(20 + (completed / totalTests) * 70);
            const runningTests = totalTests - completed - failedCounts;
            setStatusMsg(`${completed} completed, ${runningTests} running${failedCounts > 0 ? `, ${failedCounts} failed` : ''}`);
            if (completed + failedCounts === totalTests) {
              eventSources.forEach(es => es.close());
              setProgress(100);
              if (totalTests === 1) {
                setStatusMsg("Complete! Redirecting...");
                setTimeout(() => { window.location.href = `/test/${testRunIds[0]}`; }, 800);
              } else {
                setStatusMsg(`All tests complete! ${completed} succeeded, ${failedCounts} failed.`);
                setTimeout(() => { window.location.href = `/test/batch/${batchId}`; }, 2000);
              }
            }
          } catch (err) { console.error("Failed to parse SSE data:", err); }
        };
        eventSource.onerror = (err) => {
          console.error(`SSE error for ${id}:`, err);
          testStatuses.set(id, "failed");
          eventSource.close();
        };
      });
      return () => { eventSources.forEach(es => es.close()); };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false); setProgress(0);
    }
  }
  const getsrc = (report: TestReport | null) => {
    const ScreenShot = report?.screenshots.find(s => s.viewport === "desktop");
    const imageurl = ScreenShot?.image_url;
    return imageurl || undefined;
  };

  // ── 1. LOADING / RESULTS STATE ───────────────────────────────────────────────
  if (loading || showReport) {
    return (
      <div className="w-full md:px-10 mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        {!showReport && (
          <div className="space-y-2 border-b border-slate-300 pb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#3388cc] flex items-center gap-3">
              Analyzing your URL...
            </h1>
            <p className="text-xl md:text-2xl font-semibold text-gray-500 truncate max-w-4xl">
              {url || urls.split('\n')[0]}
            </p>
          </div>
        )}

        {/* 2-Column: Device + Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left: Device Preview (7/12) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex flex-col items-center justify-center space-y-8">
              <div className="w-full flex flex-col items-center">

                {/* ── DESKTOP ── */}
                {liveViewport === "desktop" && (
                  <div className={`${showReport ? 'w-[80%]' : 'w-full'} transition-all duration-1000 animate-in fade-in zoom-in duration-500`}>
                    <div className="bg-[#1e1e1e] border border-[#3a3a3a] border-b-0 rounded-t-xl px-4 h-8 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                      <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                      <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                      <div className="flex-1 mx-3 bg-[#2c2c2c] rounded h-[18px] flex items-center px-2">
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                          {url || urls.split('\n')[0]}
                        </span>
                      </div>
                    </div>
                    <div className="aspect-video border border-[#3a3a3a] border-t-0 rounded-b-xl overflow-hidden bg-white relative">
                      {liveScreenshot ? (
                        <img src={liveScreenshot} alt="Desktop preview" className="w-full h-full object-cover object-top transition-all duration-700" />
                      ) : showReport ? (
                        <img src={getsrc(report)} alt="Desktop preview" className="w-full h-full object-cover object-top transition-all duration-700" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initializing Browser...</p>
                        </div>
                      )}
                    </div>
                    <div className="w-[28%] h-3 bg-[#1e1e1e] border border-[#3a3a3a] border-t-0 rounded-b-md mx-auto" />
                    <div className="w-[40%] h-1.5 bg-[#2a2a2a] rounded-full mx-auto" />
                  </div>
                )}

                {/* ── TABLET ── */}
                {liveViewport === "tablet" && (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                    <div
                      className="relative bg-[#1a1a1a] border-[3px] border-[#3a3a3a] rounded-[22px] flex flex-col items-center"
                      style={{ aspectRatio: "3/4", height: "clamp(300px, 55vw, 460px)", padding: "10px 6px" }}
                    >
                      <div className="absolute -left-[5px] top-12 w-[3px] h-6 bg-[#2e2e2e] rounded-l" />
                      <div className="w-2 h-2 rounded-full bg-[#2a2a2a] border border-[#444] mb-2 shrink-0" />
                      <div className="flex-1 w-full bg-white rounded-xl overflow-hidden relative">
                        {liveScreenshot ? (
                          <img src={liveScreenshot} alt="Tablet preview" className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="w-10 h-1.5 bg-[#333] rounded-full mt-2 shrink-0" />
                    </div>
                  </div>
                )}

                {/* ── MOBILE ── */}
                {liveViewport === "mobile" && (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                    <div
                      className="relative bg-[#1a1a1a] border-[3px] border-[#3a3a3a] flex flex-col items-center"
                      style={{ aspectRatio: "9/19.5", height: "clamp(300px, 60vw, 480px)", borderRadius: "42px", padding: "12px 5px 10px" }}
                    >
                      <div className="absolute -right-[5px] top-20 w-[3px] h-14 bg-[#2e2e2e] rounded-r" />
                      <div className="w-20 h-[22px] bg-[#0d0d0d] rounded-full mb-2 shrink-0 flex items-center justify-end pr-2 gap-1">
                        <div className="w-[7px] h-[7px] rounded-full bg-[#1a1a1a]" />
                        <div className="w-[9px] h-[9px] rounded-full bg-[#1c1c1c] border border-[#2a2a2a]" />
                      </div>
                      <div className="flex-1 w-full bg-white rounded-[28px] overflow-hidden relative">
                        {liveScreenshot ? (
                          <img src={liveScreenshot} alt="Mobile preview" className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="w-11 h-1.5 bg-[#333] rounded-full mt-2 shrink-0" />
                    </div>
                  </div>
                )}

                {/* Live badge */}
                <div className="mt-4 px-4 py-1.5 bg-white rounded-full border border-slate-300 shadow-sm flex items-center gap-2">
                  {showReport ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                        {liveViewport} test complete
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                        Live: {liveViewport} testing in progress
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Runner Identity */}
              {/* Runner Identity — hidden when test is complete */}
              {!showReport && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white border border-slate-300 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-xl">🇺🇸</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Test Server</p>
                      <p className="text-sm font-bold text-slate-800">Virginia, USA</p>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-white border border-slate-300 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Play className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Browser Engine</p>
                      <p className="text-sm font-bold text-slate-800">Playwright / Chromium</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Steps (5/12) */}
          <div className="lg:col-span-5 space-y-6">
            {!showReport ? (
              <div className="space-y-3">
                {[
                  { label: "Adding job to queue", icon: "🗂️", minPrg: 0, maxPrg: 20 },
                  { label: "Starting browser instance", icon: "🌐", minPrg: 20, maxPrg: 40 },
                  { label: "Auditing performance metrics", icon: "⚡", minPrg: 40, maxPrg: 65 },
                  { label: "Technical QA & Security scan", icon: "🔒", minPrg: 65, maxPrg: 90 },
                  { label: "Generating final report", icon: "📊", minPrg: 90, maxPrg: 100 },
                ].map((step, i) => {
                  const stepPrg = Math.min(100, Math.max(0, ((progress - step.minPrg) / (step.maxPrg - step.minPrg)) * 100));
                  const isActive = progress >= step.minPrg && progress < step.maxPrg;
                  const isDone = progress >= step.maxPrg;
                  if (isActive) return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-sm border border-blue-200 bg-blue-50 shadow-sm">
                      <div className="h-7 w-7 rounded-sm bg-blue-100 flex items-center justify-center shrink-0">
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 mb-1.5">{step.label}</p>
                        <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all duration-1000" style={{ width: `${stepPrg}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 animate-pulse shrink-0">Running</span>
                    </div>
                  );
                  if (isDone) return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white">
                      <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-sm shadow-green-200">
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="flex-1 text-sm font-semibold text-slate-700">{step.label}</p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Completed</span>
                    </div>
                  );
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-sm border border-slate-100 bg-white/50 opacity-50">
                      <div className="h-7 w-7 rounded-sm bg-slate-100 flex items-center justify-center shrink-0 text-sm">{step.icon}</div>
                      <p className="flex-1 text-sm font-semibold text-slate-400">{step.label}</p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">Queued</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── COMPLETED: Performance Report Header ── */
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-5">
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl md:mt-10 font-semibold text-[#3388cc] leading-tight">Latest Performance Report for:</h2>
                  <p className="text-xl md:text-2xl lg:text-3xl md:mt-5 font-semibold text-slate-600 mt-1 break-all">{url}</p>
                </div>
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  {[
                    { label: "Report generated", value: new Date().toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) },
                    { label: "Test Server Location", value: "🇺🇸  Seattle, WA, USA" },
                    { label: "Using", value: "Chrome 142.0.0.0, Lighthouse 12.6.1" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-3 ">
                      <span className="text-slate-600 font-medium w-44 text-sm md:text-base text-right shrink-0">{label}:</span>
                      <span className="text-slate-5 00  text-sm md:text-base font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pro Insight — hide once report is shown */}
            {!showReport && (
              <div className="p-8 rounded-xl bg-white border border-slate-300 shadow-lg group overflow-hidden relative">
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
            )}
          </div>
        </div>

        {/* ── REPORT SLIDES IN BELOW ── */}
        {showReport && report && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-6 border-t border-slate-200 pt-10">
            {/* <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-900">Test Results</h2>
                <p className="text-sm text-slate-500 truncate max-w-xl">{url}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={"success" as any}>Completed</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReport(null);
                    setShowReport(false);
                    setLoading(false);
                    setProgress(0);
                    setLiveScreenshot(null);
                    setLiveViewport("desktop");
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> New Test
                </Button>
              </div>
            </div> */}
            <ReportView report={report} />
          </div>
        )}

      </div>
    );
  }

  // ── 2. DEFAULT FORM ──────────────────────────────────────────────────────────
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
              {multipleMode ? "Switch to Single URL" : "Multiple URL Batch Mode"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {multipleMode ? (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  placeholder={"https://example.com\nhttps://another-site.com"}
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
        <><Play className="h-5 w-5 mr-2" /> RUN COMPREHENSIVE QA TEST</>
      </Button>

      <p className="text-center text-slate-500 text-[11px] uppercase tracking-widest font-medium">
        Powered by Autonomous QA Intelligence
      </p>
    </form>
  );
}