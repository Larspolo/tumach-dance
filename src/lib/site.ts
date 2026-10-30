// The site of this server: "live" or "preview". One image serves both sites (#7), so read SITE_ENV at run time.
// Only "live" counts as live: a missing or wrong value shows the test banner (it never hides it by mistake).
export type SiteEnv = "live" | "preview";

export function siteEnv(value: string | undefined = process.env.SITE_ENV): SiteEnv {
  return value === "live" ? "live" : "preview";
}

/** The address of this site for the links in an email, for example `https://tumach.dance` (`BETTER_AUTH_URL`, #164). */
export function siteOrigin(value: string | undefined = process.env.BETTER_AUTH_URL): string {
  return value ? new URL(value).origin : "http://localhost:3000";
}
