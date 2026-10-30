"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type ContactState, sendContact } from "@/app/[locale]/contact-action";
import type { ContactField } from "@/lib/contact";
import styles from "./Home.module.css";

const IDLE: ContactState = { status: "idle", errors: {}, values: { name: "", email: "", message: "" } };

// The contact form of the home page (#152). A server action: the form also sends before the JavaScript loads.
// After a send the thank-you text replaces the fields; after an error the text of the visitor stays.
export function ContactForm() {
  const t = useTranslations("HomePage.contact");
  const tAll = useTranslations();
  const [state, action, pending] = useActionState(sendContact, IDLE);
  if (state.status === "sent") {
    return (
      <div role="status">
        <p>{t("thanks")}</p>
      </div>
    );
  }
  const field = (name: ContactField) => {
    const error = state.errors[name];
    const id = `contact-${name}`;
    return {
      id,
      name,
      defaultValue: state.values[name],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
      error: error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {tAll(error)}
        </p>
      ) : null,
    };
  };
  const name = field("name");
  const email = field("email");
  const message = field("message");
  // The key makes React use the new default values of the state after each answer.
  const key = JSON.stringify(state);
  return (
    <form action={action} noValidate key={key}>
      <p>{t("text")}</p>
      {state.status === "failed" && <p className={styles.fieldError}>{t("failed")}</p>}
      <div className={styles.field}>
        <label htmlFor={name.id}>{t("name")}</label>
        <input
          id={name.id}
          name={name.name}
          type="text"
          autoComplete="name"
          defaultValue={name.defaultValue}
          aria-invalid={name["aria-invalid"]}
          aria-describedby={name["aria-describedby"]}
        />
        {name.error}
      </div>
      <div className={styles.field}>
        <label htmlFor={email.id}>{t("email")}</label>
        <input
          id={email.id}
          name={email.name}
          type="email"
          autoComplete="email"
          defaultValue={email.defaultValue}
          aria-invalid={email["aria-invalid"]}
          aria-describedby={email["aria-describedby"]}
        />
        {email.error}
      </div>
      <div className={styles.field}>
        <label htmlFor={message.id}>{t("message")}</label>
        <textarea
          id={message.id}
          name={message.name}
          rows={3}
          defaultValue={message.defaultValue}
          aria-invalid={message["aria-invalid"]}
          aria-describedby={message["aria-describedby"]}
        />
        {message.error}
      </div>
      <button type="submit" className={styles.btn} disabled={pending}>
        {t("send")}
      </button>
    </form>
  );
}
