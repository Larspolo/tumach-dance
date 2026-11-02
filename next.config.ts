import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { contentSecurityPolicy } from "./src/lib/csp";

const nextConfig: NextConfig = {
  output: "standalone",
  // The photo page sends one photo per request (#173): the limit of `MAX_PHOTO_BYTES` (15 MB) and the form fields.
  // inlineCss: the CSS (about 6 KB) is in the HTML, so the browser waits for no CSS file before the first text (#453).
  experimental: { serverActions: { bodySizeLimit: "16mb" }, proxyClientMaxBodySize: "16mb", inlineCss: true },
  // The basic security headers on each response (#490): no frame of the site on another site, only HTTPS.
  // The Content-Security-Policy with no nonce (#491): `src/proxy.ts` replaces it with one with a nonce on each page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(undefined, process.env.NODE_ENV === "development"),
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
