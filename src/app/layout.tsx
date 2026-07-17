import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });

export const metadata: Metadata = { title: "Pawar's Yog Therapy" };

export const viewport: Viewport = { themeColor: '#F9F6F0' };

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
