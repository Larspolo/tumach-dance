import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import styles from "./guide.module.css";

// The guide for Nina (#45): log in, add the app to the home screen, turn on notifications. Public: she reads it
// before she can log in. The pictures come from `e2e/guide-screenshots.spec.ts` (`public/guide/<locale>/`).
type Step = { text: string; image?: string };

export default async function StudioGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("StudioGuide");
  const image = (name: string) => `/guide/${locale}/${name}.png`;
  const parts: { id: string; title: string; steps: Step[] }[] = [
    {
      id: "login",
      title: t("loginTitle"),
      steps: [
        { text: t("loginOpen") },
        { text: t("loginEmail"), image: image("login-email") },
        { text: t("loginCode"), image: image("login-code") },
      ],
    },
    {
      id: "install",
      title: t("installTitle"),
      steps: [{ text: t("installIphone") }, { text: t("installAndroid") }, { text: t("installOpen") }],
    },
    {
      id: "notifications",
      title: t("pushTitle"),
      steps: [
        { text: t("pushTurnOn"), image: image("push-off") },
        { text: t("pushAllow") },
        { text: t("pushTest"), image: image("push-on") },
      ],
    },
  ];
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      {parts.map((part, p) => (
        <section key={part.id} id={part.id} className={styles.part}>
          <h2 className={styles.heading}>
            {p + 1}. {part.title}
          </h2>
          <ol className={styles.steps}>
            {part.steps.map((step) => (
              <li key={step.text} className={styles.step}>
                <p>{step.text}</p>
                {step.image && (
                  <Image className={styles.image} src={step.image} alt={step.text} width={390} height={844} />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
