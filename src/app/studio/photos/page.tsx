import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listPhotos } from "@/db/photos";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { deletePhoto } from "./actions";
import { PhotoUpload } from "./photo-upload";

// The photos of the studio (#173): Nina adds photos from her phone and removes a photo with two taps.
export default async function PhotosPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioPhotos");
  const photos = listPhotos(getDb());

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      <PhotoUpload />
      {photos.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.photos}>
        {photos.map((photo, i) => (
          <li key={photo.id}>
            {/* biome-ignore lint/performance/noImgElement: the route of #172 gives the small version as it is. */}
            <img
              className={styles.photo}
              src={`/photos/${photo.file}-small.webp`}
              width={photo.width}
              height={photo.height}
              alt={t("alt", { number: i + 1 })}
            />
            <details>
              <summary className={styles.link}>{t("remove")}</summary>
              <form action={deletePhoto}>
                <input type="hidden" name="id" value={photo.id} />
                <button className={styles.button} type="submit">
                  {t("removeConfirm")}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </main>
  );
}
