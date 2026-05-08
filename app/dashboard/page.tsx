import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Clock, ArrowRight, FileText } from "lucide-react";
import type { TestRun } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("test_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const testRuns: TestRun[] = runs || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} />
      <main className="flex-1 container py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {testRuns.length} test run{testRuns.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <Link href="/test/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Test
            </Button>
          </Link>
        </div>

        {testRuns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No tests yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Run your first QA test to see results here.
              </p>
              <Link href="/test/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Start your first test
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {testRuns.map((run) => (
              <TestRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TestRunRow({ run }: { run: TestRun }) {
  const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    completed: { label: "Completed", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
    running: { label: "Running", variant: "warning" },
    pending: { label: "Pending", variant: "secondary" },
  };
  const { label, variant } = statusConfig[run.status] || { label: run.status, variant: "secondary" };

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{run.page_url}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              {new Date(run.created_at).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {run.status === "completed" && run.overall_score !== null && (
            <div className="text-center px-3 py-1 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className={`text-lg font-bold ${
                run.overall_score >= 90 ? "text-green-600" :
                run.overall_score >= 70 ? "text-yellow-600" :
                run.overall_score >= 50 ? "text-orange-600" :
                "text-red-600"
              }`}>
                {run.overall_score}
              </p>
            </div>
          )}
          <Badge variant={variant as "success"}>{label}</Badge>
          <Link href={`/test/${run.id}`}>
            <Button variant="outline" size="sm" className="gap-1">
              View Report
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}


