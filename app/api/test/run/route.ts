import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import type { Viewport } from "@/types";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

interface RunPayload {
  url: string;
  viewports: Viewport[];
  checks: {
    performance: boolean;
    broken_links: boolean;
    compatibility: boolean;
    security: boolean;
    others: boolean;
  };
  batchId?: string | null;
  batchName?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ⚡ Rate limiting: increased for batch testing
  const rateLimitResult = checkRateLimit(`user:${user.id}`, { maxRequests: 10000, windowMs: 60 * 60 * 1000 });
  if (!rateLimitResult.allowed) {
    const resetDate = new Date(rateLimitResult.resetAt);
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again after ${resetDate.toLocaleTimeString()}` },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  let body: RunPayload;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const { url, viewports, checks, batchId, batchName } = body;
  if (!url || !viewports?.length)
    return NextResponse.json({ error: "URL and viewports are required" }, { status: 400 });

  try {
    const p = new URL(url);
    if (!["http:", "https:"].includes(p.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid URL. Must start with http:// or https://" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: testRun, error: runError } = await admin
    .from("test_runs")
    .insert({
      user_id: user.id,
      page_url: url,
      status: "running",
      batch_id: batchId || null,
      batch_name: batchName || null
    })
    .select().single();

  if (runError || !testRun) {
    console.error("Supabase insert error:", runError);
    return NextResponse.json({ error: `Failed to create test run: ${runError?.message || 'Unknown DB error'}` }, { status: 500 });
  }

  // ⚡ Offload to AWS Fargate
  try {
    console.log(`Triggering ECS Fargate task for test run ${testRun.id}...`);

    // Fallback to eu-central-1 if not specified
    const region = process.env.AWS_REGION || "eu-central-1";

    const ecsClient = new ECSClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
      }
    });

    const subnets = process.env.AWS_SUBNETS ? process.env.AWS_SUBNETS.split(',') : [];

    await ecsClient.send(new RunTaskCommand({
      cluster: "qa-worker-cluster",
      taskDefinition: "qa-worker-task",
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnets,
          assignPublicIp: "ENABLED"
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: "worker",
            environment: [
              { name: "TEST_RUN_ID", value: testRun.id },
              { name: "TARGET_URL", value: url },
              { name: "VIEWPORTS", value: JSON.stringify(viewports) },
              { name: "CHECKS", value: JSON.stringify(checks) },
              { name: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL || "" },
              { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" }
            ],
          },
        ],
      },
    }));

    console.log(`Successfully triggered ECS task for ${testRun.id}`);
  } catch (awsError) {
    console.error("Failed to trigger AWS ECS Task:", awsError);
    await admin.from("test_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", testRun.id);

    return NextResponse.json({ error: "Failed to start background worker", awsError }, { status: 500 });
  }

  return NextResponse.json({ testRunId: testRun.id });
}
