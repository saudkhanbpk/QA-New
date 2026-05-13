import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// List of super admin email addresses
const SUPER_ADMINS = ["admin@autoqa.com"];

// Check if user is super admin
async function checkAdminAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized" };
  }

  const userEmail = (user.email || "").toLowerCase();
  const isAdmin = SUPER_ADMINS.some(admin => admin.toLowerCase() === userEmail);

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden: Admin access required" };
  }

  return { authorized: true, user };
}

// DELETE - Delete user account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const userId = params.id;
  const admin = createAdminClient();

  try {
    // Delete user's test runs first (cascade)
    await admin.from("test_runs").delete().eq("user_id", userId);

    // Delete user profile
    await admin.from("profiles").delete().eq("id", userId);

    // Delete from auth.users using admin API
    const { error: authError } = await admin.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Ban/Unban user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const userId = params.id;
  const body = await request.json();
  const { banned } = body;

  if (typeof banned !== "boolean") {
    return NextResponse.json({ error: "Invalid request: banned must be boolean" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    // Update user ban status using Supabase Admin API
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "876000h" : "none", // 100 years or none
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: banned ? "User banned successfully" : "User unbanned successfully",
      banned 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
