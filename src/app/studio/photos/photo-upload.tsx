"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import styles from "../studio.module.css";
import { uploadPhoto } from "./actions";

// Add photos (#173): one request per file, so that a few phone photos of about 12 MB each fit the body limit.
export function PhotoUpload() {
  const t = useTranslations("StudioPhotos");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const input = formElement.elements.namedItem("photos") as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    const failed: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.set("photo", file);
      const result = await uploadPhoto(form).catch(() => ({ error: "failed" as const }));
      if (result.error) failed.push(t(result.error, { name: file.name }));
    }
    setErrors(failed);
    setBusy(false);
    formElement.reset();
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.form}>
        <span className={styles.label}>{t("choose")}</span>
        <input className={styles.input} type="file" name="photos" accept="image/*" multiple required />
      </label>
      <button className={styles.button} type="submit" disabled={busy}>
        {busy ? t("adding") : t("add")}
      </button>
      {errors.map((error) => (
        <p key={error} className={styles.error}>
          {error}
        </p>
      ))}
    </form>
  );
}
