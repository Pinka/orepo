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
  jobs_url: string;
}

interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string;
  steps: Array<{
    name: string;
    status: string;
    conclusion: string;
    number: number;
    log?: string;
  }>;
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
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [jobDetails, setJobDetails] = useState<Record<number, Job[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState<Record<number, boolean>>({});
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

  const fetchJobDetails = async (runId: number) => {
    if (!session?.accessToken) return;

    setLoadingJobs((prev) => ({ ...prev, [runId]: true }));

    try {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      const response = await octokit.actions.listJobsForWorkflowRun({
        owner: params.owner as string,
        repo: params.name as string,
        run_id: runId,
      });

      setJobDetails((prev) => ({
        ...prev,
        [runId]: response.data.jobs,
      }));
    } catch (error) {
      console.error("Error fetching job details:", error);
    } finally {
      setLoadingJobs((prev) => ({ ...prev, [runId]: false }));
    }
  };

  const handleRunClick = async (runId: number) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
    } else {
      setExpandedRun(runId);
      if (!jobDetails[runId]) {
        await fetchJobDetails(runId);
      }
    }
  };

  const formatDuration = (start: string, end: string) => {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

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
            {pagination.total_pages > 0 && (
              <p className="text-sm text-gray-600">
                Showing page {pagination.current_page} of{" "}
                {pagination.total_pages}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {workflowRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => handleRunClick(run.id)}
                  className="w-full text-left p-6 hover:bg-gray-50 transition-colors duration-200"
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
                    <div className="flex items-center space-x-4">
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
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedRun === run.id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Started: {new Date(run.created_at).toLocaleString()}
                  </div>
                </button>

                {expandedRun === run.id && (
                  <div className="border-t border-gray-200 p-6">
                    {loadingJobs[run.id] ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {jobDetails[run.id]?.map((job) => (
                          <div
                            key={job.id}
                            className="border rounded-lg p-4 bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{job.name}</h4>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    job.conclusion === "success"
                                      ? "bg-green-100 text-green-800"
                                      : job.conclusion === "failure"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {job.conclusion}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDuration(
                                    job.started_at,
                                    job.completed_at
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {job.steps.map((step) => (
                                <div
                                  key={step.number}
                                  className="text-sm flex items-center justify-between"
                                >
                                  <span>{step.name}</span>
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded-full ${
                                      step.conclusion === "success"
                                        ? "bg-green-100 text-green-800"
                                        : step.conclusion === "failure"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {step.conclusion}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-end">
                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            View on GitHub →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
