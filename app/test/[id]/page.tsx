import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // List of super admin email addresses
  const SUPER_ADMINS = ["admin@autoqa.com"];
  const userEmail = (user?.email || "").toLowerCase();
  const isAdmin = user ? SUPER_ADMINS.some(admin => admin.toLowerCase() === userEmail) : false;

  // Use admin client for admins to bypass RLS, regular client for users
  const dbClient = isAdmin ? createAdminClient() : supabase;

  // Fetch test run - admins can view any test, regular users only their own
  const query = dbClient
    .from("test_runs")
    .select("*")
    .eq("id", id);

  // If not admin, restrict to user's own tests or anonymous tests
  if (!isAdmin) {
    if (user) {
      query.eq("user_id", user.id);
    } else {
      query.is("user_id", null);
    }
  }

  const { data: run } = await query.single();

  if (!run) notFound();

  const { data: results } = await dbClient
    .from("test_results")
    .select("*")
    .eq("test_run_id", id)
    .order("created_at", { ascending: true });

  const { data: screenshots } = await dbClient
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
      <Navbar userEmail={user?.email} />
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
