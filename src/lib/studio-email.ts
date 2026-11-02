/** The email of Nina, in lower case (`STUDIO_EMAIL`). Empty: nobody logs in. Own module, so that the emails to a dancer
 * (`booking-email.ts`) do not depend on the login module (#375). */
export function studioEmail(env: NodeJS.ProcessEnv = process.env): string {
  return (env.STUDIO_EMAIL ?? "").trim().toLowerCase();
}
