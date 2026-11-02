// The last server errors for /api/health and the site watch (2026-10-31): public text with no personal data.
import { afterEach, expect, test } from "vitest";
import { clearErrors, MAX_ERRORS, MAX_MESSAGE, publicMessage, recordError, siteErrors } from "../src/lib/site-errors";

afterEach(clearErrors);

const SHARP = [
  'Failed to load external module sharp-20c6a5da84e2135f: Error: Could not load the "sharp" module using the linux-x64 runtime',
  "Unsupported CPU: Prebuilt binaries for Linux x64 require v2 microarchitecture",
  "WebAssembly.Module(): Wasm SIMD unsupported @+2196",
  "Possible solutions:",
  "- Ensure optional dependencies can be installed:",
  "    at Context.externalImport [as y] (.next/server/chunks/[turbopack]_runtime.js:810:15)",
].join("\n");

test("the text of a module load keeps the cause and drops the help and the stack", () => {
  expect(publicMessage(new Error(SHARP))).toBe(
    'Error: Failed to load external module sharp-20c6a5da84e2135f: Error: Could not load the "sharp" module using the linux-x64 runtime' +
      " | Unsupported CPU: Prebuilt binaries for Linux x64 require v2 microarchitecture" +
      " | WebAssembly.Module(): Wasm SIMD unsupported @+2196",
  );
});

test("the text has no email, no phone number and no values of a query", () => {
  const error = new Error(
    "Failed query: insert into bookings (name, email) values (?, ?) params: Ana,ana@example.com\nmore",
  );
  expect(publicMessage(error)).toBe(
    "Error: Failed query: insert into bookings (name, email) values (?, ?) params: <removed>",
  );
  expect(publicMessage("no answer from dancer@example.com at +31 6 1234 5678 in 2026")).toBe(
    "no answer from <email> at <number> in 2026",
  );
});

test("a long text is cut", () => {
  expect(publicMessage("x".repeat(1000))).toHaveLength(MAX_MESSAGE);
});

test("the start errors stay first and the newest request errors fill the rest", () => {
  const now = new Date("2026-10-31T07:00:00Z");
  recordError("start: backup timer", new Error("sharp"), { start: true, now });
  for (let k = 0; k < 8; k++) recordError(`GET /page-${k}`, new Error(`error ${k}`), { now });
  const errors = siteErrors();
  expect(errors).toHaveLength(MAX_ERRORS);
  expect(errors[0]).toEqual({
    where: "start: backup timer",
    message: "Error: sharp",
    at: now.toISOString(),
    start: true,
  });
  expect(errors.slice(1).map((e) => e.where)).toEqual(["GET /page-7", "GET /page-6", "GET /page-5", "GET /page-4"]);
});

test("the reason in the cause of an error is in the text", () => {
  const error = new Error("Failed to prepare server", {
    cause: new Error("Wasm SIMD unsupported\nPossible solutions:"),
  });
  expect(publicMessage(error)).toBe("Error: Failed to prepare server | cause: Error: Wasm SIMD unsupported");
});

test("the same error at the same place again replaces the older one", () => {
  recordError("start: backup timer", new Error("sharp"), { start: true });
  recordError("GET /en", new Error("other"));
  for (let k = 0; k < 6; k++) recordError("GET /api/health", new Error("no module"));
  expect(siteErrors().map((e) => e.where)).toEqual(["start: backup timer", "GET /api/health", "GET /en"]);
});
