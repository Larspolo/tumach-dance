// The HTML part of an email to a dancer (#439): the look of the site (`docs/design/current-site.html`), inline styles
// (Gmail drops a `<style>` in some cases) and a dark mode. React Email gives the components and escapes each text.
// `render()` of `@react-email/render` is async: `decisionEmailHtml()` of `booking-email.ts` adds the HTML part.
// (Next.js refuses `react-dom/server` in server code, so no sync `renderToStaticMarkup`.)
import { Body, Button, Container, Head, Html, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { createElement as h, type ReactNode } from "react";

export type EmailButton = { label: string; url: string };
/** One block of the email: a paragraph, or a paragraph with a button under it. */
export type EmailBlock = { text: string; button?: EmailButton };
export type EmailLayout = { lang: string; greeting: string; blocks: EmailBlock[]; sign: string };

const INK = "#141210";
const PAPER = "#f4efe6";
const RUST = "#a8503a";
const CREAM = "#fbf8f1";
const SERIF = "Georgia, serif";
const MONO = "'Courier New', Courier, monospace";

/** The dark colors: `!important` beats the inline style. Cream on ink keeps the contrast; the light rust on ink too. */
const DARK = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
  body,.t-body,.t-body td,.t-box{background:${INK}!important;color:${PAPER}!important}
  .t-text{color:${PAPER}!important}
  .t-logo-dot{color:#e08a72!important}
  .t-button{background:${PAPER}!important;color:${INK}!important;border-color:${PAPER}!important}
}`;

const text = (children: ReactNode, style: object = {}) =>
  h(
    Text,
    {
      className: "t-text",
      style: { fontFamily: SERIF, fontSize: "17px", lineHeight: "1.6", color: INK, margin: "0 0 16px", ...style },
    },
    children,
  );

function button(b: EmailButton) {
  return h(
    Button,
    {
      href: b.url,
      className: "t-button",
      style: {
        display: "inline-block",
        minHeight: "44px",
        lineHeight: "20px",
        padding: "12px 24px",
        boxSizing: "border-box",
        background: INK,
        color: CREAM,
        border: `1px solid ${INK}`,
        borderRadius: "2px",
        fontFamily: MONO,
        fontSize: "14px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        textDecoration: "none",
      },
    },
    b.label,
  );
}

/** The full HTML document of `layout`. */
export async function emailHtml(layout: EmailLayout): Promise<string> {
  const tree = h(
    Html,
    { lang: layout.lang },
    h(
      Head,
      null,
      h("meta", { name: "color-scheme", content: "light dark" }),
      h("meta", { name: "supported-color-schemes", content: "light dark" }),
      h("style", null, DARK),
    ),
    h(
      Body,
      { className: "t-body", style: { margin: 0, padding: "24px 0", background: PAPER, color: INK } },
      h(
        Container,
        { className: "t-box", style: { maxWidth: "560px", padding: "0 24px", background: PAPER } },
        text(["TUMACH", h("span", { key: "d", className: "t-logo-dot", style: { color: RUST } }, ".")], {
          fontSize: "24px",
          fontWeight: 900,
          letterSpacing: "-1px",
          margin: "0 0 32px",
        }),
        text(layout.greeting),
        ...layout.blocks.map((b, i) =>
          h(
            Section,
            { key: i, style: { margin: "0 0 8px" } },
            text(b.text),
            b.button ? h(Section, { style: { margin: "0 0 24px" } }, button(b.button)) : null,
          ),
        ),
        text(layout.sign, { marginTop: "32px", fontStyle: "italic" }),
      ),
    ),
  );
  return render(tree);
}
