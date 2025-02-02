import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/config";
import { Octokit } from "@octokit/rest";
import { mkdir, access, constants } from "fs/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import { MAX_ARTIFACT_SIZE } from "@/lib/constants";

interface RouteParams {
  params: {
    artifactId: string;
  };
}

async function reportExists(path: string): Promise<boolean> {
  try {
    await access(join(path, "index.html"), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request, { params }: RouteParams) {
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
    // Get artifact details
    const { data: artifact } = await octokit.rest.actions.getArtifact({
      owner,
      repo,
      artifact_id: Number(params.artifactId),
    });

    // Check artifact size
    if (artifact.size_in_bytes > MAX_ARTIFACT_SIZE) {
      return NextResponse.json(
        { error: "Artifact is too large to process (>100MB)" },
        { status: 413 }
      );
    }

    // Check if report already exists
    const reportsDir = join(process.cwd(), "public", "playwright-reports");
    const extractPath = join(reportsDir, params.artifactId);

    if (await reportExists(extractPath)) {
      return NextResponse.json({
        url: `/playwright-reports/${params.artifactId}/index.html`,
      });
    }

    // Download the artifact
    const response = await fetch(artifact.archive_download_url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to download artifact");
    }

    // Create the reports directory if it doesn't exist
    await mkdir(extractPath, { recursive: true });

    // Get the zip content as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract using adm-zip
    const zip = new AdmZip(buffer);
    zip.extractAllTo(extractPath, true);

    // Return the URL to the extracted report
    return NextResponse.json({
      url: `/playwright-reports/${params.artifactId}/index.html`,
    });
  } catch (error) {
    console.error("Error processing artifact:", error);
    return NextResponse.json(
      { error: "Failed to process artifact" },
      { status: 500 }
    );
  }
}
