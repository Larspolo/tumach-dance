// The addresses of the studio app (#19), for the guard and the pages (also in the browser).
export const LOGIN_PATH = "/studio/login";

/** A studio page or a studio API route. */
export function isStudioPath(pathname: string): boolean {
  return /^\/(api\/)?studio(\/|$)/.test(pathname);
}

/**
 * The page to go back to after a form of the studio app (#599): only a path in the studio app (`/studio/...`), else the
 * fallback. No other site (`//host`), no backslash and no `..`, so a form field cannot send Nina away.
 */
export function backPath(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string" || !/^\/studio\/[A-Za-z0-9/?=&_-]*$/.test(value) || value.includes("..")) {
    return fallback;
  }
  return value;
}
