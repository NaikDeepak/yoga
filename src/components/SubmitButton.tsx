'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

interface SubmitButtonProps extends Omit<ComponentProps<typeof Button>, 'type'> {
  pendingLabel?: string;
}

// Must be rendered inside a <form>: useFormStatus only reports the enclosing
// form's submission, and returns { pending: false } forever when there is none.

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className={className}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{pendingLabel || children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
