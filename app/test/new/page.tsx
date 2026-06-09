"use client";

import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { NewTestForm } from "@/components/new-test-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function NewTestContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("id");

  if (!runId) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white border-slate-200">
          <CardHeader>
            <CardTitle>No Test Run Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter a URL on the home page to create a test run and view results here.
            </p>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-screen-2xl mx-auto px-4 w-full py-8">
      <div className="w-full">
        <NewTestForm testRunId={runId} />
      </div>
    </main>
  );
}

export default function NewTestPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-200 text-slate-900">
      <Navbar />
      <Suspense fallback={
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading...</p>
        </main>
      }>
        <NewTestContent />
      </Suspense>
    </div>
  );
}
