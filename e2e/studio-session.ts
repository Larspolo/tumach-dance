// The studio session of the browser tests (#23): `studio.setup.ts` logs in once and stores the cookie here. The
// login sends a code by email, and Better Auth allows 3 codes a minute: each test with its own login hit that limit.
export const STUDIO_SESSION = "out/e2e/studio-session.json";
