import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/config";
import { Octokit } from "@octokit/rest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const octokit = new Octokit({ auth: session.accessToken });

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Keep connection alive with comment
      const keepAlive = setInterval(() => {
        send(":keepalive");
      }, 30000);

      // Poll for updates every 10 seconds
      const pollInterval = setInterval(async () => {
        try {
          const { searchParams } = new URL(request.url);
          const owner = searchParams.get("owner");
          const repo = searchParams.get("repo");
          const lastRunId = searchParams.get("lastRunId");

          if (!owner || !repo) return;

          const { data } = await octokit.actions.listWorkflowRunsForRepo({
            owner,
            repo,
            per_page: 1,
          });

          if (data.workflow_runs.length > 0) {
            const latestRun = data.workflow_runs[0];
            if (lastRunId && latestRun.id.toString() !== lastRunId) {
              send(
                JSON.stringify({
                  type: "workflow_run",
                  owner,
                  repo,
                  run: latestRun,
                })
              );
            }
          }
        } catch (error) {
          console.error("Error polling for updates:", error);
        }
      }, 10000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        clearInterval(pollInterval);
        controller.close();
      });

      try {
        // Initial connection established
        send(JSON.stringify({ type: "connected" }));
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
