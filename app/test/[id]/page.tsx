import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/navbar";
import { ReportView } from "@/components/report-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { TestReport } from "@/types";

export default async function TestReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: run } = await supabase
    .from("test_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!run) notFound();

  const { data: results } = await supabase
    .from("test_results")
    .select("*")
    .eq("test_run_id", id)
    .order("created_at", { ascending: true });

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("*")
    .eq("test_run_id", id);

  const report: TestReport = {
    run,
    results: results || [],
    screenshots: screenshots || [],
  };

  // Determine back button destination
  const backUrl = run.batch_id ? `/test/batch/${run.batch_id}` : "/dashboard";
  const backLabel = run.batch_id ? "Back to Batch" : "Back to Dashboard";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} />
      <main className="flex-1 container py-8 max-w-5xl">
        {/* Back Button */}
        <Link href={backUrl}>
          <Button variant="ghost" size="sm" className="gap-1 mb-6">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        </Link>

        <ReportView report={report} />
      </main>
    </div>
  );
}
