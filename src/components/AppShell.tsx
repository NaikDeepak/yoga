'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { StopwatchWidget } from '@/components/StopwatchWidget';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';

import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  userEmail: string | null;
  patientCount: number;
  locale: Locale;
}

export function AppShell({ children, userEmail, patientCount, locale }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <LocaleProvider locale={locale}>
      {/* print: variants undo the fixed-height scroll shell so the full page flows across print pages */}
      <div className="flex h-screen w-full overflow-hidden bg-muted/20 print:h-auto print:overflow-visible print:bg-white">
        <aside className="hidden lg:block w-64 shrink-0 shadow-sm z-30 print:hidden">
          <Sidebar patientCount={patientCount} />
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden print:hidden",
            {
              "translate-x-0": isSidebarOpen,
              "-translate-x-full": !isSidebarOpen,
            }
          )}
        >
          <Sidebar patientCount={patientCount} onClose={() => setIsSidebarOpen(false)} />
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden relative print:overflow-visible">
          <TopNav
            userEmail={userEmail}
            locale={locale}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0">
            <div className="mx-auto w-full max-w-6xl print:max-w-none">
              {children}
            </div>
          </main>
        </div>

        <StopwatchWidget />
      </div>
    </LocaleProvider>
  );
}
