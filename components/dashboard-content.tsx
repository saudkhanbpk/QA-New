"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Clock, ArrowRight, FileText, Layers, ChevronLeft, ChevronRight, TestTube, CheckCircle2, XCircle, Loader2, Calendar } from "lucide-react";
import type { TestRun } from "@/types";

interface BatchGroup {
  batch_id: string;
  batch_name: string | null;
  test_runs: TestRun[];
  created_at: string;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  average_score: number | null;
}

interface DashboardContentProps {
  testRuns: TestRun[];
}

export function DashboardContent({ testRuns }: DashboardContentProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Group tests by batch_id
  const batches: BatchGroup[] = [];
  const singleTests: TestRun[] = [];
  const batchMap = new Map<string, TestRun[]>();

  testRuns.forEach(run => {
    if (run.batch_id) {
      if (!batchMap.has(run.batch_id)) {
        batchMap.set(run.batch_id, []);
      }
      batchMap.get(run.batch_id)!.push(run);
    } else {
      singleTests.push(run);
    }
  });

  // Convert batch map to batch groups
  batchMap.forEach((runs, batchId) => {
    const completedTests = runs.filter(r => r.status === "completed").length;
    const failedTests = runs.filter(r => r.status === "failed").length;
    const completedScores = runs
      .filter(r => r.status === "completed" && r.overall_score !== null)
      .map(r => r.overall_score as number);
    const averageScore = completedScores.length > 0
      ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
      : null;

    batches.push({
      batch_id: batchId,
      batch_name: runs[0].batch_name || "Batch Test",
      test_runs: runs,
      created_at: runs[0].created_at,
      total_tests: runs.length,
      completed_tests: completedTests,
      failed_tests: failedTests,
      average_score: averageScore,
    });
  });

  // Sort batches by created_at
  batches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Combine batches and single tests for pagination
  const allItems = [...batches, ...singleTests];
  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Paginate items
  const paginatedItems = allItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate statistics
  const totalTests = testRuns.length;
  const completedTests = testRuns.filter(r => r.status === "completed").length;
  const failedTests = testRuns.filter(r => r.status === "failed").length;
  const runningTests = testRuns.filter(r => r.status === "running").length;
  
  // Calculate today's tests
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTests = testRuns.filter(r => {
    const testDate = new Date(r.created_at);
    testDate.setHours(0, 0, 0, 0);
    return testDate.getTime() === today.getTime();
  }).length;

  return (
    <main className="flex-1 container py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalItems} test{totalItems !== 1 ? "s" : ""} total ({batches.length} batch{batches.length !== 1 ? "es" : ""}, {singleTests.length} single)
          </p>
        </div>
        <Link href="/test/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Test
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTests}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTests}</div>
            <p className="text-xs text-muted-foreground">
              {totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedTests}</div>
            <p className="text-xs text-muted-foreground">
              {totalTests > 0 ? Math.round((failedTests / totalTests) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{runningTests}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{todayTests}</div>
            <p className="text-xs text-muted-foreground">Tests run today</p>
          </CardContent>
        </Card>
      </div>

      {totalItems === 0 ? (
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
        <>
          <div className="space-y-3">
            {paginatedItems.map((item) => {
              // Check if it's a batch or single test
              if ('batch_id' in item && 'test_runs' in item) {
                return <BatchRow key={item.batch_id} batch={item as BatchGroup} />;
              } else {
                return <TestRunRow key={(item as TestRun).id} run={item as TestRun} />;
              }
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function BatchRow({ batch }: { batch: BatchGroup }) {
  const allCompleted = batch.completed_tests === batch.total_tests;
  const anyFailed = batch.failed_tests > 0;
  const anyRunning = batch.completed_tests + batch.failed_tests < batch.total_tests;

  const status = allCompleted ? "completed" : anyFailed ? "failed" : anyRunning ? "running" : "pending";
  const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    completed: { label: "Completed", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
    running: { label: "Running", variant: "warning" },
    pending: { label: "Pending", variant: "secondary" },
  };
  const { label, variant } = statusConfig[status];

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Layers className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{batch.batch_name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                {new Date(batch.created_at).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-3 py-1 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">URLs</p>
              <p className="text-lg font-bold">{batch.total_tests}</p>
            </div>
            {batch.average_score !== null && (
              <div className="text-center px-3 py-1 rounded-md bg-muted">
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className={`text-lg font-bold ${
                  batch.average_score >= 90 ? "text-green-600" :
                  batch.average_score >= 70 ? "text-yellow-600" :
                  batch.average_score >= 50 ? "text-orange-600" :
                  "text-red-600"
                }`}>
                  {batch.average_score}
                </p>
              </div>
            )}
            <Badge variant={variant}>{label}</Badge>
            <Link href={`/test/batch/${batch.batch_id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                View Batch
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Show progress */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-green-600">{batch.completed_tests} completed</span>
          {batch.failed_tests > 0 && <span className="text-red-600">{batch.failed_tests} failed</span>}
          {anyRunning && <span className="text-yellow-600">{batch.total_tests - batch.completed_tests - batch.failed_tests} running</span>}
        </div>
      </CardContent>
    </Card>
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
