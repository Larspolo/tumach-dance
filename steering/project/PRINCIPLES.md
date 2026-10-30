# Principles

The direction of tumach-dance, made from the owner's decisions (`steering/project/DECISIONS.md`).
The `new-project` skill writes the first principles from the owner's answers. Then the runs add a principle when the
owner decides a question (the `ticket` skill, "Decision tickets"). Agents: before you recommend an option, compare it
with these principles and name the principle ("follows P1").

## P1. Simple and phone first

When ease and control pull apart, ease wins: few settings with good defaults. Nina does each daily task (approve a
request, set her hours) in a few taps on her phone. Dancers book with no account. Example: the open hours are one
rule such as "weekends all day, weekdays from 17:00, not on Thursday", not a grid of settings per day.

## P2. The look of the current site, not its texts

Nina likes the look of the current tumach.dance and calls it "simple and chill". Each page keeps its colors, fonts,
space and calm layout (a copy with placeholder texts: `docs/design/current-site.html`). Its texts are not the content
of the site: never copy a text, a class, a time or a claim from it. Each real text comes from Nina (a question for
Nina); until then, a page shows a clear placeholder. Example: Nina's studio app uses the same fonts and colors.

## P3. Ready features first

Use the feature of Next.js, the browser or a well-known library before own code: login, push notifications, forms,
translations, a calendar file. Own code only when none does the job; say why in the PR. Example: push with the Web
Push standard of the browser, not with an own app.

## P4. Free and on the home server

Development uses free services only. The preview and the live site run on Lars's home server (Docker, behind
Cloudflare). Each service with a cost (also a fee per payment) gets a decision ticket. Example: email goes through the
current free Mailgun account.

## P11. Trust the dancers, and use what Nina already uses

Nina chose fewer rules and less machinery than the agents proposed, four times (`steering/project/DECISIONS.md`,
2026-10-30). So: no booking rule that the studio does not need yet; a rare case is for Nina to handle herself. A tool
that Nina already uses wins over a new account, an integration or an own system. News for Nina comes as a push on
her phone, not as an email. Examples: a dancer books any free time that has not started (no minimum time, #35) and
cancels with the email link at any time before the start, with no refund rule (#163); the payment is a Tikkie that
Nina sends, and she marks a booking paid herself (no payment provider, #139).

## Owner involvement

The areas where the owner decides each choice, also when one option is clearly best (a decision ticket). In all
other areas the agents decide, and ask only when two options are equally good.

- Only real ties.
- Two people answer. **Lars** (the owner, `Larspolo`) answers the technical questions, the setup steps on his
  accounts and the home server, and the costs. **Nina** (the studio owner, not technical) answers the questions of
  taste and of her studio: the look, the texts, the booking rules that dancers see, which option she likes.
- A question for Nina is in plain words with no technical word: what to look at (a link to the preview), the steps to
  try it, and 2 to 4 choices. One question per ticket. Never send her a technical question.
- Until the feature `nina:review` works, a question for Nina is a `needs-human` ticket for Lars that starts with
  "Question for Nina:"; Lars passes it on. After that, the ticket also gets the label `for-nina`: the page "For Nina"
  shows it, sends a push notification to her phone, and writes her answer on the ticket. Her answer counts as an
  answer of the owner.

## Try a feature

How the owner tries a new feature. The agents make what this needs for each feature or epic.

- Development server (`/try`): Lars types `/try` in a local session; `npm run dev` starts the site at the newest main.
- Images in each PR: Playwright screenshots of each changed page on a phone (390×844) and a laptop (1280×800), the
  last level of the `verify` skill.
- The preview for Nina: each merge to main updates the preview site on the home server within minutes, with test data
  and a "test site" banner. Nina opens it on her phone and her laptop, with no step by Lars. At the end of each epic
  that changes what Nina or a dancer sees, make a question for Nina with the steps to try it on the preview.
