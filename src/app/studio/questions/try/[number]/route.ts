// The "Try" link of a question for Nina with example data (#146): on the preview, load the seed of its `Example:`
// line once, then open its `Try:` path. The proxy lets only a session of Nina in (#19). The seed is loaded once per
// question, so a second GET changes nothing.
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { tryQuestion } from "@/lib/examples";
import { listNinaQuestions } from "@/lib/github";
import { LOGIN_PATH } from "@/lib/studio-paths";

export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  if (!(await getStudioSession(request.headers))) redirect(LOGIN_PATH);
  const number = Number((await params).number);
  // Read the question again on GitHub: the address names only the number, never the seed or the path.
  const question = (await listNinaQuestions().catch(() => [])).find((q) => q.number === number);
  if (!question) redirect("/studio/questions");
  redirect(tryQuestion(getDb(), question));
}
