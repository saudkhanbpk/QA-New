import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroUrlForm } from "@/components/hero-url-form";
import { ArrowRight, CheckCircle, Clock, Globe, Shield, Zap } from "lucide-react";
import type { TestRun } from "@/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let recentRuns: TestRun[] = [];
  if (user) {
    const { data } = await supabase
      .from("test_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    recentRuns = data || [];
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user?.email} />

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">Automated QA Testing</Badge>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Test any webpage in <span className="text-primary">seconds</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mb-8">
          Run automated responsive, functional, and accessibility checks on any URL.
          Get detailed reports with fix recommendations instantly.
        </p>
        <HeroUrlForm isLoggedIn={!!user} />
      </section>

      {/* How it works */}
      <section className="border-t py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Globe, step: "1", title: "Enter a URL", desc: "Paste any public webpage URL you want to test." },
              { icon: Zap, step: "2", title: "Run automated checks", desc: "We test responsive layout, functionality, and accessibility using Playwright and axe-core." },
              { icon: CheckCircle, step: "3", title: "Get your report", desc: "View detailed results with severity levels and code-level fix recommendations." },
            ].map(({ icon: Icon, step, title, desc }) => (
              <Card key={step} className="text-center">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="mx-auto w-fit">Step {step}</Badge>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recent runs */}
      {user && recentRuns.length > 0 && (
        <section className="border-t py-12 px-4">
          <div className="container max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Recent test runs</h2>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1">
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Card key={run.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate max-w-xs">{run.page_url}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(run.created_at).toLocaleDateString()}
                      </div>
                      <StatusBadge status={run.status} />
                      <Link href={`/test/${run.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        QA Testing System — built with Next.js, Supabase & Playwright
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning" }> = {
    completed: { label: "Completed", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
    running: { label: "Running", variant: "warning" },
    pending: { label: "Pending", variant: "secondary" },
  };
  const { label, variant } = map[status] || { label: status, variant: "secondary" };
  return <Badge variant={variant as "success"}>{label}</Badge>;
}
