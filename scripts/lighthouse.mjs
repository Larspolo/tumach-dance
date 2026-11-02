// Measure how fast the home and the booking page open on a phone (#447, epic #446 `site:fast`).
// A plain Node script, as `scripts/restore.mjs`. First `npm run build`. Then:
//   node scripts/lighthouse.mjs [--runs 3] [--lcp 2500] [--margin 0] [--ttfb 600] [--cls 0.1] [--tbt 600] [--kb 1000] [--url http://localhost:3100]
// With no `--url` it starts the build on port 3102 with a throwaway database in out/lighthouse (one lesson offer, one
// class, two photos). With no `--lcp` each page has its own LCP budget (`LCP_BUDGET`). It prints one line per page with the medians and exits 1 when a page is over a budget.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PAGES = ["/en", "/nl", "/en/book", "/nl/book"];

/** The LCP budget in ms of each page when no `--lcp` is given (owner, option C of #469): 3.0 s home, 2.5 s booking. */
export const LCP_BUDGET = { "/en": 3000, "/nl": 3000, "/en/book": 2500, "/nl/book": 2500 };

/** The budget of one page: the LCP of `LCP_BUDGET` unless the arguments give `--lcp`, plus `margin` ms. CI gives a
 * margin (#448): one run of the same page can be about 1 s slower than the next (a frame stall of headless Chromium),
 * so the exact budget fails PRs that changed nothing. */
export function budgetFor(page, budget = {}, margin = 0) {
  const lcp = budget.lcp ?? LCP_BUDGET[page];
  return lcp === undefined ? budget : { ...budget, lcp: lcp + margin };
}

/** The median of numbers (the mean of the two middle values for an even count). */
export function median(values) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The metrics of one Lighthouse JSON result: LCP, TBT and TTFB in ms, CLS, transfer size in KB. TTFB is the
 * measured server response time of the page: the simulated LCP leaves it out, so a page that is 3 s slower on the
 * server keeps its LCP (#448). */
export function metrics(result) {
  const audit = (id) => result.audits[id]?.numericValue ?? Number.NaN;
  return {
    lcp: audit("largest-contentful-paint"),
    ttfb: audit("server-response-time"),
    cls: audit("cumulative-layout-shift"),
    tbt: audit("total-blocking-time"),
    kb: audit("total-byte-weight") / 1024,
  };
}

/** The top opportunities of one result: title and saving in ms, largest first. */
export function opportunities(result, top = 3) {
  return Object.values(result.audits)
    .filter((a) => a.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 0)
    .map((a) => ({ id: a.id, title: a.title, ms: a.details.overallSavingsMs }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, top);
}

/** The medians of the runs of one page, and the budget names that it is over. */
export function summarize(results, budget = {}) {
  const all = results.map(metrics);
  const med = {};
  for (const key of ["lcp", "ttfb", "cls", "tbt", "kb"]) med[key] = median(all.map((m) => m[key]));
  const over = Object.keys(budget).filter((key) => budget[key] !== undefined && !(med[key] <= budget[key]));
  return { ...med, runs: all.map((m) => m.lcp), over };
}

/** One line of the output. */
export function formatLine(page, s) {
  const over = s.over.length > 0 ? `  OVER: ${s.over.join(", ")}` : "";
  const runs = s.runs?.length > 1 ? `  (runs ${s.runs.map((ms) => (ms / 1000).toFixed(2)).join(" ")})` : "";
  return `${page.padEnd(9)} LCP ${(s.lcp / 1000).toFixed(2)} s  TTFB ${Math.round(s.ttfb)} ms  CLS ${s.cls.toFixed(3)}  TBT ${Math.round(s.tbt)} ms  ${Math.round(s.kb)} KB${runs}${over}`;
}

/** The first line of the output: the LCP budget of each page with the margin, and the count of runs. */
export function budgetLine(opts) {
  const seconds = (page) => ((budgetFor(page, opts.budget, opts.margin).lcp ?? Number.NaN) / 1000).toFixed(2);
  const margin = opts.margin ? ` (with a margin of ${(opts.margin / 1000).toFixed(2)} s)` : "";
  const ttfb = opts.budget.ttfb === undefined ? "" : `; TTFB budget ${opts.budget.ttfb} ms`;
  return `LCP budget: ${PAGES.map((page) => `${page} ${seconds(page)} s`).join(", ")}${margin}${ttfb}; medians of ${opts.runs} runs`;
}

/** The arguments: `--runs N`, `--url U`, the budgets `--lcp ms`, `--ttfb ms`, `--cls`, `--tbt ms`, `--kb KB` and `--margin ms`
 * (added to the LCP budget of each page). */
export function parseArgs(argv) {
  const opts = { runs: 3, url: undefined, budget: {}, margin: 0, json: undefined };
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i].replace(/^--/, ""), argv[i + 1]];
    if (name === "runs") opts.runs = Number(value);
    else if (name === "url") opts.url = value;
    else if (name === "json") opts.json = value;
    else if (name === "margin") opts.margin = Number(value);
    else if (["lcp", "ttfb", "cls", "tbt", "kb"].includes(name)) opts.budget[name] = Number(value);
    else throw new Error(`Unknown argument --${name}`);
  }
  return opts;
}

const DIR = "out/lighthouse";
const PORT = 3102;

async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`The site did not start: ${url}`);
}

/** Start the build with a throwaway database and add the test data. Returns the server process. */
async function startSite() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(join(DIR, "photos"), { recursive: true });
  const env = {
    ...process.env,
    EMAIL_TRANSPORT: "log",
    EMAIL_LOG_FILE: join(DIR, "email.log"),
    DATABASE_PATH: join(DIR, "tumach.db"),
    STUDIO_EMAIL: "nina@example.test",
    BETTER_AUTH_URL: `http://localhost:${PORT}`,
    BETTER_AUTH_SECRET: "lighthouse-only-secret-of-the-throwaway-database",
  };
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  await waitFor(`http://localhost:${PORT}/en`);
  // The migrations ran at the start: add the rows now.
  const { default: Database } = await import("better-sqlite3");
  const { default: sharp } = await import("sharp");
  const db = new Database(env.DATABASE_PATH);
  db.prepare(
    "INSERT INTO offers (kind, minutes, price_cents, visible, position) VALUES ('lesson', 60, 6000, 1, 1)",
  ).run();
  const text = (en, nl) => JSON.stringify({ en, nl });
  const cls = db
    .prepare("INSERT INTO classes (name, text, for_whom, visible, position) VALUES (?, ?, ?, 1, 1)")
    .run(
      text("Contemporary", "Contemporary"),
      text("A calm class.", "Een rustige les."),
      text("All levels", "Alle niveaus"),
    );
  db.prepare("INSERT INTO class_times (class_id, weekday, \"from\", \"to\") VALUES (?, 'tue', '19:00', '20:30')").run(
    cls.lastInsertRowid,
  );
  for (const [i, color] of [
    [1, "#c9b8a6"],
    [2, "#8a9a8c"],
  ]) {
    const file = `lighthouse-photo-${i}`;
    for (const [suffix, width, height] of [
      ["large", 1600, 1067],
      ["small", 640, 427],
    ]) {
      await sharp({ create: { width, height, channels: 3, background: color } })
        .webp()
        .toFile(join(DIR, "photos", `${file}-${suffix}.webp`));
    }
    db.prepare("INSERT INTO photos (file, width, height, position, created_at) VALUES (?, 1600, 1067, ?, ?)").run(
      file,
      i,
      Date.now(),
    );
  }
  db.close();
  return server;
}

function lighthouse(url) {
  const out = spawnSync(
    "npx",
    [
      "-y",
      "lighthouse@12",
      url,
      `--chrome-path=${process.env.CHROME_PATH || "/opt/pw-browsers/chromium"}`,
      "--chrome-flags=--headless --no-sandbox",
      "--only-categories=performance",
      "--output=json",
      "--quiet",
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (out.status !== 0) throw new Error(`Lighthouse failed on ${url}: ${out.stderr}`);
  return JSON.parse(out.stdout);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = opts.url ? undefined : await startSite();
  const base = opts.url ?? `http://localhost:${PORT}`;
  let failed = false;
  const report = {};
  console.log(budgetLine(opts));
  try {
    for (const page of PAGES) {
      const results = [];
      for (let i = 0; i < opts.runs; i++) results.push(lighthouse(base + page));
      const s = summarize(results, budgetFor(page, opts.budget, opts.margin));
      report[page] = { ...s, opportunities: opportunities(results[results.length - 1]) };
      console.log(formatLine(page, s));
      for (const o of report[page].opportunities) console.log(`          - ${o.title}: ${Math.round(o.ms)} ms`);
      if (s.over.length > 0) failed = true;
    }
    if (opts.json) (await import("node:fs")).writeFileSync(opts.json, JSON.stringify(report, null, 2));
  } finally {
    if (server) process.kill(-server.pid);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
}
