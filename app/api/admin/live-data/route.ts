import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// List of super admin email addresses
const SUPER_ADMINS = ["admin@autoqa.com"];

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is super admin (case-insensitive)
  const userEmail = (user.email || "").toLowerCase();
  const isAdmin = SUPER_ADMINS.some(admin => admin.toLowerCase() === userEmail);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
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

  return NextResponse.json({
    profiles: profilesWithBanStatus,
    testRuns: allTestRuns || [],
    stats: {
      totalUsers,
      totalTests,
      completedTests,
      failedTests,
    },
  });
}
