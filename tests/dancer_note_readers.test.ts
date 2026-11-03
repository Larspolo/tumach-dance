// Only the studio app reads Nina's private note about a dancer (#710, epic #691 `nina:remember`): each file of `src/`
// that imports a reader of the note is under `src/app/studio/`, or is the module of the note itself. A later public
// page cannot show the note by mistake, because its import would fail this test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const READERS = ["getDancerNote", "dancerNotesFor", "firstNoteLine"];
const ALLOWED_PREFIX = `src${sep}app${sep}studio${sep}`;
const ALLOWED_FILE = `src${sep}db${sep}dancer-notes.ts`;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// An import statement of `src/db/dancer-notes` (any alias or relative path) that names one of the readers.
function readersImported(source: string): string[] {
  const found: string[] = [];
  const statements = source.matchAll(/import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']*dancer-notes)["']/g);
  for (const match of statements) {
    for (const name of match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0])) {
      if (READERS.includes(name)) found.push(name);
    }
  }
  return found;
}

describe("the private note of a dancer", () => {
  const files = sourceFiles(SRC).map((path) => ({ rel: relative(ROOT, path), source: readFileSync(path, "utf8") }));

  test("the scan finds the studio pages that read the note", () => {
    const readers = files.filter((file) => readersImported(file.source).length > 0).map((file) => file.rel);
    expect(readers.length).toBeGreaterThan(0);
    expect(readers.every((rel) => rel.startsWith(ALLOWED_PREFIX))).toBe(true);
  });

  test("only the studio app and the note module import a reader of the note", () => {
    const outside = files
      .filter((file) => readersImported(file.source).length > 0)
      .filter((file) => !file.rel.startsWith(ALLOWED_PREFIX) && file.rel !== ALLOWED_FILE)
      .map((file) => file.rel);
    expect(outside).toEqual([]);
  });
});
