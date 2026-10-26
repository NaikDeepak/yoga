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
    // Darkened from #C8962E (2026-10-24, Deepak): white initials on it and gold print were too faint (2.7:1).
    accent: '#AA8027',
    accentText: '#8C6920',
    cream: '#FDF8F0',
    themeColor: '#3B6954',
    background: '#F9F6F0',
  },
  // Converted from the former globals.css oklch values (kept there as fallbacks).
  theme: {
    primary: '#376B39', // oklch(0.478 0.096 145)
    primaryForeground: '#FFFFFF', // oklch(1 0 0)
    ring: '#376B39', // oklch(0.478 0.096 145)
    background: '#FAF7F2', // oklch(0.977 0.007 75)
    foreground: '#241809', // oklch(0.220 0.032 68)
    accent: '#C67036', // oklch(0.632 0.130 52)
    accentText: '#A14F09', // oklch(0.52 0.13 52)
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
  practice: {
    type: 'yoga',
    treatmentSections: ['yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma'],
    feeTypes: [
      { key: 'consultation', defaultAmount: 500 },
      { key: 'monthly_yoga', defaultAmount: 3000 },
      { key: 'package', defaultAmount: null },
      { key: 'other', defaultAmount: null },
    ],
  },
  features: {
    posture: true,
    flexibility: true,
    ai: true,
    shareLinks: true,
    checkins: true,
    fees: true,
  },
};
