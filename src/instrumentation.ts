import type { Instrumentation } from "next";
import type { Db } from "./db";

// Next.js calls `register()` once at the start of the server (#14): open the database and apply the migrations,
// so that a new image needs no step by hand. Start the timer of the booking emails (#165) and of the nightly backup
// (#247). With a `GITHUB_TOKEN`, start the push for new questions (#69).
// Each part has its own try (2026-10-31): an error in register() stops the start of Next.js, and then each request
// gives 500 with no answer of `/api/health`. Now the other parts and the pages work, and `/api/health` shows the error
// (`src/lib/site-errors.ts`) to the site watch on GitHub.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./lib/site-errors");
  const part = async (name: string, start: () => Promise<void>) => {
    try {
      await start();
    } catch (error) {
      console.error(`start: ${name} failed`, error);
      recordError(`start: ${name}`, error, { start: true });
    }
  };
  let db: Db | undefined;
  await part("database", async () => {
    db = (await import("./db")).getDb();
  });
  if (!db) return;
  const open = db;
  await part("booking timer", async () => {
    const { startBookingTimer } = await import("./lib/booking-timer");
    startBookingTimer(open);
  });
  await part("backup timer", async () => {
    const { startBackupTimer } = await import("./lib/backup");
    startBackupTimer(open);
  });
  if (!process.env.GITHUB_TOKEN) return;
  await part("question timer", async () => {
    const { startQuestionTimer } = await import("./lib/nina-notify");
    startQuestionTimer(open);
  });
}

/** An error of a page, a route or a server action: keep its public text for `/api/health` (no query, no data). */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  const { recordError } = await import("./lib/site-errors");
  recordError(`${request.method} ${request.path.split("?")[0]}`, error);
};
