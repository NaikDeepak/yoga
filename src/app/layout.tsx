import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pawar Yoga Therapy' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
