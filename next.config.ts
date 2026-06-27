import type { NextConfig } from "next";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.openfreemap.org https://*.openstreetmap.org;
  connect-src 'self' https://*.openfreemap.org https://tiles.openfreemap.org https://api.open-meteo.com https://portail-api.meteofrance.fr https://overpass-api.de https://lz4.overpass-api.de https://www.reddit.com https://oauth.reddit.com;
  worker-src 'self' blob:;
  font-src 'self';
`.replace(/\n/g, " ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
