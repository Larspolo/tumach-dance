// The privacy page says how long a backup keeps the data (#277): the nights of `BACKUP_KEEP_NIGHTS` in each language.
import { createTranslator } from "next-intl";
import { expect, test } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import sl from "../messages/sl.json";
import { BACKUP_KEEP_NIGHTS } from "../src/lib/backup";

const all = { en, nl, sl };

test.each(Object.entries(all))("%s: the backup text shows the number of nights", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Privacy" });
  expect(t("backup", { nights: BACKUP_KEEP_NIGHTS })).toContain(String(BACKUP_KEEP_NIGHTS));
  expect(t("backup", { nights: 7 })).toContain("7");
});
