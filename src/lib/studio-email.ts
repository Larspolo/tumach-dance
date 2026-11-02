/** The email of Nina, in lower case (`STUDIO_EMAIL`). Empty: nobody logs in. Own module, so that the emails to a dancer
 * (`booking-email.ts`) do not depend on the login module (#375). */
/** The address of the studio for the approval email and its calendar file (`STUDIO_ADDRESS`, #540, Nina's answer on
 * #342). A setting of the server, not in the code. Empty: no address. */
export function studioAddress(env: NodeJS.ProcessEnv = process.env): string {
  return (env.STUDIO_ADDRESS ?? "").trim();
}

export function studioEmail(env: NodeJS.ProcessEnv = process.env): string {
  return (env.STUDIO_EMAIL ?? "").trim().toLowerCase();
}
