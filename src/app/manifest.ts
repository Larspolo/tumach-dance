import type { MetadataRoute } from "next";

// The studio app of Nina, installable with "Add to Home Screen". Colors: --paper and --ink of the site.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TUMACH studio",
    short_name: "TUMACH studio",
    start_url: "/studio",
    scope: "/studio",
    display: "standalone",
    background_color: "#f4efe6",
    theme_color: "#141210",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
