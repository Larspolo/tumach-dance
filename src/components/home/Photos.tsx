import { useTranslations } from "next-intl";
import { type Photo, SMALL_PX } from "@/db/photos";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

/** The width of the small version: `addPhoto()` resizes the long side to at most `SMALL_PX`. */
function smallWidth(photo: Photo): number {
  const scale = Math.min(1, SMALL_PX / Math.max(photo.width, photo.height));
  return Math.round(photo.width * scale);
}

// The photos of the studio (#174). A plain `<img>` with `srcset`: the route of #172 serves the two WebP versions that
// `addPhoto()` made, and `next/image` would resize them again. No photos: no section.
export function Photos({ photos }: { photos: Photo[] }) {
  const t = useTranslations("HomePage.photos");
  if (photos.length === 0) return null;
  return (
    <section id="photos" aria-labelledby="photos-title" className={`${styles.section} ${styles.photos}`}>
      <SectionHead id="photos" title={t("title")} label={t("label")} />
      <ul className={styles.photoGrid}>
        {photos.map((photo, i) => (
          <li key={photo.id} className={styles.photo}>
            {/* biome-ignore lint/performance/noImgElement: the two versions exist already; `next/image` would resize them again */}
            <img
              src={`/photos/${photo.file}-large.webp`}
              srcSet={`/photos/${photo.file}-small.webp ${smallWidth(photo)}w, /photos/${photo.file}-large.webp ${photo.width}w`}
              sizes="(max-width: 760px) 100vw, 50vw"
              width={photo.width}
              height={photo.height}
              alt={t("alt")}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
