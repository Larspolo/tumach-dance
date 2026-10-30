// The Tikkie link that Nina pastes at an approval (#142). Tikkie has no API: the site only passes the link on.

/** `null` for an empty field, the URL for an `https://` link, `"invalid"` for any other text. */
export function tikkieLink(value: FormDataEntryValue | null): string | null | "invalid" {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "invalid";
  } catch {
    return "invalid";
  }
}
