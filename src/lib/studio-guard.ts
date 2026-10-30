// The guard of the studio app (#19): `src/proxy.ts` runs it before each studio page and studio API route.
// No session: a page goes to the login page, an API route answers 401.
import { NextResponse } from "next/server";
import { LOGIN_PATH } from "./studio-paths";

/** The session check of Better Auth: its headers carry a renewed session cookie. */
export type SessionCheck = (headers: Headers) => Promise<{ session: unknown; headers: Headers | null }>;

export async function studioGuard(
  request: { url: string; headers: Headers; nextUrl: { pathname: string } },
  check: SessionCheck,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === LOGIN_PATH) return NextResponse.next();
  const { session, headers } = await check(request.headers);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  const response = NextResponse.next();
  // The session renews when Nina uses the app: pass the new cookie on.
  for (const cookie of headers?.getSetCookie() ?? []) response.headers.append("set-cookie", cookie);
  return response;
}
