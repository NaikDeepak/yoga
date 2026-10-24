import type { MetadataRoute } from 'next';

// The app holds client health records and nothing in it is meant to be found by search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
