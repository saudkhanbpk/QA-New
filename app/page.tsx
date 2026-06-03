import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroUrlForm } from "@/components/hero-url-form";
import { ArrowRight, CheckCircle, Clock, Globe, Shield, Zap } from "lucide-react";
import type { TestRun } from "@/types";
import Mainbg2 from "@/components/ui/Mainbg2.png";

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
      <section className="flex-1 flex flex-col justify-center px-2 pl-2 md:pl-20 lg:pl-24 py-20 md:py-40 min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-5rem)]"
        style={{
          backgroundImage: `linear-gradient(rgba(67, 111, 164, 0.8), rgba(67, 115, 173, 0.8)), url(${Mainbg2.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
          Test your website <span className="text-[#003366]">Speed</span>
        </h1>
        <p className="sm:text-lg md:text-2xl text-gray-200 font-semibold max-w-4xl mb-8">
          QA-Tester tells you how your website performs, why it's slow, and how to optimize it.
        </p>
        <HeroUrlForm isLoggedIn={!!user} />
      </section>

      {/* How it works */}
      <section className="bg-slate-900 text-white py-24 px-4 relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-blue-500/5 blur-3xl -z-10" />
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 tracking-tight">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Globe, step: "1", title: "Enter a URL", desc: "Paste any public webpage URL you want to test." },
              { icon: Zap, step: "2", title: "Run automated checks", desc: "We test responsive layout, functionality, and accessibility using Playwright and axe-core." },
              { icon: CheckCircle, step: "3", title: "Get your report", desc: "View detailed results with severity levels and code-level fix recommendations." },
            ].map(({ icon: Icon, step, title, desc }) => (
              <Card key={step} className="bg-white/5 border-white/10 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 group shadow-2xl">
                <CardHeader>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-7 w-7 text-blue-400" />
                  </div>
                  <Badge variant="outline" className="mx-auto w-fit border-blue-500/30 text-blue-400 bg-blue-500/5">Step {step}</Badge>
                  <CardTitle className="text-xl mt-4 text-white">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 leading-relaxed text-sm sm:text-base">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recent runs */}
      {user && recentRuns.length > 0 && (
        <section className="bg-slate-950 text-white py-16 px-4 border-t border-white/5">
          <div className="container max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Recent test runs</h2>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1 text-blue-400 hover:text-blue-300 hover:bg-white/5">
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {recentRuns.map((run) => (
                <Card key={run.id} className="bg-white/5 border-white/10 hover:border-blue-500/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Globe className="h-5 w-5 text-blue-400" />
                      </div>
                      <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-xs text-gray-200">{run.page_url}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(run.created_at).toLocaleDateString()}
                      </div>
                      <StatusBadge status={run.status} />
                      <Link href={`/test/${run.id}`}>
                        <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5">View</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="bg-slate-950 border-t border-white/5 py-8 text-center text-sm text-gray-500">
        <div className="container mx-auto">
          <p>© {new Date().getFullYear()} QA Testing System — built with Next.js, Supabase & Playwright</p>
        </div>
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
