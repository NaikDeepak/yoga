import type { MetadataRoute } from 'next';
import { clinicName, clinicProfile } from '@/clinics';

export default function manifest(): MetadataRoute.Manifest {
  const name = clinicProfile.appName ?? clinicName('en');
  return {
    name,
    short_name: clinicProfile.patientCodePrefix,
    description: `Patient management for ${name}`,
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
