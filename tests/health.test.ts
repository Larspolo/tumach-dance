// The health address of the site (#261): the database answers, or the answer is 503.
import { afterEach, expect, test, vi } from "vitest";
import { getDb, openDb } from "../src/db";
import { healthStatus } from "../src/lib/health";

vi.mock("../src/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/db")>();
  return { ...original, getDb: vi.fn() };
});

afterEach(() => {
  vi.mocked(getDb).mockReset();
  vi.restoreAllMocks();
});

test("the health of an open database is ok", () => {
  const db = openDb(":memory:");
  expect(healthStatus(db)).toEqual({ ok: true });
});

test("the health of a closed database is not ok and logs one line", () => {
  const db = openDb(":memory:");
  db.$client.close();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(healthStatus(db)).toEqual({ ok: false });
  expect(log).toHaveBeenCalledTimes(1);
});

test("the address answers 200 with ok and no-store", async () => {
  const { GET } = await import("../src/app/api/health/route");
  vi.mocked(getDb).mockReturnValue(openDb(":memory:"));
  const response = GET();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('{"ok":true}');
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("the address answers 503 when there is no database", async () => {
  const { GET } = await import("../src/app/api/health/route");
  vi.mocked(getDb).mockImplementation(() => {
    throw new Error("no database file");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = GET();
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"ok":false}');
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
