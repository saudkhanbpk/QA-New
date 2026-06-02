import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Server-Sent Events (SSE) endpoint for real-time test progress
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const searchParams = request.nextUrl.searchParams;
  const testRunId = searchParams.get("testRunId");

  if (!testRunId) {
    return new Response("testRunId is required", { status: 400 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const admin = createAdminClient();

      // Poll for updates every 2 seconds
      const interval = setInterval(async () => {
        try {
          let query = admin.from("test_runs").select("*").eq("id", testRunId);

          if (user) {
            query = query.eq("user_id", user.id);
          } else {
            query = query.is("user_id", null);
          }

          const { data: run } = await query.single();

          if (!run) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Test not found" })}\n\n`));
            clearInterval(interval);
            controller.close();
            return;
          }

          // Send progress update
          const update = {
            status: run.status,
            overall_score: run.overall_score,
            completed_at: run.completed_at,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));

          // Close stream when test is complete or failed
          if (run.status === "completed" || run.status === "failed") {
            clearInterval(interval);
            controller.close();
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
