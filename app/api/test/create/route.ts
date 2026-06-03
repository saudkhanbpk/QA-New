import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL. Must start with http:// or https://" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: testRun, error } = await admin
    .from("test_runs")
    .insert({
      user_id: user?.id || null,
      page_url: url,
      status: "pending"
    })
    .select().single();

  if (error || !testRun) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: "Failed to save URL." }, { status: 500 });
  }

  return NextResponse.json({ testRunId: testRun.id });
}
