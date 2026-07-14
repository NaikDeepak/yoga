'use client';

import { useTransition } from 'react';
import { Menu } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { saveLanguageAction } from '@/actions/preferences';
import type { Locale } from '@/lib/i18n/translations';

interface TopNavProps {
  userEmail: string | null;
  locale: Locale;
  onMenuClick?: () => void;
}

// "dr.pawar@example.com" → "Dr Pawar" — best-effort display name from the login email.
function displayNameFromEmail(email: string | null): string {
  if (!email) return 'Admin';
  const words = email
    .split('@')[0]
    .split(/[._\-\d]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(' ') : 'Admin';
}

export function TopNav({ userEmail, locale, onMenuClick }: TopNavProps) {
  const [isPending, startTransition] = useTransition();

  const switchLanguage = (nextLocale: Locale) => {
    if (nextLocale === locale || isPending) return;
    startTransition(async () => {
      await saveLanguageAction(nextLocale);
    });
  };
  const displayName = displayNameFromEmail(userEmail);
  const initials = userEmail
    ? userEmail.split('@')[0].substring(0, 2).toUpperCase()
    : 'PY';

  return (
    <header className="sticky top-0 z-20 flex h-20 w-full items-center justify-between gap-4 bg-background px-4 lg:px-8 border-b border-border/50 print:hidden">
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search is hidden on very small screens, shown as full bar on md+ */}
        <div className="flex-1 hidden md:block">
          <GlobalSearch size="lg" className="w-full" />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Mobile Search Icon - expands search or navigates */}
        <div className="md:hidden">
          <GlobalSearch size="default" className="w-48 sm:w-64" />
        </div>

        {/* Segmented language switch: current locale highlighted, tap the other to switch */}
        <div
          role="group"
          aria-label="Language / भाषा"
          className={cn(
            'flex items-center rounded-full border border-border/60 bg-background p-0.5 shadow-sm',
            isPending && 'opacity-75',
          )}
        >
          {([['en', 'EN'], ['mr', 'मराठी']] as const).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => switchLanguage(code)}
              disabled={isPending}
              aria-pressed={locale === code}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                locale === code
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-8 w-px bg-border mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src="" alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col text-sm">
            <span className="font-semibold text-foreground leading-none mb-1">{displayName}</span>
            <span className="text-xs text-muted-foreground leading-none truncate max-w-[120px]">
              {userEmail}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
