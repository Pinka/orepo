"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";
import JSZip from "jszip";

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

// A helper to guess the content type by file extension
const getContentType = (filename: string) => {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".js")) return "application/javascript";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
    return "image/jpeg";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".woff2")) return "font/woff2";
  if (filename.endsWith(".woff")) return "font/woff";
  if (filename.endsWith(".ttf")) return "font/ttf";
  return "application/octet-stream";
};

export default function PlaywrightReportViewer() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // setupReport fetches the zip, extracts it, and caches its content
  const setupReport = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch the artifact zip from your API endpoint
      const response = await fetch(
        `/api/artifacts/${artifactId}?owner=${encodeURIComponent(
          owner
        )}&repo=${encodeURIComponent(repo)}`,
        { method: "GET", credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Failed to load artifact zip");
      }

      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Use Cache API to store files under a dedicated cache
      const cacheName = `report-${artifactId}`;
      const cache = await caches.open(cacheName);

      // Iterate through each file in the zip
      const filePromises: Promise<any>[] = [];
      zip.forEach((relativePath, file) => {
        if (!file.dir) {
          // Remove the "playwright-report/" prefix from paths
          const cleanPath = relativePath.replace(/^playwright-report\//, "");
          filePromises.push(
            file.async("blob").then((blob) => {
              const url = `/report/${artifactId}/${cleanPath}`;
              const responseInit = {
                headers: { "Content-Type": getContentType(cleanPath) },
              };
              const res = new Response(blob, responseInit);
              return cache.put(url, res);
            })
          );
        }
      });
      await Promise.all(filePromises);

      // Register a service worker to serve report assets from the cache.
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/report-sw.js");
          // Wait for the service worker to be ready
          await navigator.serviceWorker.ready;
        } catch (err) {
          console.error("Service Worker registration failed:", err);
        }
      }

      setReady(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setupReport();
    return () => {
      // Clean up the cache when component unmounts
      if (artifactId) {
        caches.delete(`report-${artifactId}`).catch(console.error);
      }
    };
  }, [artifactId, owner, repo]);

  if (loading) return <LoadingDisplay />;
  if (error) return <ErrorDisplay error={error} onRetry={setupReport} />;
  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <Header
        title="Playwright Test Report"
        showBackButton
        backHref={`/repository/${owner}/${repo}`}
      />
      <iframe
        title="Playwright Report"
        src={`/report/${artifactId}/index.html`}
        className="w-full h-[calc(100vh-4rem)]"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
