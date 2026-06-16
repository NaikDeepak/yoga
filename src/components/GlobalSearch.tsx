'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchResult = {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
};

interface GlobalSearchProps {
  className?: string;
  size?: 'default' | 'lg';
}

export function GlobalSearch({ className, size = 'default' }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([]);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goTo(id: string) {
    setOpen(false);
    setQuery('');
    router.push(`/patients/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goTo(results[highlight].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const isLg = size === 'lg';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          isLg ? 'left-5 h-5 w-5 text-muted-foreground/70' : 'left-3 h-4 w-4'
        )}
        aria-hidden="true"
      />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search for a patient / रुग्णाचा शोध घ्या..."
        className={cn(
          isLg 
            ? 'h-14 rounded-full pl-12 pr-6 text-base shadow-sm border border-border bg-background focus-visible:shadow-md focus-visible:ring-0 hover:shadow-md transition-shadow md:text-lg' 
            : 'pl-9'
        )}
      />
      {open && (
        <div
          className={cn(
            'absolute left-0 right-0 z-20 rounded-2xl border border-border bg-card shadow-lg overflow-hidden',
            isLg ? 'mt-3' : 'mt-1 rounded-md'
          )}
        >
          {results.length === 0 ? (
            <div className={cn('text-muted-foreground', isLg ? 'px-5 py-4 text-base' : 'px-3 py-2 text-sm')}>
              No matches / जुळणारे नाही
            </div>
          ) : (
            <ul className={cn('py-2', !isLg && 'py-1')}>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => goTo(r.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 text-left transition-colors',
                      isLg ? 'px-5 py-3' : 'px-3 py-2 text-sm',
                      i === highlight ? 'bg-accent/70' : 'hover:bg-accent/50'
                    )}
                  >
                    <span className={cn('font-medium', isLg ? 'text-base' : '')}>{r.fullName}</span>
                    <span className={cn('text-muted-foreground', isLg ? 'text-sm' : 'text-xs')}>
                      {r.patientCode} · {r.mobile}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
