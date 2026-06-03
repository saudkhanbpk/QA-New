import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import type { Viewport } from "@/types";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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

  // ⚡ Rate limiting: use user ID if logged in, otherwise use IP
  const rateLimitKey = user ? `user:${user.id}` : `ip:${request.headers.get("x-forwarded-for") || "anonymous"}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, { maxRequests: 10000, windowMs: 60 * 60 * 1000 });

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
      user_id: user?.id || null,
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

  const useLocalWorker = process.env.USE_LOCAL_WORKER === "true";

  if (useLocalWorker) {
    // ⚡ Trigger Local Worker (Useful for development and local testing)
    try {
      const workerDir = path.join(process.cwd(), "worker");
      const logsDir = path.join(workerDir, "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const logFile = path.join(logsDir, `${testRun.id}.log`);
      fs.writeFileSync(logFile, `--- API INIT: ${new Date().toISOString()} ---\n`);

      console.log(`Triggering Local Worker for test run ${testRun.id}...`);

      const logFd = fs.openSync(logFile, "a");

      // Find the direct path to ts-node
      const tsNodeBin = path.join(workerDir, "node_modules", ".bin", "ts-node" + (process.platform === "win32" ? ".cmd" : ""));

      const child = spawn(tsNodeBin, ["src/index.ts"], {
        cwd: workerDir,
        shell: process.platform === "win32", // Required for .cmd files on Windows
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: {
          ...process.env,
          TEST_RUN_ID: testRun.id,
          TARGET_URL: url,
          VIEWPORTS: JSON.stringify(viewports),
          CHECKS: JSON.stringify(checks),
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_REGION: process.env.AWS_REGION,
          FORCE_COLOR: "1"
        }
      });

      child.unref();

      // Increased delay before closing FD in parent to ensure child process has fully hooked it
      setTimeout(() => {
        try {
          fs.closeSync(logFd);
          console.log(`Log handle released for ${testRun.id}`);
        } catch (e) {
          // ignore
        }
      }, 10000);

      console.log(`Successfully triggered local worker process for ${testRun.id}`);
      console.log(`To view live logs run: Get-Content -Wait '${logFile}'`);
    } catch (localError) {
      console.error("Failed to trigger local worker:", localError);
      await admin.from("test_runs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", testRun.id);
      return NextResponse.json({ error: "Failed to start local worker process", localError }, { status: 500 });
    }
  } else {
    // ⚡ Offload to AWS Fargate (Massive Scaling)
    try {
      console.log(`Triggering ECS Fargate task for test run ${testRun.id}...`);

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
      console.error("ECS error:", awsError);

      // ⚡ SAFETY CHECK
      const { data: currentTest } = await admin
        .from("test_runs")
        .select("status")
        .eq("id", testRun.id)
        .single();

      if (currentTest?.status === 'running' || currentTest?.status === 'completed') {
        return NextResponse.json({ testRunId: testRun.id, status: currentTest.status });
      }

      await admin.from("test_runs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", testRun.id);

      return NextResponse.json({ error: "Failed to start Fargate worker", awsError }, { status: 500 });
    }
  }

  return NextResponse.json({ testRunId: testRun.id });
}
