import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getAuth } from "./lib/auth";
import { contentSecurityPolicy, makeNonce } from "./lib/csp";
import { studioGuard } from "./lib/studio-guard";
import { isStudioPath } from "./lib/studio-paths";

const intl = createMiddleware(routing);

/** The English address of an address of Slovenian, which the site no longer has (#299): old links still work. */
export function removedLocalePath(pathname: string): string | undefined {
  if (pathname === "/sl" || pathname.startsWith("/sl/")) return `/en${pathname.slice(3)}`;
}

// The public pages get the locale of next-intl; the studio app (no locale in its address) needs a session (#19).
// Each page gets a Content-Security-Policy with a new nonce (#491): Next.js reads it from the request headers.
export default async function proxy(incoming: NextRequest) {
  const removed = removedLocalePath(incoming.nextUrl.pathname);
  if (removed) return NextResponse.redirect(new URL(removed + incoming.nextUrl.search, incoming.url), 308);
  const csp = contentSecurityPolicy(makeNonce(), process.env.NODE_ENV === "development");
  const headers = new Headers(incoming.headers);
  headers.set("content-security-policy", csp);
  const request = new NextRequest(incoming, { headers });
  const response = isStudioPath(request.nextUrl.pathname)
    ? await studioGuard(request, async (headers) => {
        const result = await getAuth().api.getSession({ headers, returnHeaders: true });
        return { session: result.response, headers: result.headers };
      })
    : intl(request);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|photos/|.*\\..*).*)", "/api/studio/:path*"],
};
