import { readdir, stat, rm } from "fs/promises";
import { join } from "path";

const REPORTS_DIR = join(process.cwd(), "public", "playwright-reports");
const MAX_AGE_HOURS = 24;

async function cleanupReports() {
  try {
    const files = await readdir(REPORTS_DIR);
    const now = Date.now();
    const maxAge = MAX_AGE_HOURS * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = join(REPORTS_DIR, file);
      const stats = await stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await rm(filePath, { recursive: true, force: true });
        console.log(`Deleted old report: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up reports:", error);
  }
}

// Run the cleanup
cleanupReports();
