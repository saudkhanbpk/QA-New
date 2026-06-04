import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/navbar";
import { DashboardContent } from "@/components/dashboard-content";
import type { TestRun } from "@/types";

// List of super admin email addresses
const SUPER_ADMINS = [
  "admin@autoqa.com",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user is super admin (case-insensitive)
  const userEmail = (user.email || "").toLowerCase();
  const isAdmin = SUPER_ADMINS.some(admin => admin.toLowerCase() === userEmail);

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
