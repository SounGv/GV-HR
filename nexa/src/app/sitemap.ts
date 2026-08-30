import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/login`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
