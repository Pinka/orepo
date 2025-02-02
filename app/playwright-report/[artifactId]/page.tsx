"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { useParams, useSearchParams } from "next/navigation";

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

function LoadingDisplay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-b-transparent mb-4"></div>
      <p className="text-gray-600">Loading Playwright report...</p>
    </div>
  );
}

function ReportHeader({ owner, repo }: { owner: string; repo: string }) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">
              Playwright Test Report
            </h1>
            <span className="text-gray-500">
              {owner}/{repo}
            </span>
          </div>
          <a
            href={`/repository/${owner}/${repo}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to Repository
          </a>
        </div>
      </div>
    </header>
  );
}

export default function PlaywrightReportViewer() {
  // 'artifactId' is obtained from the dynamic route (e.g. /playwright-report/12345)
  const { artifactId } = useParams<{ artifactId: string }>();
  // Retrieve repository owner and name from URL query parameters (e.g. ?owner=foo&repo=bar)
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const blobUrlsRef = useRef<string[]>([]);

  const handleRetry = useCallback(() => {
    setError("");
    setLoading(true);
    // This will trigger the useEffect
  }, []);

  useEffect(() => {
    const blobUrls: string[] = [];

    const fetchAndProcess = async () => {
      try {
        const artifactUrl = `/api/artifacts/${artifactId}?owner=${encodeURIComponent(
          owner
        )}&repo=${encodeURIComponent(repo)}`;

        const res = await fetch(artifactUrl);
        if (!res.ok) throw new Error("Failed to fetch artifact");

        const data = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(data);

        const indexFile = zip.file("index.html");
        if (!indexFile) throw new Error("index.html not found in artifact");

        let indexHtml = await indexFile.async("string");
        const replacements: Record<string, string> = {};

        // Process all files in parallel
        await Promise.all(
          Object.keys(zip.files).map(async (filename) => {
            if (filename === "index.html") return;
            const fileData = await zip.file(filename)?.async("blob");
            if (fileData) {
              const blobUrl = URL.createObjectURL(fileData);
              replacements[filename] = blobUrl;
              blobUrls.push(blobUrl);
            }
          })
        );

        // Replace all asset references
        for (const [filename, blobUrl] of Object.entries(replacements)) {
          const re = new RegExp(
            filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "g"
          );
          indexHtml = indexHtml.replace(re, blobUrl);
        }

        blobUrlsRef.current = blobUrls;
        setContent(indexHtml);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcess();

    return () => {
      // Cleanup blob URLs when component unmounts
      blobUrlsRef.current.forEach(URL.revokeObjectURL);
      blobUrlsRef.current = [];
    };
  }, [artifactId, owner, repo]);

  if (loading) {
    return <LoadingDisplay />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={handleRetry} />;
  }

  return (
    <div className="min-h-screen">
      <ReportHeader owner={owner} repo={repo} />
      {/* Render the decompressed report in an iframe */}
      <iframe
        title="Playwright Report"
        srcDoc={content}
        frameBorder="0"
        style={{ width: "100%", height: "100vh" }}
      />
    </div>
  );
}
