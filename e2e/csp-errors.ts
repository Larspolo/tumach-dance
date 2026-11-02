// Fail a browser test when its pages show a Content-Security-Policy error in the console (#491).
import type { Page, TestType } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();

// biome-ignore lint/suspicious/noExplicitAny: the test of each spec file, with its own fixtures.
export function watchCspErrors(test: TestType<any, any>): void {
  test.beforeEach(({ page }: { page: Page }) => {
    const list: string[] = [];
    errors.set(page, list);
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) list.push(message.text());
    });
  });
  test.afterEach(({ page }: { page: Page }) => {
    if ((errors.get(page) ?? []).length > 0) throw new Error(`CSP errors:\n${errors.get(page)?.join("\n")}`);
  });
}
