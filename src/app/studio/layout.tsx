import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { setStudioLocale } from "@/i18n/studio";
import styles from "./studio.module.css";

// The studio app of Nina (#19): its own root layout, with no locale in the address.
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const locale = await setStudioLocale();
  return (
    <html lang={locale}>
      <body className={styles.body}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
