import type { ClinicProfile } from './types';

export const pawar: ClinicProfile = {
  slug: 'pawar',
  name: {
    en: "Pawar's Yog Therapy Center",
    mr: 'पवार योग थेरपी सेंटर',
  },
  shortName: {
    en: "Pawar's Yog Therapy",
    mr: 'पवार योग थेरपी',
  },
  tagline: 'LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS',
  logo: {
    src: '/clinics/pawar/logo.png',
    alt: 'PYTC',
  },
  icons: {
    icon192: '/clinics/pawar/icons/icon-192.png',
    icon512: '/clinics/pawar/icons/icon-512.png',
    maskable512: '/clinics/pawar/icons/icon-512-maskable.png',
  },
  brand: {
    primary: '#1B3A2E',
    accent: '#C8962E',
    cream: '#FDF8F0',
    themeColor: '#3B6954',
    background: '#F9F6F0',
  },
  contact: {
    phone: '+91 85509 21037',
    whatsappDigits: '918550921037',
    email: 'pawarsyog@gmail.com',
    hours: 'Mon–Sat, 6:00 AM – 8:00 PM',
  },
  signature: {
    name: 'Aachary Narayan Pawar',
    lines: [
      'Founder & Director of PYTC | Chief Medical Yoga Expert',
      "Pawar's Yog Therapy Center",
    ],
    wishSignOff: {
      en: "Acharya Narayan Pawar\nPawar's Yog Therapy Center",
      mr: "आचार्य नारायण पवार\nPawar's Yog Therapy Center",
    },
  },
  branches: [
    {
      key: 'Manjari BK',
      label: 'Manjari BK',
      fullAddress:
        'Shop No 8, Greenoak Society, Cement Road, near Mhasoba Mandir, Manjari Budruk, Pune, Maharashtra 412307',
    },
    {
      key: 'Kharadi',
      label: 'Kharadi',
      fullAddress:
        'Survey no. 24/2B, Opposite of Konark Eureka, Sainath Nagar, Kharadi, Pune, Maharashtra 411014',
    },
    {
      key: 'Morgaon',
      label: 'Morgaon',
      fullAddress: 'Morgaon Pawarwadi, Tal-Dodamarg, Sindhudurg - 416511',
    },
  ],
  patientCodePrefix: 'PYT',
  appName: 'Pawar Yoga Therapy',
  features: {
    posture: true,
    flexibility: true,
    ai: true,
    shareLinks: true,
    checkins: true,
  },
};
