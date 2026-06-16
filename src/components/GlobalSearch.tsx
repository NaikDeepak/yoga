'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type SearchResult = {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
};

export function GlobalSearch() {
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

  return (
    <div ref={containerRef} className="relative w-full max-w-sm flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search patient / रुग्ण शोधा"
        className="pl-9"
      />
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-border bg-card shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches / जुळणारे नाही</div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => goTo(r.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      i === highlight ? 'bg-accent' : ''
                    }`}
                  >
                    <span className="font-medium">{r.fullName}</span>
                    <span className="text-xs text-muted-foreground">{r.patientCode} · {r.mobile}</span>
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
