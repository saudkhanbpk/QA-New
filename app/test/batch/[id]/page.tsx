import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, CheckCircle2, XCircle, Clock, BarChart3 } from "lucide-react";
import type { TestRun } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function BatchViewPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const batchId = params.id;

  // Fetch all test runs in this batch
  const { data: testRuns } = await supabase
    .from("test_runs")
    .select("*")
    .eq("batch_id", batchId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!testRuns || testRuns.length === 0) {
    redirect("/dashboard");
  }

  const runs: TestRun[] = testRuns;
  const batchName = runs[0].batch_name || "Batch Test";
  const totalTests = runs.length;
  const completedTests = runs.filter(r => r.status === "completed").length;
  const failedTests = runs.filter(r => r.status === "failed").length;
  const runningTests = runs.filter(r => r.status === "running").length;
  
  // Calculate average score
  const completedScores = runs
    .filter(r => r.status === "completed" && r.overall_score !== null)
    .map(r => r.overall_score as number);
  const averageScore = completedScores.length > 0
    ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} />
      <main className="flex-1 container py-8 max-w-6xl">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Batch Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{batchName}</h1>
          <p className="text-muted-foreground">
            Tested on {new Date(runs[0].created_at).toLocaleString()}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total URLs</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedTests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{failedTests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {averageScore !== null ? (
                <div className={`text-2xl font-bold ${
                  averageScore >= 90 ? "text-green-600" :
                  averageScore >= 70 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {averageScore}
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">-</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Results List */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runs.map((run, index) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">{run.page_url}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(run.created_at).toLocaleTimeString()}
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
                    <Badge
                      variant={
                        run.status === "completed" ? "default" :
                        run.status === "failed" ? "destructive" :
                        run.status === "running" ? "secondary" : "outline"
                      }
                    >
                      {run.status}
                    </Badge>
                    <Link href={`/test/${run.id}`}>
                      <Button variant="outline" size="sm">
                        View Report
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {runningTests > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {runningTests} test{runningTests > 1 ? 's' : ''} still running. This page will auto-refresh.
          </div>
        )}
      </main>
    </div>
  );
}
