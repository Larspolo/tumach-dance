import type { AbstractIntlMessages } from "next-intl";

// The texts that the client components of the public pages use (#453). Only these go into the HTML of a page: all
// the texts of the site (about 20 KB) made each page heavier and its first text slower on a phone.
// A new `useTranslations("X")` in a client component of `src/components/` or `src/app/[locale]/` needs "X" here
// (`tests/client-messages.test.ts` checks it).
export const CLIENT_NAMESPACES = ["HomePage.contact", "Contact.errors", "LanguageSwitcher", "PageError"] as const;

/** The part of `messages` at the dotted paths of `namespaces`, in the same tree shape. */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[] = CLIENT_NAMESPACES,
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const namespace of namespaces) {
    const path = namespace.split(".");
    let from: AbstractIntlMessages | string | undefined = messages;
    for (const key of path) from = typeof from === "object" ? from[key] : undefined;
    if (from === undefined) continue;
    let to = picked;
    for (const key of path.slice(0, -1)) {
      if (typeof to[key] !== "object") to[key] = {};
      to = to[key] as AbstractIntlMessages;
    }
    to[path[path.length - 1]] = from;
  }
  return picked;
}
