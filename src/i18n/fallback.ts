import deepmerge from "deepmerge";

// The messages of the locale over the English ones: a text that is missing in
// the locale shows its English text, nested keys included.
export function withFallback<T extends object>(messages: object, fallback: T): T {
  return deepmerge(fallback, messages) as T;
}
