import type { MetadataRoute } from 'next';

// Allow everything on purpose. Share links send `X-Robots-Tag: noindex` (next.config.ts), and a crawler only sees that
// if robots.txt lets it fetch the page — a disallowed URL can still be listed in search results from a link alone.
// Signed-in pages redirect crawlers to /login anyway.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' } };
}
