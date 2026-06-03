import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { Viewport } from "@/types";

const DEFAULT_VIEWPORTS: Viewport[] = ["desktop", "tablet", "mobile"];
const DEFAULT_CHECKS = {
  performance: true,
  broken_links: true,
  compatibility: true,
  security: true,
  others: true,
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let query = admin.from("test_runs").select("id, page_url, status").eq("id", id);

  if (user) {
    query = query.or(`user_id.eq.${user.id},user_id.is.null`);
  } else {
    query = query.is("user_id", null);
  }

  const { data: run, error: runError } = await query.single();

  if (runError || !run) {
    return NextResponse.json({ error: "Test run not found." }, { status: 404 });
  }

  if (run.status === "running" || run.status === "completed" || run.status === "failed") {
    return NextResponse.json({ testRunId: id, status: run.status });
  }

  const { error: updateError } = await admin
    .from("test_runs")
    .update({ status: "running" })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to mark test run running:", updateError);
    return NextResponse.json({ error: "Unable to start the test." }, { status: 500 });
  }

  try {
    const useLocalWorker = process.env.USE_LOCAL_WORKER === "true";

    if (useLocalWorker) {
      const workerDir = path.join(process.cwd(), "worker");
      const logsDir = path.join(workerDir, "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const logFile = path.join(logsDir, `${id}.log`);
      fs.writeFileSync(logFile, `--- API INIT: ${new Date().toISOString()} ---\n`);

      console.log(`Triggering Local Worker for test run ${id}...`);

      const logFd = fs.openSync(logFile, "a");
      const tsNodeBin = path.join(workerDir, "node_modules", ".bin", `ts-node${process.platform === "win32" ? ".cmd" : ""}`);

      const child = spawn(tsNodeBin, ["src/index.ts"], {
        cwd: workerDir,
        shell: process.platform === "win32",
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: {
          ...process.env,
          TEST_RUN_ID: id,
          TARGET_URL: run.page_url,
          VIEWPORTS: JSON.stringify(DEFAULT_VIEWPORTS),
          CHECKS: JSON.stringify(DEFAULT_CHECKS),
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_REGION: process.env.AWS_REGION,
          FORCE_COLOR: "1"
        }
      });

      child.unref();

      setTimeout(() => {
        try {
          fs.closeSync(logFd);
          console.log(`Log handle released for ${id}`);
        } catch {
          // ignore
        }
      }, 10000);

      console.log(`Successfully triggered local worker process for ${id}`);
      console.log(`To view live logs run: Get-Content -Wait '${logFile}'`);
    } else {
      console.log(`Triggering ECS Fargate task for test run ${id}...`);

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
                { name: "TEST_RUN_ID", value: id },
                { name: "TARGET_URL", value: run.page_url },
                { name: "VIEWPORTS", value: JSON.stringify(DEFAULT_VIEWPORTS) },
                { name: "CHECKS", value: JSON.stringify(DEFAULT_CHECKS) },
                { name: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL || "" },
                { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" }
              ],
            },
          ],
        },
      }));

      console.log(`Successfully triggered ECS task for ${id}`);
    }

    return NextResponse.json({ testRunId: id, status: "running" });
  } catch (startError) {
    console.error("Worker start failed:", startError);
    await admin
      .from("test_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ error: "Failed to launch worker." }, { status: 500 });
  }
}
