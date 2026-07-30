import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the file-tracing root to this project. Without it Next may infer a
  // parent directory as the workspace root when other lockfiles exist higher up.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Keep server-only heavy deps external to the bundle.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
