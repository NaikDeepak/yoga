'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ErrorScreen';

// Any page that throws lands here. The raw message is never shown: it may contain client data.
// In production Next replaces it with a digest that matches the server log line.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('page error', error.digest ?? '');
  }, [error]);
  return <ErrorScreen kind="error" digest={error.digest} onRetry={reset} />;
}
