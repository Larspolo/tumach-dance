// The health of the site for a check outside the home server (#261): the database answers a trivial query.
import type { Db } from "../db";

export function healthStatus(db: Db): { ok: boolean } {
  try {
    db.$client.prepare("select 1").get();
    return { ok: true };
  } catch (error) {
    console.error("health: the database does not answer", error);
    return { ok: false };
  }
}
