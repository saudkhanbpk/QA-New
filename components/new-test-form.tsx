"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play } from "lucide-react";
import type { Viewport } from "@/types";

const VIEWPORTS: { id: Viewport; label: string; desc: string }[] = [
  { id: "mobile", label: "Mobile", desc: "375px" },
  { id: "tablet", label: "Tablet", desc: "768px" },
  { id: "desktop", label: "Desktop", desc: "1440px" },
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
  const [viewports, setViewports] = useState<Viewport[]>(["mobile", "tablet", "desktop"]);
  const [checks, setChecks] = useState<Record<CheckId, boolean>>({
    performance: true,
    broken_links: true,
    compatibility: true,
    security: true,
    others: false,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  function toggleViewport(v: Viewport) {
    setViewports((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }
  function toggleCheck(id: CheckId) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Get URLs based on mode
    const urlsToTest = multipleMode
      ? urls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
      : [url.trim()];

    if (urlsToTest.length === 0) {
      setError("Enter at least one URL.");
      return;
    }

    // ⚡ Limit to 5 URLs for optimal performance
    // if (urlsToTest.length > 5) {
    //   setError("Maximum 5 URLs allowed for parallel testing. Please reduce the number of URLs.");
    //   return;
    // }

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

            if (data.error) {
              console.error(`Stream error for ${testRunId}:`, data.error);
              testStatuses.set(testRunId, "failed");
            } else {
              testStatuses.set(testRunId, data.status);
            }

            // Update progress
            const completed = Array.from(testStatuses.values()).filter(s => s === "completed").length;
            const failed = Array.from(testStatuses.values()).filter(s => s === "failed").length;
            const running = testRunIds.length - completed - failed;

            setProgress(20 + (completed / testRunIds.length) * 70);
            setStatusMsg(`${completed} completed, ${running} running${failed > 0 ? `, ${failed} failed` : ''}`);

            // Check if all tests are done
            if (completed + failed === testRunIds.length) {
              // Close all event sources
              eventSources.forEach(es => es.close());

              setProgress(100);

              if (testRunIds.length === 1) {
                setStatusMsg("Complete! Redirecting...");
                setTimeout(() => {
                  window.location.href = `/test/${testRunIds[0]}`;
                }, 800);
              } else {
                setStatusMsg(`All tests complete! ${completed} succeeded, ${failed} failed.`);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Target URL{multipleMode ? 's' : ''}</CardTitle>
            <button
              type="button"
              onClick={() => setMultipleMode(!multipleMode)}
              disabled={loading}
              className="text-xs text-primary hover:underline"
            >
              {multipleMode ? 'Single URL' : 'Multiple URLs'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {multipleMode ? (
            <div className="space-y-2">
              <textarea
                placeholder="Enter URLs (one per line, max 5):&#10;https://example.com&#10;https://another-site.com&#10;https://third-site.com"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                required
                disabled={loading}
                rows={6}
                className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                {urls.split('\n').filter(u => u.trim()).length} URL(s) entered
              </p>
            </div>
          ) : (
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
              className="text-sm sm:text-base"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Viewports</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {VIEWPORTS.map(({ id, label, desc }) => (
            <button key={id} type="button" onClick={() => toggleViewport(id)} disabled={loading}
              className={`flex flex-col items-center px-5 py-3 rounded-lg border-2 transition-colors text-sm font-medium ${viewports.includes(id) ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}>
              <span className="text-[13px] sm:text-sm">{label}</span>
              <span className="text-[10px] sm:text-xs font-normal opacity-70">{desc}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Checks to run</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {CHECKS.map(({ id, label, desc }) => (
            <label key={id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${checks[id] ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input type="checkbox" checked={checks[id]} onChange={() => toggleCheck(id)}
                disabled={loading} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-[13px] sm:text-sm font-medium">{label}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}
      {loading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          {/* <p className="text-sm text-muted-foreground text-center">{statusMsg}</p> */}
        </div>
      )}
      <Button type="submit" className="w-full gap-2 h-11" disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running tests...</> : <><Play className="h-4 w-4" /> Start Test</>}
      </Button>
    </form>
  );
}
