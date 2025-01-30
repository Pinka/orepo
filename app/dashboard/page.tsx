"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ExtendedSession {
  accessToken?: string;
}

interface Repository {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  private: boolean;
}

export default function DashboardPage() {
  const { data: session, status } = useSession() as {
    data: ExtendedSession | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }

    if (session?.accessToken) {
      const octokit = new Octokit({
        auth: session.accessToken,
      });

      octokit.repos
        .listForAuthenticatedUser()
        .then((response) => {
          setRepositories(response.data);
          setLoading(false);
        })
        .catch((error: Error) => {
          console.error("Error fetching repositories:", error);
          setLoading(false);
        });
    }
  }, [session, status, router]);

  const getRepoOwner = (html_url: string) => {
    const parts = html_url.split("/");
    return parts[parts.length - 2];
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
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Orepo</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                aria-label="Sign out"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Repositories
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <a
                key={repo.id}
                href={`/repository/${getRepoOwner(repo.html_url)}/${repo.name}`}
                className="block p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                aria-label={`View ${repo.name} build history`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {repo.name}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      repo.private
                        ? "bg-gray-100 text-gray-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {repo.private ? "Private" : "Public"}
                  </span>
                </div>
                {repo.description && (
                  <p className="mt-2 text-sm text-gray-600">
                    {repo.description}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
