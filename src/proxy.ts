import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getAuth } from "./lib/auth";
import { studioGuard } from "./lib/studio-guard";
import { isStudioPath } from "./lib/studio-paths";

const intl = createMiddleware(routing);

// The public pages get the locale of next-intl; the studio app (no locale in its address) needs a session (#19).
export default function proxy(request: NextRequest) {
  if (!isStudioPath(request.nextUrl.pathname)) return intl(request);
  return studioGuard(request, async (headers) => {
    const result = await getAuth().api.getSession({ headers, returnHeaders: true });
    return { session: result.response, headers: result.headers };
  });
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|photos/|.*\\..*).*)", "/api/studio/:path*"],
};
