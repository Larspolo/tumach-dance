import emailSpellChecker from "@zootools/email-spell-checker";

// Common providers in the Netherlands that the list of the library does not have.
const MORE_DOMAINS = [
  "hotmail.com",
  "hotmail.nl",
  "outlook.com",
  "live.nl",
  "live.com",
  "yahoo.com",
  "ziggo.nl",
  "kpnmail.nl",
  "xs4all.nl",
  "planet.nl",
];
const DOMAINS = [...emailSpellChecker.POPULAR_DOMAINS, ...MORE_DOMAINS];

/**
 * The fixed address when the domain of `email` looks like a typo of a common provider, else null (#493).
 * Only a fix to a common provider counts: the library also changes an unknown top-level domain
 * (`studio.test` → `studio.de`), which would ask the dancer of a small domain for no reason.
 */
export function emailSuggestion(email: string): string | null {
  const typed = email.trim();
  const result = emailSpellChecker.run({ email: typed, domains: DOMAINS });
  if (!result || result.full === typed) return null;
  return DOMAINS.includes(result.domain) ? result.full : null;
}
