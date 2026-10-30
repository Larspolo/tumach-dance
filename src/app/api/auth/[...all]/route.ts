// The routes of Better Auth (#19): send a login code, log in with it, read and end the session.
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler((request: Request) => getAuth().handler(request));
