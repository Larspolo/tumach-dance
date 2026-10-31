// The health address `/api/health` (#261): 200 when the site, its database and the nightly backup (#262) work, else 503. No login, no locale.
import { getDb } from "../../../db";
import { type HealthStatus, healthStatus } from "../../../lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  let status: HealthStatus;
  try {
    status = healthStatus(getDb());
  } catch (error) {
    console.error("health: no database", error);
    status = { ok: false, backupAt: null };
  }
  return Response.json(status, { status: status.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
