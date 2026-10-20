import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// /e and /g stay crawlable on purpose: they carry noindex, and a blocked page
// can't show Google that tag, so a link posted somewhere could still list.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
