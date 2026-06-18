import './globals.css';
import type { Metadata } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });

export const metadata: Metadata = { title: "Pawar's Yog Therapy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansDevanagari.variable}`}>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
