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
  { id: "responsive", label: "Responsive Layout", desc: "Overflow, font size, touch targets, viewport meta" },
  { id: "functional", label: "Functional QA", desc: "Buttons, broken links (HTTP), forms, JS errors" },
  { id: "accessibility", label: "Accessibility (axe-core)", desc: "WCAG violations, keyboard navigation" },
  { id: "visual", label: "Visual Screenshots", desc: "Capture screenshots at each viewport" },
  { id: "performance", label: "Performance (Lighthouse)", desc: "LCP, FCP, TTFB, CLS, TBT, Speed Index" },
  { id: "security", label: "Security Headers", desc: "HTTPS, CSP, HSTS, X-Frame-Options, cookies" },
  { id: "seo", label: "SEO Audit", desc: "Title, meta, OG tags, canonical, lang, H1, sitemap" },
  { id: "compatibility", label: "Cross-Browser Testing", desc: "Test on Chrome, Firefox, Safari (WebKit)" },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];

export function NewTestForm({ prefillUrl }: { prefillUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(prefillUrl || "");
  const [viewports, setViewports] = useState<Viewport[]>(["mobile", "tablet", "desktop"]);
  const [checks, setChecks] = useState<Record<CheckId, boolean>>({
    responsive: true, functional: true, accessibility: true, visual: true,
    performance: true, security: true, seo: true, compatibility: true,
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
    if (!url.trim()) return;
    if (viewports.length === 0) { setError("Select at least one viewport."); return; }
    if (!Object.values(checks).some(Boolean)) { setError("Select at least one check."); return; }
    setLoading(true); setError(""); setProgress(10); setStatusMsg("Starting test...");
    try {
      const res = await fetch("/api/test/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), viewports, checks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start test");
      const testRunId = data.testRunId;
      setProgress(20); setStatusMsg("Test running...");
      const poll = setInterval(async () => {
        const statusRes = await fetch(`/api/test/status/${testRunId}`);
        const statusData = await statusRes.json();
        if (statusData.status === "completed") {
          clearInterval(poll); setProgress(100); setStatusMsg("Complete! Redirecting...");
          setTimeout(() => router.push(`/test/${testRunId}`), 800);
        } else if (statusData.status === "failed") {
          clearInterval(poll);
          setError(statusData.error || "Test failed. The URL may be unreachable.");
          setLoading(false); setProgress(0);
        } else {
          setProgress((p) => Math.min(p + 7, 90));
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
        <CardHeader><CardTitle className="text-base">Target URL</CardTitle></CardHeader>
        <CardContent>
          <Input type="url" placeholder="https://example.com" value={url}
            onChange={(e) => setUrl(e.target.value)} required disabled={loading} className="text-base" />
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
