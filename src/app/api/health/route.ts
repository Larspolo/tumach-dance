// The health address `/api/health` (#261): 200 when the site and its database work, else 503. No login, no locale.
import { getDb } from "../../../db";
import { healthStatus } from "../../../lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  let status: { ok: boolean };
  try {
    status = healthStatus(getDb());
  } catch (error) {
    console.error("health: no database", error);
    status = { ok: false };
  }
  return Response.json(status, { status: status.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
