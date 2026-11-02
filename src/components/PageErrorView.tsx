// The page after a server error of a page (#362): a heading, a short text, "Try again" and a way back. No text of
// the error itself (it can hold a detail of the server); only its digest in small text, so Lars can find it in the log.
// No hooks: `error.tsx` of `[locale]` and of `studio` give the texts and the look.
export type PageErrorTexts = { title: string; text: string; retry: string; home: string; code: string };
/** The class names of a CSS module: `main`, `title`, `note`, `links`, `button`, `link`. */
export type PageErrorLook = { readonly [key: string]: string };

export function PageErrorView({
  texts,
  look,
  homeHref,
  digest,
  reset,
}: {
  texts: PageErrorTexts;
  look: PageErrorLook;
  homeHref: string;
  digest?: string;
  reset: () => void;
}) {
  return (
    <main className={look.main}>
      <h1 className={look.title}>{texts.title}</h1>
      <p className={look.note}>{texts.text}</p>
      <p className={look.links}>
        <button className={look.button} type="button" onClick={() => reset()}>
          {texts.retry}
        </button>
        {/* A full load: after an error a fresh page is the safe way back. */}
        <a className={look.link} href={homeHref}>
          {texts.home}
        </a>
      </p>
      {digest ? (
        <p className={look.note}>
          <small>
            {texts.code} {digest}
          </small>
        </p>
      ) : null}
    </main>
  );
}
