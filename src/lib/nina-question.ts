// A question for Nina in a ticket (#66): read the fixed form of its body, for the page "For Nina".
// A pure function, so that a test runs it with no issue, database or request.

export type NinaChoice = { key: string; text: string };

export type NinaQuestion = {
  number: number;
  title: string;
  text: string;
  tryPath: string | null;
  choices: NinaChoice[];
};

const TITLE_PREFIX = "Question for Nina: ";
const CHOICE = /^- ([A-Z])\. (.+)$/;

/** The question of a ticket, or null when its body has no section `## For Nina`. */
export function parseNinaQuestion(issue: { number: number; title: string; body: string | null }): NinaQuestion | null {
  const lines = (issue.body ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## For Nina");
  if (start < 0) return null;
  const next = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  const section = lines.slice(start + 1, next < 0 ? lines.length : next).map((line) => line.trim());

  const choices: NinaChoice[] = [];
  const textLines: string[] = [];
  let tryPath: string | null = null;
  let textDone = false;
  for (const line of section) {
    const choice = CHOICE.exec(line);
    if (choice) {
      choices.push({ key: choice[1], text: choice[2] });
      textDone = true;
    } else if (line.startsWith("Try:")) {
      const path = line.slice("Try:".length).trim();
      tryPath = path.startsWith("/") && !path.startsWith("//") ? path : null;
      textDone = true;
    } else if (!textDone && line !== "") {
      textLines.push(line);
    }
  }

  return {
    number: issue.number,
    title: issue.title.startsWith(TITLE_PREFIX) ? issue.title.slice(TITLE_PREFIX.length) : issue.title,
    text: textLines.join("\n"),
    tryPath,
    choices,
  };
}
