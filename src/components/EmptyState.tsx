import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  message: string;
  action?: { label: string; href: string };
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button asChild className="mt-4 rounded-full gap-2 px-5 h-10 shadow-md">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
