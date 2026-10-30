import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Links and the router of next-intl: they keep the locale in the address (#42).
export const { Link, usePathname, useRouter } = createNavigation(routing);
