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
    if (viewports.length === 0) { setError("Select at least one viewport."); return; }
    if (!Object.values(checks).some(Boolean)) { setError("Select at least one check."); return; }
    
    setLoading(true); setError(""); setProgress(10); 
    setStatusMsg(`Starting test${urlsToTest.length > 1 ? `s for ${urlsToTest.length} URLs` : ''}...`);
    
    try {
      const testRunIds: string[] = [];
      
      // Submit all URLs
      for (let i = 0; i < urlsToTest.length; i++) {
        const testUrl = urlsToTest[i];
        setStatusMsg(`Submitting test ${i + 1}/${urlsToTest.length}: ${testUrl.slice(0, 40)}...`);
        
        const res = await fetch("/api/test/run", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: testUrl, viewports, checks }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to start test for ${testUrl}`);
        testRunIds.push(data.testRunId);
        setProgress(10 + (i + 1) * (10 / urlsToTest.length));
      }
      
      setProgress(20); setStatusMsg(`Running ${testRunIds.length} test${testRunIds.length > 1 ? 's' : ''}...`);
      
      // Poll all tests
      const poll = setInterval(async () => {
        const statuses = await Promise.all(
          testRunIds.map(id => fetch(`/api/test/status/${id}`).then(r => r.json()))
        );
        
        const completed = statuses.filter(s => s.status === "completed").length;
        const failed = statuses.filter(s => s.status === "failed").length;
        const running = statuses.length - completed - failed;
        
        setProgress(20 + (completed / statuses.length) * 70);
        setStatusMsg(`${completed} completed, ${running} running${failed > 0 ? `, ${failed} failed` : ''}`);
        
        if (completed + failed === statuses.length) {
          clearInterval(poll);
          setProgress(100);
          
          if (testRunIds.length === 1) {
            setStatusMsg("Complete! Redirecting...");
            setTimeout(() => router.push(`/test/${testRunIds[0]}`), 800);
          } else {
            setStatusMsg(`All tests complete! ${completed} succeeded, ${failed} failed.`);
            setTimeout(() => router.push(`/dashboard`), 2000);
          }
        }
      }, 2000);
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
                placeholder="Enter URLs (one per line):&#10;https://example.com&#10;https://another-site.com&#10;https://third-site.com"
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
              className="text-base" 
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Viewports</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {VIEWPORTS.map(({ id, label, desc }) => (
            <button key={id} type="button" onClick={() => toggleViewport(id)} disabled={loading}
              className={`flex flex-col items-center px-5 py-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                viewports.includes(id) ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}>
              <span>{label}</span>
              <span className="text-xs font-normal opacity-70">{desc}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Checks to run</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {CHECKS.map(({ id, label, desc }) => (
            <label key={id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              checks[id] ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input type="checkbox" checked={checks[id]} onChange={() => toggleCheck(id)}
                disabled={loading} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}
      {loading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">{statusMsg}</p>
        </div>
      )}
      <Button type="submit" className="w-full gap-2 h-11" disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running tests...</> : <><Play className="h-4 w-4" /> Start Test</>}
      </Button>
    </form>
  );
}
