// Next.js calls `register()` once at the start of the server (#14): open the database and apply the migrations,
// so that a new image needs no step by hand.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./db");
  getDb();
}
