import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { error } from "node:console";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let query = admin.from("test_runs").select("*").eq("id", id);

  if (user) {
    query = query.or(`user_id.eq.${user.id},user_id.is.null`);
  } else {
    query = query.is("user_id", null);
  }

  const { data: run, error: runError } = await query.single();

  if (runError || !run) {
    return NextResponse.json({ error: "Test run not found", runError }, { status: 404 });
  }

  const { data: results } = await admin
    .from("test_results")
    .select("*")
    .eq("test_run_id", id)
    .order("created_at", { ascending: true });

  const { data: screenshots } = await admin
    .from("screenshots")
    .select("*")
    .eq("test_run_id", id);

  return NextResponse.json({ run, results: results || [], screenshots: screenshots || [] });
}
