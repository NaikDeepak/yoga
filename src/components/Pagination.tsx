import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1">
      {page === 1 ? (
        <Button variant="outline" size="sm" className="rounded-full" disabled>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={buildHref(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
      )}

      {pageNumbers(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground select-none">
            …
          </span>
        ) : n === page ? (
          <Button key={n} size="sm" className="rounded-full h-8 w-8 p-0">
            {n}
          </Button>
        ) : (
          <Button key={n} variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" asChild>
            <Link href={buildHref(n)}>{n}</Link>
          </Button>
        )
      )}

      {page === totalPages ? (
        <Button variant="outline" size="sm" className="rounded-full" disabled>
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={buildHref(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
