"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Octokit } from "@octokit/rest";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string | null;
  html_url: string;
  description: string | null;
}

interface ExtendedSession {
  accessToken?: string;
}

const SectionHeader = ({
  title,
  count,
  isExpanded,
  onToggle,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const sectionId = `${title.toLowerCase().replace(/\s+/g, "-")}-repos`;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-xl font-semibold text-gray-900 mb-4 group bg-white border border-gray-200 p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200"
      aria-expanded={isExpanded}
      aria-controls={sectionId}
    >
      <div className="flex items-center">
        <svg
          className={`w-5 h-5 transform transition-transform duration-200 mr-2 text-gray-500 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span>
          {title} <span className="text-gray-500">({count})</span>
        </span>
      </div>
    </button>
  );
};

export default function DashboardPage() {
  const { data: session } = useSession() as { data: ExtendedSession | null };
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    public: true,
    private: false,
  });

  useEffect(() => {
    async function fetchRepositories() {
      if (!session?.accessToken) return;

      try {
        const octokit = new Octokit({
          auth: session.accessToken,
        });

        const response = await octokit.repos.listForAuthenticatedUser({
          sort: "updated",
          per_page: 100,
          visibility: "all",
        });

        setRepositories(response.data);
      } catch (error) {
        console.error("Error fetching repositories:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRepositories();
  }, [session]);

  const privateRepos = [...repositories]
    .filter((repo) => repo.private)
    .sort((a, b) => a.name.localeCompare(b.name));

  const publicRepos = [...repositories]
    .filter((repo) => !repo.private)
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleSection = (section: "public" | "private") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const RepositoryCard = ({ repo }: { repo: Repository }) => (
    <a
      onClick={() => router.push(`/repository/${repo.full_name}`)}
      className="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{repo.name}</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            repo.private
              ? "bg-gray-100 text-gray-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {repo.private ? "Private" : "Public"}
        </span>
      </div>
      {repo.description && (
        <p className="mt-2 text-sm text-gray-600">{repo.description}</p>
      )}
    </a>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Your Repositories" showSignOut />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {publicRepos.length > 0 && (
                <section>
                  <SectionHeader
                    title="Public Repositories"
                    count={publicRepos.length}
                    isExpanded={expandedSections.public}
                    onToggle={() => toggleSection("public")}
                  />
                  <div
                    id="public-repos"
                    role="region"
                    aria-labelledby="public-repos-header"
                    className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-200 ${
                      expandedSections.public
                        ? "opacity-100"
                        : "opacity-0 hidden"
                    }`}
                  >
                    {publicRepos.map((repo) => (
                      <RepositoryCard key={repo.id} repo={repo} />
                    ))}
                  </div>
                </section>
              )}

              {privateRepos.length > 0 && (
                <section>
                  <SectionHeader
                    title="Private Repositories"
                    count={privateRepos.length}
                    isExpanded={expandedSections.private}
                    onToggle={() => toggleSection("private")}
                  />
                  <div
                    id="private-repos"
                    role="region"
                    aria-labelledby="private-repos-header"
                    className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-200 ${
                      expandedSections.private
                        ? "opacity-100"
                        : "opacity-0 hidden"
                    }`}
                  >
                    {privateRepos.map((repo) => (
                      <RepositoryCard key={repo.id} repo={repo} />
                    ))}
                  </div>
                </section>
              )}

              {repositories.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <p className="text-gray-700 font-medium">
                    No repositories found
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
