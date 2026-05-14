"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface TestRun {
  id: string;
  page_url: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface UserTestHistoryProps {
  runs: TestRun[];
}

export function UserTestHistory({ runs }: UserTestHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const testsPerPage = 10;

  // Calculate pagination
  const totalPages = Math.ceil(runs.length / testsPerPage);
  const startIndex = (currentPage - 1) * testsPerPage;
  const endIndex = startIndex + testsPerPage;
  const paginatedRuns = runs.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test History</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tests found for this user</p>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedRuns.map((test) => (
                <div
                  key={test.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium text-sm break-all">{test.page_url}</p>
                      <Badge
                        variant={
                          test.status === "completed" ? "default" :
                          test.status === "failed" ? "destructive" :
                          test.status === "running" ? "secondary" : "outline"
                        }
                        className="shrink-0"
                      >
                        {test.status}
                      </Badge>
                      {test.overall_score !== null && (
                        <Badge variant="outline" className={`shrink-0 ${
                          test.overall_score >= 90 ? "text-green-600" :
                          test.overall_score >= 70 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          Score: {test.overall_score}/100
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {new Date(test.created_at).toLocaleString()}
                      </span>
                      {test.completed_at && (
                        <span className="whitespace-nowrap">
                          Completed: {new Date(test.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/test/${test.id}`}
                    className="text-sm text-primary hover:underline whitespace-nowrap text-center sm:text-left"
                  >
                    View Report →
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing {startIndex + 1} to {Math.min(endIndex, runs.length)} of {runs.length} tests
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-sm whitespace-nowrap">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
