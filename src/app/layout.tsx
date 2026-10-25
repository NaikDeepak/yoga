import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { clinicName, clinicProfile } from '@/clinics';
import { themeCss } from '@/clinics/theme-css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });

export const metadata: Metadata = {
  title: clinicName('en', true),
  description: `Patient management for ${clinicProfile.appName ?? clinicName('en')}`,
  // Without an icon link browsers ask for /favicon.ico, which doesn't exist (a 404 on every first visit).
  icons: { icon: clinicProfile.icons.icon192, apple: clinicProfile.icons.icon192 },
};

export const viewport: Viewport = { themeColor: clinicProfile.brand.themeColor };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansDevanagari.variable}`}>
      <head>
        {/* Values are schema-checked hex, so nothing user-controlled reaches the stylesheet. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(clinicProfile.theme) }} />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <NextTopLoader color="var(--primary)" showSpinner={false} height={3} />
        {children}
      </body>
    </html>
  );
}
