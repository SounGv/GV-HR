import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";

const base = appBaseUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/login`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
