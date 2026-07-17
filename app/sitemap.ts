import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getFinishedMatches } from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/results`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/roadmap`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Add every finished match. If the DB is offline the sitemap still ships the
  // static routes rather than failing the whole render.
  let matchRoutes: MetadataRoute.Sitemap = [];
  try {
    const finished = await getFinishedMatches();
    matchRoutes = finished.map((f) => ({
      url: `${SITE_URL}/match/${f.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // ignore — degrade to static routes only
  }

  return [...staticRoutes, ...matchRoutes];
}
