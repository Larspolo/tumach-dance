import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * The WhatsApp link of a dancer's phone number (#496), with `text` as the first line of the chat.
 * `null` when the number is empty (a removed dancer) or cannot be read: the page then shows no link.
 */
export function whatsappLink(phone: string, text: string): string | null {
  const number = parsePhoneNumberFromString(phone, "NL");
  if (!number?.isPossible()) return null;
  return `https://wa.me/${number.number.slice(1)}?text=${encodeURIComponent(text)}`;
}
