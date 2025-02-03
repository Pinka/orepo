import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/config";
import { Octokit } from "@octokit/rest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const artifactId = (await params).artifactId;

    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing 'owner' or 'repo' query parameter" },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: session.accessToken,
    });

    // Download the artifact
    const artifactResponse = await octokit.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: Number(artifactId),
      archive_format: "zip",
    });

    // Return the zip file directly
    return new NextResponse(artifactResponse.data as ArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="playwright-report.zip"`,
      },
    });
  } catch (error) {
    console.error("Error processing artifact:", error);
    return NextResponse.json(
      { error: "Failed to process artifact" },
      { status: 500 }
    );
  }
}
