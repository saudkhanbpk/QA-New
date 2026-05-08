import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: run, error: runError } = await supabase
    .from("test_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "Test run not found" }, { status: 404 });
  }

  const { data: results } = await supabase
    .from("test_results")
    .select("*")
    .eq("test_run_id", id)
    .order("created_at", { ascending: true });

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("*")
    .eq("test_run_id", id);

  return NextResponse.json({ run, results: results || [], screenshots: screenshots || [] });
}
