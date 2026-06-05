import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/navbar";
import { DashboardContent } from "@/components/dashboard-content";
import type { TestRun } from "@/types";

import { isSuperAdmin } from "@/lib/auth-constants";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user is super admin using centralized logic
  const isAdmin = isSuperAdmin(user.email);

  const { data: runs } = await supabase
    .from("test_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const testRuns: TestRun[] = runs || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} isAdmin={isAdmin} />
      <DashboardContent testRuns={testRuns} userEmail={user.email} />
    </div>
  );
}
