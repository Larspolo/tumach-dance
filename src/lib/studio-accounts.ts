// The accounts of the studio that the site links (#451, Nina's answer on #450): settings of the server, the pattern of
// `studioEmail()`. No value: no link.

export type StudioAccount = { kind: "instagram" | "whatsapp"; href: string; handle: string };

/** `STUDIO_INSTAGRAM` (a name, also with "@") and `STUDIO_WHATSAPP` (a number with the country code) as links. */
export function studioAccounts(env: NodeJS.ProcessEnv = process.env): StudioAccount[] {
  const accounts: StudioAccount[] = [];
  const name = (env.STUDIO_INSTAGRAM ?? "").trim().replace(/^@/, "");
  if (/^[\w.]+$/.test(name)) {
    accounts.push({ kind: "instagram", href: `https://www.instagram.com/${name}/`, handle: `@${name}` });
  }
  const digits = (env.STUDIO_WHATSAPP ?? "").replace(/\D/g, "");
  if (digits !== "") accounts.push({ kind: "whatsapp", href: `https://wa.me/${digits}`, handle: "" });
  return accounts;
}
