"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";

function LoadingDisplay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-b-transparent mb-4"></div>
      <p className="text-gray-600">Loading Playwright report...</p>
    </div>
  );
}

function ErrorDisplay({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function ReportHeader({ owner, repo }: { owner: string; repo: string }) {
  return (
    <Header
      title="Playwright Test Report"
      showBackButton
      backHref={`/repository/${owner}/${repo}`}
    />
  );
}

export default function PlaywrightReportViewer() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportUrl, setReportUrl] = useState("");

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/artifacts/${artifactId}?owner=${encodeURIComponent(
          owner
        )}&repo=${encodeURIComponent(repo)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to process artifact");
      }

      const data = await response.json();
      setReportUrl(data.url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [artifactId, owner, repo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return <LoadingDisplay />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchReport} />;
  }

  if (!reportUrl) {
    return (
      <ErrorDisplay error="No report URL available" onRetry={fetchReport} />
    );
  }

  return (
    <div className="min-h-screen">
      <ReportHeader owner={owner} repo={repo} />
      <iframe
        title="Playwright Report"
        src={reportUrl}
        className="w-full h-[calc(100vh-4rem)]"
        frameBorder="0"
      />
    </div>
  );
}
