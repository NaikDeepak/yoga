'use client';

import './globals.css';
import { ErrorScreen } from '@/components/ErrorScreen';

// Last resort when the root layout itself fails: must render its own <html> and <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <ErrorScreen kind="error" digest={error.digest} onRetry={reset} />
      </body>
    </html>
  );
}
