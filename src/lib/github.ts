// The questions for Nina on GitHub (#67): read the open tickets with the label `for-nina` and post her answer.
// `fetch` of Node: a client library adds a dependency for three calls (P3). With no `GITHUB_TOKEN`, there is no
// question and nothing is posted: the server does not fail.
import { type NinaQuestion, parseNinaQuestion } from "./nina-question";

const LABEL = "for-nina";

type Issue = {
  number: number;
  title: string;
  body: string | null;
  pull_request?: unknown;
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

/** The open questions for Nina, parsed. No pull requests and no tickets without `## For Nina`. */
export async function listNinaQuestions(env: NodeJS.ProcessEnv = process.env): Promise<NinaQuestion[]> {
  const s = settings(env);
  if (!s) return [];
  const issues = (await call(s, `/issues?labels=${LABEL}&state=open&per_page=100`)) as Issue[];
  return issues
    .filter((issue) => !issue.pull_request)
    .map(parseNinaQuestion)
    .filter((question): question is NinaQuestion => question !== null);
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
  const head = choice ? `Nina's answer: ${choice.key}. ${choice.text}` : "Nina's answer:";
  const body = answer.text.trim() ? `${head}\n\n${answer.text.trim()}` : head;
  await call(s, `/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

/** The number of open questions for Nina, for the link on the start page (#130); null when GitHub fails. */
export async function countNinaQuestions(env: NodeJS.ProcessEnv = process.env): Promise<number | null> {
  try {
    return (await listNinaQuestions(env)).length;
  } catch {
    return null;
  }
}
