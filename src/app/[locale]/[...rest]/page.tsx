import { notFound } from "next/navigation";

// Each unknown address below a language (#359): the not-found page of `[locale]` with the Nav and the Footer.
export default function UnknownPage() {
  notFound();
}
