import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pawar Yoga Therapy',
    short_name: 'PYT',
    description: 'Patient management for Pawar Yoga Therapy',
    start_url: '/',
    display: 'standalone',
    background_color: '#F9F6F0',
    theme_color: '#3B6954',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
