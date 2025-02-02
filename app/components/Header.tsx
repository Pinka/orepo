import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMemo } from "react";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
  showSignOut?: boolean;
}

export default function Header({
  title,
  showBackButton = false,
  backHref = "/dashboard",
  showSignOut = false,
}: HeaderProps) {
  const catUrl = useMemo(() => `https://cataas.com/cat?${Date.now()}`, []);

  return (
    <>
      <div className="w-full relative h-48">
        <Image
          src={catUrl}
          alt="Random Cat"
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {showBackButton && (
                <Link
                  href={backHref}
                  className="inline-flex items-center text-gray-700 hover:text-gray-900 font-medium"
                  aria-label="Go back"
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
              )}
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
            {showSignOut && (
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
