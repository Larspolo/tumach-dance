import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getAuth } from "./lib/auth";
import { studioGuard } from "./lib/studio-guard";
import { isStudioPath } from "./lib/studio-paths";

const intl = createMiddleware(routing);

/** The English address of an address of Slovenian, which the site no longer has (#299): old links still work. */
export function removedLocalePath(pathname: string): string | undefined {
  if (pathname === "/sl" || pathname.startsWith("/sl/")) return `/en${pathname.slice(3)}`;
}

// The public pages get the locale of next-intl; the studio app (no locale in its address) needs a session (#19).
export default function proxy(request: NextRequest) {
  const removed = removedLocalePath(request.nextUrl.pathname);
  if (removed) return NextResponse.redirect(new URL(removed + request.nextUrl.search, request.url), 308);
  if (!isStudioPath(request.nextUrl.pathname)) return intl(request);
  return studioGuard(request, async (headers) => {
    const result = await getAuth().api.getSession({ headers, returnHeaders: true });
    return { session: result.response, headers: result.headers };
  });
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|photos/|.*\\..*).*)", "/api/studio/:path*"],
};
