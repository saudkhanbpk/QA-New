import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Try to get user by email using admin API
    const { data: { users }, error } = await admin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Find user with matching email (case-insensitive)
    const existingUser = users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!existingUser) {
      // User doesn't exist - can proceed with registration
      return NextResponse.json({ exists: false, verified: false });
    }

    // Check if email is confirmed
    const isVerified = existingUser.email_confirmed_at !== null;

    return NextResponse.json({
      exists: true,
      verified: isVerified,
      userId: existingUser.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
