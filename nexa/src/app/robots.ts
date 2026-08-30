import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Everything past /login and /register sits behind auth, so there's nothing
 * for a crawler to index there anyway — disallowing it avoids wasted crawl
 * budget and keeps auth-walled fragments out of search results entirely.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/register"],
      disallow: ["/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
