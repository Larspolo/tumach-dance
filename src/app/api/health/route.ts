// The health address `/api/health` (#261): 200 when the site, its database and the nightly backup (#262) work, else 503. No login, no locale.
// It also gives the version of the image (`SITE_VERSION`, the commit) and the last server errors (`site-errors.ts`): the
// site watch on GitHub (`tools/site_watch.py`) puts them in its ticket. A start error makes the site not ok.
import type { HealthStatus } from "../../../lib/health";
import { recordError, siteErrors } from "../../../lib/site-errors";

export const dynamic = "force-dynamic";

/**
 * The status of the database and the backup. Their modules load here, in the try (2026-10-31): a module that cannot
 * load (a native binary on the CPU of the server) gives 503 with its error text, not a 500 with no text.
 */
async function status(): Promise<HealthStatus> {
  try {
    const [{ getDb }, { healthStatus }] = await Promise.all([import("../../../db"), import("../../../lib/health")]);
    return healthStatus(getDb());
  } catch (error) {
    console.error("health: no database", error);
    recordError("GET /api/health", error);
    return { ok: false, backupAt: null };
  }
}

export async function GET() {
  const health = await status();
  const errors = siteErrors();
  const version = process.env.SITE_VERSION;
  const body = {
    ...health,
    ok: health.ok && !errors.some((e) => e.start),
    ...(version && { version }),
    ...(errors.length > 0 && { errors }),
  };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
