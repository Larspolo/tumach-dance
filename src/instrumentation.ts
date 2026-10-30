// Next.js calls `register()` once at the start of the server (#14): open the database and apply the migrations,
// so that a new image needs no step by hand. With a `GITHUB_TOKEN`, start the push for new questions (#69).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./db");
  const db = getDb();
  if (!process.env.GITHUB_TOKEN) return;
  const { startQuestionTimer } = await import("./lib/nina-notify");
  startQuestionTimer(db);
}
