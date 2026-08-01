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
};

export default nextConfig;
