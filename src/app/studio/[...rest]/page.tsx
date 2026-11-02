import { notFound } from "next/navigation";

// Each unknown address of the studio app shows `../not-found.tsx` (#360). The proxy sends Nina to the login first.
export default function StudioUnknownPage() {
  notFound();
}
