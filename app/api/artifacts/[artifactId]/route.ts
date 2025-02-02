import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/config";
import { Octokit } from "@octokit/rest";

export async function GET(
  request: Request,
  { params }: { params: { artifactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract 'owner' and 'repo' from the request URL's query parameters
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Missing 'owner' or 'repo' query parameter" },
      { status: 400 }
    );
  }

  const octokit = new Octokit({ auth: session.accessToken });

  try {
    // First get the artifact details to get the download URL
    const { data: artifact } = await octokit.rest.actions.getArtifact({
      owner,
      repo,
      artifact_id: Number(params.artifactId),
    });

    // Now download using the official archive_download_url
    const response = await fetch(artifact.archive_download_url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch artifact from GitHub" },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=${artifact.name}.zip`,
      },
    });
  } catch (error) {
    console.error("Error fetching artifact:", error);
    return NextResponse.json(
      { error: "Failed to fetch artifact details" },
      { status: 500 }
    );
  }
}
