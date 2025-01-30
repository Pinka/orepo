"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { useParams } from "next/navigation";

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  head_commit: {
    message: string;
    id: string;
  };
  html_url: string;
}

export default function BuildHistoryPage() {
  const { data: session } = useSession();
  const params = useParams();
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.accessToken) {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      octokit.actions
        .listWorkflowRunsForRepo({
          owner: params.owner as string,
          repo: params.name as string,
          per_page: 10,
        })
        .then((response) => {
          setWorkflowRuns(response.data.workflow_runs);
          setLoading(false);
        })
        .catch((error: Error) => {
          console.error("Error fetching workflow runs:", error);
          setLoading(false);
        });
    }
  }, [session, params]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {params.owner}/{params.name}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Build History
          </h2>
          <div className="space-y-4">
            {workflowRuns.map((run) => (
              <a
                key={run.id}
                href={run.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {run.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {run.head_commit.message}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      run.conclusion === "success"
                        ? "bg-green-100 text-green-800"
                        : run.conclusion === "failure"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {run.conclusion || run.status}
                  </span>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  Started: {new Date(run.created_at).toLocaleString()}
                </div>
              </a>
            ))}
            {workflowRuns.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500">No workflow runs found</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
