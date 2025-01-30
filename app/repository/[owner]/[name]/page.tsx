"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

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

interface PaginationInfo {
  total_count: number;
  current_page: number;
  total_pages: number;
}

export default function BuildHistoryPage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total_count: 0,
    current_page: 1,
    total_pages: 1,
  });

  const page = Number(searchParams.get("page")) || 1;
  const per_page = 10;

  useEffect(() => {
    if (session?.accessToken) {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      octokit.actions
        .listWorkflowRunsForRepo({
          owner: params.owner as string,
          repo: params.name as string,
          per_page,
          page,
        })
        .then((response) => {
          setWorkflowRuns(response.data.workflow_runs);
          setPagination({
            total_count: response.data.total_count,
            current_page: page,
            total_pages: Math.ceil(response.data.total_count / per_page),
          });
          setLoading(false);
        })
        .catch((error: Error) => {
          console.error("Error fetching workflow runs:", error);
          setLoading(false);
        });
    }
  }, [session, params, page]);

  const handlePageChange = (newPage: number) => {
    router.push(`/repository/${params.owner}/${params.name}?page=${newPage}`);
  };

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
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700"
                aria-label="Back to dashboard"
              >
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {params.owner}/{params.name}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Build History
            </h2>
            <p className="text-sm text-gray-600">
              Showing page {pagination.current_page} of {pagination.total_pages}
            </p>
          </div>

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

          {pagination.total_pages > 1 && (
            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={() => handlePageChange(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.total_pages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
