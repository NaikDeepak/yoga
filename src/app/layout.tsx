import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { clinicName } from '@/clinics';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });

export const metadata: Metadata = { title: clinicName('en', true) };

export const viewport: Viewport = { themeColor: '#3B6954' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansDevanagari.variable}`}>
      <body className="min-h-screen bg-background text-foreground">
        <NextTopLoader color="var(--primary)" showSpinner={false} height={3} />
        {children}
      </body>
    </html>
  );
}
