"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** The cache of the studio home in the service worker (`public/sw.js`, #746): its name, also for the log out. */
export const STUDIO_CACHE = "studio-v1";

/**
 * Registers the service worker of the studio app at each open (#746), not only when Nina turns on push: its cache
 * shows the last studio home with no internet. Not on the login page: there is no session, so nothing to keep.
 * The same address and scope as the push (`push-buttons.tsx`), so it is the same worker.
 */
export function OfflineCache() {
  const pathname = usePathname();
  const loggedIn = pathname !== LOGIN_PATH;
  useEffect(() => {
    if (!loggedIn || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/studio" }).catch(() => {});
  }, [loggedIn]);
  return null;
}

/** Deletes the kept studio home (at the log out): no names of dancers stay on the phone. */
export async function deleteOfflineCache(): Promise<void> {
  if ("caches" in window) await caches.delete(STUDIO_CACHE).catch(() => false);
}
