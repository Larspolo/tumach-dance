// The health of the site says whether a device of Nina gets a push (#571): the site watch then tells Lars.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { openDb } from "../src/db";
import { pushSubscriptions } from "../src/db/schema";
import { healthStatus } from "../src/lib/health";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-health-push-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const now = new Date();
const status = (db: ReturnType<typeof openDb>) =>
  healthStatus(db, { dir, now, startedAt: now, env: { NODE_ENV: "test" } });

test("no device gives push false, and the site stays ok", () => {
  expect(status(openDb(":memory:"))).toMatchObject({ ok: true, push: false });
});

test("one device gives push true, with the same ok", () => {
  const db = openDb(":memory:");
  db.insert(pushSubscriptions)
    .values({ endpoint: "https://push.example/1", p256dh: "k", auth: "a", createdAt: 0 })
    .run();
  expect(status(db)).toMatchObject({ ok: true, push: true });
});
