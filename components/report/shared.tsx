"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Wrench, Monitor, Smartphone, Tablet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TestResult, ResultStatus, Severity } from "@/types";

// ── StatusIcon ────────────────────────────────────────────────────────────────
export function StatusIcon({ status }: { status: ResultStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />;
}

// ── SeverityBadge ─────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[severity]}`}>
      {severity}
    </span>
  );
}

// ── RunStatusBadge ────────────────────────────────────────────────────────────
export function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    running: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] || map.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── ViewportIcon ──────────────────────────────────────────────────────────────
export function ViewportIcon({ viewport }: { viewport: string }) {
  if (viewport === "mobile") return <Smartphone className="h-4 w-4" />;
  if (viewport === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

// ── FixCard ───────────────────────────────────────────────────────────────────
export function FixCard({ recommendation }: { recommendation: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        How to fix
      </p>
      <p className="text-xs text-blue-800 dark:text-blue-300">{recommendation}</p>
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
export function ResultCard({ result }: { result: TestResult }) {
  const [open, setOpen] = useState(false);
  const hasFix = !!result.fix_recommendation && result.status !== "pass";

  return (
    <Card
      className={`border-l-4 ${
        result.status === "pass"
          ? "border-l-green-500"
          : result.status === "fail"
          ? "border-l-red-500"
          : "border-l-yellow-500"
      }`}
    >
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <StatusIcon status={result.status} />
            <div className="min-w-0">
              <p className="text-[13px] sm:text-sm font-medium break-words">{result.check_name}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 break-words">
                {result.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0 pl-7 sm:pl-0">
            <SeverityBadge severity={result.severity} />
            {hasFix && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(!open)}
                className="gap-1 text-xs h-7"
              >
                <Wrench className="h-3 w-3" />
                How to fix
              </Button>
            )}
          </div>
        </div>
        {open && hasFix && (
          <div className="mt-3 pl-7 sm:pl-0">
            <FixCard recommendation={result.fix_recommendation!} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CategoryHeader ────────────────────────────────────────────────────────────
export function CategoryHeader({ results }: { results: TestResult[] }) {
  const passes = results.filter((r) => r.status === "pass").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  if (results.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground pb-1">
      <span className="text-green-600 font-medium">{passes} passed</span>
      {fails > 0 && <span className="text-red-600 font-medium">{fails} failed</span>}
      {warnings > 0 && <span className="text-yellow-600 font-medium">{warnings} warnings</span>}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground text-sm">
        No {label} checks were run.
      </CardContent>
    </Card>
  );
}
