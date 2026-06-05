import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/navbar";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

import { isSuperAdmin, SUPER_ADMINS } from "@/lib/auth-constants";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user is super admin using centralized logic
  const isAdmin = isSuperAdmin(user.email);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch all users (excluding super admins)
  const { data: allProfiles } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Filter out super admin accounts from the list
  const profiles = allProfiles?.filter(profile => {
    const profileEmail = (profile.email || "").toLowerCase();
    return !SUPER_ADMINS.some(adminEmail => adminEmail.toLowerCase() === profileEmail);
  }) || [];

  // Fetch ban status for each user from auth.users
  const profilesWithBanStatus = await Promise.all(
    profiles.map(async (profile) => {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        return {
          ...profile,
          banned: authUser?.user?.banned_until ? new Date(authUser.user.banned_until) > new Date() : false,
        };
      } catch {
        return { ...profile, banned: false };
      }
    })
  );

  // Fetch all test runs with user info
  const { data: allTestRuns } = await admin
    .from("test_runs")
    .select(`
      *,
      profiles:user_id (
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  // Calculate statistics
  const totalUsers = profilesWithBanStatus?.length || 0;
  const totalTests = allTestRuns?.length || 0;
  const completedTests = allTestRuns?.filter(t => t.status === "completed").length || 0;
  const failedTests = allTestRuns?.filter(t => t.status === "failed").length || 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user.email} isAdmin={true} />
      <main className="flex-1 container py-8 max-w-7xl">
        <AdminDashboard
          profiles={profilesWithBanStatus || []}
          testRuns={allTestRuns || []}
          stats={{
            totalUsers,
            totalTests,
            completedTests,
            failedTests,
          }}
        />
      </main>
    </div>
  );
}
