import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the file-tracing root to this project. Without it Next may infer a
  // parent directory as the workspace root when other lockfiles exist higher up.
  outputFileTracingRoot: path.join(__dirname),
  // Keep Prisma out of the bundle so its native query-engine binary is loaded
  // from node_modules at runtime (fixes "engine not found" on Vercel serverless).
  serverExternalPackages: ["@prisma/client", "@prisma/engines", "prisma"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Basic hardening for every response. Other sites cannot put this app in a frame (clickjacking on the approve buttons);
  // our own pages still can. The camera and location stay allowed for this site, which check-in needs. No full
  // Content-Security-Policy here on purpose: the app relies on inline scripts and map tiles, so one would need testing page by page.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
