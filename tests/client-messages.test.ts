import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";
import en from "../messages/en.json";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("pickMessages", () => {
  it("keeps only the named parts, in the same tree shape", () => {
    const messages = { A: { b: { c: "1" }, d: "2" }, E: { f: "3" }, G: "4" };
    expect(pickMessages(messages, ["A.b", "G", "X.y"])).toEqual({ A: { b: { c: "1" } }, G: "4" });
  });

  it("gives far fewer texts to the browser than all the texts", () => {
    const picked = pickMessages(en);
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(en).length / 5);
    expect(picked).toMatchObject({ HomePage: { contact: en.HomePage.contact }, PageError: en.PageError });
  });

  it("has each namespace that a client component of the public pages uses", () => {
    const used = new Set<string>();
    for (const file of [...files("src/components"), ...files("src/app/[locale]")]) {
      const code = readFileSync(file, "utf8");
      if (!code.includes('"use client"')) continue;
      for (const match of code.matchAll(/useTranslations\(\s*"([^"]+)"\s*\)/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const namespace of used) {
      expect(CLIENT_NAMESPACES.some((n) => namespace === n || namespace.startsWith(`${n}.`))).toBe(true);
    }
  });

  it("has each namespace in the English texts", () => {
    for (const namespace of CLIENT_NAMESPACES) {
      const value = namespace.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], en);
      expect(value, namespace).toBeDefined();
    }
  });
});
