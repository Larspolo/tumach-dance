import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  // The photo page sends one photo per request (#173): the limit of `MAX_PHOTO_BYTES` (15 MB) and the form fields.
  experimental: { serverActions: { bodySizeLimit: "16mb" }, proxyClientMaxBodySize: "16mb" },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
