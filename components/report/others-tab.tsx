"use client";

import { FileSearch, RefreshCw } from "lucide-react";
import { ResultCard } from "@/components/report/shared";
import type { TestResult } from "@/types";

export function OthersTabContent({ results }: { results: TestResult[] }) {
  const seoChecks = ["Page Title","Meta Description","Open Graph Tags","Canonical URL","HTML Lang Attribute","H1 Heading","Structured Data (JSON-LD)"];
  const accessibilityChecks = ["axe-core Scan","Keyboard Navigable Elements"];
  const responsiveChecks = ["Viewport Meta Tag","Horizontal Overflow","Font Size","Touch Target Size"];
  const visualChecks = ["Screenshot"];

  const categorizeResult = (result: TestResult) => {
    if (seoChecks.some((check) => result.check_name.includes(check))) return "seo";
    if (accessibilityChecks.some((check) => result.check_name.includes(check))) return "accessibility";
    if (responsiveChecks.some((check) => result.check_name.includes(check))) return "responsive";
    if (visualChecks.some((check) => result.check_name.includes(check))) return "visual";
    if (result.check_name.includes("element") || result.check_name.includes("aria") || result.check_name.includes("color") || result.check_name.includes("label")) return "accessibility";
    return "other";
  };

  const bySubCategory = {
    seo: results.filter((r) => categorizeResult(r) === "seo" || r.category === "seo"),
    quality: results.filter((r) => r.category === "quality"),
    accessibility: results.filter((r) => categorizeResult(r) === "accessibility"),
    responsive: results.filter((r) => categorizeResult(r) === "responsive"),
    visual: results.filter((r) => categorizeResult(r) === "visual"),
  };

  return (
    <div className="space-y-6">
      {bySubCategory.seo.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><FileSearch className="h-4 w-4" /> SEO & Meta Data</h3>
            <span className="text-xs text-muted-foreground">({bySubCategory.seo.filter((r) => r.status === "pass").length}/{bySubCategory.seo.length} passed)</span>
          </div>
          {bySubCategory.seo.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
      {bySubCategory.quality.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Page Quality & Content</h3>
            <span className="text-xs text-muted-foreground">({bySubCategory.quality.filter((r) => r.status === "pass").length}/{bySubCategory.quality.length} passed)</span>
          </div>
          {bySubCategory.quality.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
      {bySubCategory.accessibility.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">♿ Accessibility Checks</h3>
            <span className="text-xs text-muted-foreground">({bySubCategory.accessibility.filter((r) => r.status === "pass").length}/{bySubCategory.accessibility.length} passed)</span>
          </div>
          {bySubCategory.accessibility.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
      {bySubCategory.responsive.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">📱 Responsive Design Checks</h3>
            <span className="text-xs text-muted-foreground">({bySubCategory.responsive.filter((r) => r.status === "pass").length}/{bySubCategory.responsive.length} passed)</span>
          </div>
          {bySubCategory.responsive.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
      {bySubCategory.visual.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-semibold text-primary">📸 Visual Screenshots</h3>
            <span className="text-xs text-muted-foreground">({bySubCategory.visual.length} screenshot{bySubCategory.visual.length !== 1 ? "s" : ""})</span>
          </div>
          {bySubCategory.visual.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}
    </div>
  );
}
