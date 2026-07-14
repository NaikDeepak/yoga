import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Styled native <select> for server-rendered forms where the Radix Select's
 * client-side state isn't needed. Matches the Input/Select trigger look.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
