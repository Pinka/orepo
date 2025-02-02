"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "next-auth";

interface ExtendedSession extends Session {
  accessToken?: string;
}

interface WorkflowRun {
  id: number;
  name?: string | null;
  status?: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  head_commit: {
    message: string;
    id: string;
  } | null;
  html_url: string;
}

interface Step {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  number: number;
  started_at?: string | null;
  completed_at?: string | null;
}

interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  steps?: Step[];
}

interface PaginationInfo {
  total_count: number;
  current_page: number;
  total_pages: number;
}

interface RouteParams {
  owner: string;
  name: string;
  [key: string]: string | string[] | undefined;
}

interface Artifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
}

export default function BuildHistoryPage() {
  const { data: session } = useSession() as {
    data: ExtendedSession | null;
    status: string;
  };
  const params = useParams<RouteParams>();
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
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(
    {}
  );
  const [stepLogs, setStepLogs] = useState<Record<string, string>>({});
  const [loadingSteps, setLoadingSteps] = useState<Record<string, boolean>>({});
  const [artifacts, setArtifacts] = useState<Record<number, Artifact[]>>({});
  const [loadingArtifacts, setLoadingArtifacts] = useState<
    Record<number, boolean>
  >({});

  const page = Number(searchParams.get("page")) || 1;
  const per_page = 10;

  useEffect(() => {
    if (session?.accessToken) {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      octokit.actions
        .listWorkflowRunsForRepo({
          owner: params.owner,
          repo: params.name,
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
        owner: params.owner,
        repo: params.name,
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

  const fetchArtifacts = async (runId: number) => {
    if (!session?.accessToken) return;

    setLoadingArtifacts((prev) => ({ ...prev, [runId]: true }));

    try {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      const response = await octokit.actions.listWorkflowRunArtifacts({
        owner: params.owner,
        repo: params.name,
        run_id: runId,
      });

      setArtifacts((prev) => ({
        ...prev,
        [runId]: response.data.artifacts,
      }));
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    } finally {
      setLoadingArtifacts((prev) => ({ ...prev, [runId]: false }));
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
      if (!artifacts[runId]) {
        await fetchArtifacts(runId);
      }
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "N/A";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/repository/${params.owner}/${params.name}?page=${newPage}`);
  };

  const fetchStepLogs = async (
    runId: number,
    jobId: number,
    stepNumber: number
  ) => {
    if (!session?.accessToken) return;

    const stepKey = `${runId}-${jobId}-${stepNumber}`;
    setLoadingSteps((prev) => ({ ...prev, [stepKey]: true }));

    try {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      const response = await octokit.actions.downloadJobLogsForWorkflowRun({
        owner: params.owner,
        repo: params.name,
        job_id: jobId,
      });

      // The response is a blob of text containing all logs
      const logText = await response.data;

      // For now, we'll just show the raw logs
      // In a production app, you might want to parse and format these logs
      setStepLogs((prev) => ({
        ...prev,
        [stepKey]: typeof logText === "string" ? logText : "No logs available",
      }));
    } catch (error) {
      console.error("Error fetching step logs:", error);
      setStepLogs((prev) => ({
        ...prev,
        [stepKey]: "Failed to load logs. Please try again.",
      }));
    } finally {
      setLoadingSteps((prev) => ({ ...prev, [stepKey]: false }));
    }
  };

  const toggleStep = async (
    runId: number,
    jobId: number,
    stepNumber: number
  ) => {
    const stepKey = `${runId}-${jobId}-${stepNumber}`;
    setExpandedSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey],
    }));

    if (!stepLogs[stepKey]) {
      await fetchStepLogs(runId, jobId, stepNumber);
    }
  };

  const downloadArtifact = async (artifactUrl: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await fetch(artifactUrl, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "artifact.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading artifact:", error);
    }
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
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center text-gray-700 hover:text-gray-900 font-medium"
                aria-label="Back to dashboard"
              >
                <svg
                  className="w-5 h-5 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {params.owner}/{params.name}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Build History</h2>
            {pagination.total_pages > 0 && (
              <p className="text-sm font-medium text-gray-700">
                Showing page {pagination.current_page} of{" "}
                {pagination.total_pages}
              </p>
            )}
          </div>

          <div className="space-y-6">
            {workflowRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                <button
                  onClick={() => handleRunClick(run.id)}
                  className="w-full text-left p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {run.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                        {run.head_commit?.message}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 ml-4">
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full ${
                          run.conclusion === "success"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : run.conclusion === "failure"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {run.conclusion || run.status}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transform transition-transform ${
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
                  <div className="mt-4 text-sm text-gray-600">
                    Started: {new Date(run.created_at).toLocaleString()}
                  </div>
                </button>

                {expandedRun === run.id && (
                  <div className="border-t border-gray-200 bg-gray-50 p-6">
                    {loadingJobs[run.id] ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-b-transparent"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {jobDetails[run.id]?.map((job) => (
                          <div
                            key={job.id}
                            className="bg-white border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-base font-semibold text-gray-900">
                                {job.name}
                              </h4>
                              <div className="flex items-center space-x-3">
                                <span
                                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                    job.conclusion === "success"
                                      ? "bg-green-100 text-green-700 border border-green-200"
                                      : job.conclusion === "failure"
                                      ? "bg-red-100 text-red-700 border border-red-200"
                                      : "bg-gray-100 text-gray-700 border border-gray-200"
                                  }`}
                                >
                                  {job.conclusion}
                                </span>
                                <span className="text-xs font-medium text-gray-600">
                                  {formatDuration(
                                    job.started_at,
                                    job.completed_at
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {job.steps?.map((step) => (
                                <div
                                  key={step.number}
                                  className="border border-gray-200 rounded-md overflow-hidden"
                                >
                                  <button
                                    onClick={() =>
                                      toggleStep(run.id, job.id, step.number)
                                    }
                                    className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <svg
                                        className={`w-4 h-4 text-gray-500 transform transition-transform ${
                                          expandedSteps[
                                            `${run.id}-${job.id}-${step.number}`
                                          ]
                                            ? "rotate-90"
                                            : ""
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9 5l7 7-7 7"
                                        />
                                      </svg>
                                      <span className="text-sm font-medium text-gray-700">
                                        {step.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      {step.started_at && step.completed_at && (
                                        <span className="text-xs text-gray-500">
                                          {formatDuration(
                                            step.started_at,
                                            step.completed_at
                                          )}
                                        </span>
                                      )}
                                      <span
                                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          step.conclusion === "success"
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : step.conclusion === "failure"
                                            ? "bg-red-100 text-red-700 border border-red-200"
                                            : "bg-gray-100 text-gray-700 border border-gray-200"
                                        }`}
                                      >
                                        {step.conclusion}
                                      </span>
                                    </div>
                                  </button>

                                  {expandedSteps[
                                    `${run.id}-${job.id}-${step.number}`
                                  ] && (
                                    <div className="border-t border-gray-200 p-4">
                                      {loadingSteps[
                                        `${run.id}-${job.id}-${step.number}`
                                      ] ? (
                                        <div className="flex justify-center py-4">
                                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-b-transparent"></div>
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          <div className="flex justify-between text-sm text-gray-600">
                                            <div>
                                              Started:{" "}
                                              {new Date(
                                                step.started_at || ""
                                              ).toLocaleString()}
                                            </div>
                                            <div>
                                              Completed:{" "}
                                              {new Date(
                                                step.completed_at || ""
                                              ).toLocaleString()}
                                            </div>
                                          </div>
                                          <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                                            <pre className="whitespace-pre-wrap">
                                              {stepLogs[
                                                `${run.id}-${job.id}-${step.number}`
                                              ] || "No logs available"}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="mt-6 border-t border-gray-200 pt-6">
                          <h3 className="text-lg font-medium text-gray-900">
                            Artifacts
                          </h3>
                          {loadingArtifacts[run.id] ? (
                            <div className="flex justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-b-transparent"></div>
                            </div>
                          ) : artifacts[run.id]?.length > 0 ? (
                            <div className="mt-4 space-y-4">
                              {artifacts[run.id].map((artifact) => (
                                <div
                                  key={artifact.id}
                                  className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200"
                                >
                                  <div>
                                    <h4 className="font-medium text-gray-900">
                                      {artifact.name}
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                      Size:{" "}
                                      {Math.round(
                                        artifact.size_in_bytes / 1024
                                      )}{" "}
                                      KB
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {artifact.name
                                      .toLowerCase()
                                      .includes("playwright") && (
                                      <a
                                        href={`/playwright-report/${
                                          artifact.id
                                        }?owner=${encodeURIComponent(
                                          params.owner
                                        )}&repo=${encodeURIComponent(
                                          params.name
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                                      >
                                        View Report
                                        <svg
                                          className="ml-1 w-4 h-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                          />
                                        </svg>
                                      </a>
                                    )}
                                    <button
                                      onClick={() =>
                                        downloadArtifact(
                                          artifact.archive_download_url
                                        )
                                      }
                                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                      <svg
                                        className="w-4 h-4 mr-2"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                      </svg>
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-4 text-gray-600">
                              No artifacts available for this run
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                          >
                            View on GitHub
                            <svg
                              className="ml-1 w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {workflowRuns.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-700 font-medium">
                  No workflow runs found
                </p>
              </div>
            )}
          </div>

          {pagination.total_pages > 1 && (
            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={() => handlePageChange(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.total_pages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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
