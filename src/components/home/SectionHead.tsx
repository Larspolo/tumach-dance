import styles from "./Home.module.css";

export function SectionHead({ id, title, label }: { id: string; title: string; label: string }) {
  return (
    <div className={styles.secHead}>
      <h2 id={`${id}-title`}>{title}</h2>
      <span className={styles.secNum}>{label}</span>
    </div>
  );
}
