// The addresses of the studio app (#19), for the guard and the pages (also in the browser).
export const LOGIN_PATH = "/studio/login";

/** A studio page or a studio API route. */
export function isStudioPath(pathname: string): boolean {
  return /^\/(api\/)?studio(\/|$)/.test(pathname);
}
