// The questions for Nina on GitHub (#67): read the open tickets with the label `for-nina` and post her answer.
// `fetch` of Node: a client library adds a dependency for three calls (P3). With no `GITHUB_TOKEN`, there is no
// question and nothing is posted: the server does not fail.
import { DateTime } from "luxon";
import { type NinaQuestion, parseNinaQuestion } from "./nina-question";
import { siteEnv } from "./site";

const LABEL = "for-nina";

type Issue = {
  number: number;
  title: string;
  body: string | null;
  pull_request?: unknown;
  comments?: number;
  labels: (string | { name?: string })[];
};

function settings(env: NodeJS.ProcessEnv) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo, api: (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "") };
}

async function call(s: NonNullable<ReturnType<typeof settings>>, path: string, init: RequestInit = {}) {
  const response = await fetch(`${s.api}/repos/${s.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${response.status}`);
  return response.json();
}

const ANSWER_HEAD = "Nina's answer:";

/** True when the last comment of the issue is an answer of Nina (#178): a newer comment of a run asks again. */
async function answered(s: NonNullable<ReturnType<typeof settings>>, issue: Issue): Promise<boolean> {
  if (!issue.comments) return false;
  const page = Math.ceil(issue.comments / 100);
  const comments = (await call(
    s,
    `/issues/${issue.number}/comments?per_page=100${page > 1 ? `&page=${page}` : ""}`,
  )) as { body?: string | null }[];
  return (comments.at(-1)?.body ?? "").startsWith(ANSWER_HEAD);
}

/**
 * The open questions for Nina, parsed. No pull requests, no tickets without `## For Nina`, and no question that
 * Nina answered last (#178).
 */
export async function listNinaQuestions(env: NodeJS.ProcessEnv = process.env): Promise<NinaQuestion[]> {
  const s = settings(env);
  if (!s) return [];
  const issues = (await call(s, `/issues?labels=${LABEL}&state=open&per_page=100`)) as Issue[];
  const questions = issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({ issue, question: parseNinaQuestion(issue) }))
    .filter((q): q is { issue: Issue; question: NinaQuestion } => q.question !== null);
  const done = await Promise.all(questions.map((q) => answered(s, q.issue)));
  return questions.filter((_, i) => !done[i]).map((q) => q.question);
}

/**
 * Post the answer of Nina on ticket `number`. Only on a ticket with the label `for-nina`: the page never writes on
 * another ticket. No agent footer: the comment is the answer of the owner.
 */
export async function postNinaAnswer(
  number: number,
  answer: { choice: string | null; text: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const s = settings(env);
  if (!s) return;
  const issue = (await call(s, `/issues/${number}`)) as Issue;
  const labels = issue.labels.map((label) => (typeof label === "string" ? label : label.name));
  if (!labels.includes(LABEL)) throw new Error(`GitHub: issue ${number} is not a question for Nina`);
  const question = parseNinaQuestion(issue);
  const choice = question?.choices.find((c) => c.key === answer.choice);
  const head = choice ? `${ANSWER_HEAD} ${choice.key}. ${choice.text}` : ANSWER_HEAD;
  const body = answer.text.trim() ? `${head}\n\n${answer.text.trim()}` : head;
  await call(s, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

const FEEDBACK_LABEL = "from-nina";
export const FEEDBACK_MAX = 5000;

/** The title and body of a feedback ticket of Nina (#108): her first line in the title, her text as a quote. */
export function ninaFeedbackIssue(text: string, site: string, now: DateTime = DateTime.utc()) {
  const trimmed = text.trim();
  const firstLine = trimmed.split(/\r?\n/)[0].trim().slice(0, 60);
  const quote = trimmed
    .split(/\r?\n/)
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
  const when = now.setZone("Europe/Amsterdam").toFormat("yyyy-MM-dd HH:mm");
  return {
    title: `Feedback from Nina: ${firstLine}`,
    body: `${quote}\n\nSent from the studio app (${site}, ${when} Europe/Amsterdam)`,
    labels: [FEEDBACK_LABEL],
  };
}

/**
 * Make a GitHub ticket of the feedback of Nina (#108). No agent footer: the token is the owner's, and a message of
 * Nina counts as one of the owner. An empty or too long text, or no `GITHUB_TOKEN`: no call, an error.
 */
export async function createNinaFeedback(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
  now: DateTime = DateTime.utc(),
): Promise<{ ok: true; number: number } | { ok: false; error: "empty" | "tooLong" | "notSent" }> {
  if (!text.trim()) return { ok: false, error: "empty" };
  if (text.length > FEEDBACK_MAX) return { ok: false, error: "tooLong" };
  const s = settings(env);
  if (!s) return { ok: false, error: "notSent" };
  try {
    const issue = (await call(s, "/issues", {
      method: "POST",
      body: JSON.stringify(ninaFeedbackIssue(text, siteEnv(env.SITE_ENV), now)),
    })) as { number: number };
    return { ok: true, number: issue.number };
  } catch {
    return { ok: false, error: "notSent" };
  }
}

/** The number of open questions for Nina, for the link on the start page (#130); null when GitHub fails. */
export async function countNinaQuestions(env: NodeJS.ProcessEnv = process.env): Promise<number | null> {
  try {
    return (await listNinaQuestions(env)).length;
  } catch {
    return null;
  }
}
