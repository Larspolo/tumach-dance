"use client";
import { useEffect, useRef } from "react";

// The widget of Cloudflare Turnstile (#564, `src/lib/turnstile.ts`). It puts the hidden field
// `cf-turnstile-response` in the form. "interaction-only": a person sees a box only when Cloudflare is not sure.
// Explicit render: the contact form makes its fields again after each answer, so each mount renders a new widget.
// The script loads from this component: the nonce of the page allows it ('strict-dynamic', `csp.ts`).

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile script"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ siteKey, language }: { siteKey: string; language: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let id: string | undefined;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, { sitekey: siteKey, appearance: "interaction-only", language });
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, language]);
  if (!siteKey) return null;
  return <div ref={box} />;
}
