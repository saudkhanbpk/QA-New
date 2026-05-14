import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Globe, Mail, TestTube, CheckCircle2, XCircle, Clock } from "lucide-react";
import { UserTestHistory } from "@/components/user-test-history";

export const dynamic = "force-dynamic";

// List of super admin email addresses
const SUPER_ADMINS = [
  "admin@autoqa.com",
];

interface PageProps {
  params: {
    id: string;
  };
}

export default async function UserDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user is super admin (case-insensitive)
  const userEmail = (user.email || "").toLowerCase();
  const isAdmin = SUPER_ADMINS.some(admin => admin.toLowerCase() === userEmail);
  
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch user profile
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!profile) {
    redirect("/admin");
  }

  // Fetch user's test runs
  const { data: testRuns } = await admin
    .from("test_runs")
    .select("*")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false });

  const runs = testRuns || [];
  const completedTests = runs.filter(t => t.status === "completed").length;
  const failedTests = runs.filter(t => t.status === "failed").length;
  const runningTests = runs.filter(t => t.status === "running").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} isAdmin={true} />
      <main className="flex-1 container py-8 max-w-5xl">
        {/* Back Button */}
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Dashboard
          </Button>
        </Link>

        {/* User Info Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">User Details</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-muted-foreground">
            <span className="flex items-center gap-1 break-all">
              <Mail className="h-4 w-4 shrink-0" />
              {profile.email}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-4 w-4 shrink-0" />
              Joined {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <TestTube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runs.length}</div>
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
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{runningTests}</div>
            </CardContent>
          </Card>
        </div>

        {/* Test Runs List */}
        <UserTestHistory runs={runs} />
      </main>
    </div>
  );
}
