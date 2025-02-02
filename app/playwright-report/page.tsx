"use client";

export default function PlaywrightReportPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow p-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Playwright Test Report
        </h1>
      </header>
      <main className="flex-1 p-4">
        <iframe
          src="/playwright-report/index.html"
          title="Playwright Test Report"
          className="w-full h-full border border-gray-200 rounded-lg"
        />
      </main>
    </div>
  );
}
