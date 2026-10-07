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
    background_color: clinicProfile.brand.background,
    theme_color: clinicProfile.brand.themeColor,
    icons: [
      { src: clinicProfile.icons.icon192, sizes: '192x192', type: 'image/png' },
      { src: clinicProfile.icons.icon512, sizes: '512x512', type: 'image/png' },
      {
        src: clinicProfile.icons.maskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
