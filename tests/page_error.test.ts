// The page after a server error (#362): the texts in the language of the page, "Try again" calls `reset`, the way
// back (home page or studio), and no text of the error itself.
import { NextIntlClientProvider } from "next-intl";
import { type ComponentProps, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import PageError from "../src/app/[locale]/error";
import StudioPageError from "../src/app/studio/error";
import { PageErrorView } from "../src/components/PageErrorView";

const error = Object.assign(new Error("SQLITE_BUSY at /srv/secret/tumach.db"), { digest: "4242" });

function render(page: typeof PageError, locale: "en" | "nl") {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: locale === "en" ? en : nl } as unknown as ComponentProps<typeof NextIntlClientProvider>,
      createElement(page, { error, reset: () => {} }),
    ),
  );
}

describe("the error page", () => {
  test.each([
    ["en", en],
    ["nl", nl],
  ] as const)("public page in %s: the texts, the home page, no error text", (locale, m) => {
    const html = render(PageError, locale);
    expect(html).toContain(`<h1`);
    expect(html).toContain(m.PageError.title);
    expect(html).toContain(m.PageError.text);
    expect(html).toContain(m.PageError.retry);
    expect(html).toContain(`href="/${locale}"`);
    expect(html).toContain("4242");
    expect(html).not.toContain("SQLITE_BUSY");
    expect(html).not.toContain("secret");
  });

  test.each([
    ["en", en],
    ["nl", nl],
  ] as const)("studio page in %s: the link to /studio, no error text", (locale, m) => {
    const html = render(StudioPageError, locale);
    expect(html).toContain(m.PageError.title);
    expect(html).toContain(m.PageError.studioHome);
    expect(html).toContain('href="/studio"');
    expect(html).not.toContain("SQLITE_BUSY");
  });

  test("the button 'Try again' calls reset", () => {
    const reset = vi.fn();
    const look = { main: "", title: "", note: "", links: "", button: "", link: "" };
    const texts = { title: "t", text: "x", retry: "Try again", home: "h", code: "c" };
    const tree = PageErrorView({ texts, look, homeHref: "/en", reset });
    const find = (node: ReactNode): ReactElement<{ onClick?: () => void }> | undefined => {
      if (!node || typeof node !== "object") return undefined;
      if (Array.isArray(node)) return node.map(find).find(Boolean);
      const el = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
      if (el.type === "button") return el;
      return find(el.props.children);
    };
    const button = find(tree);
    expect(button).toBeDefined();
    button?.props.onClick?.();
    expect(reset).toHaveBeenCalledOnce();
  });
});
