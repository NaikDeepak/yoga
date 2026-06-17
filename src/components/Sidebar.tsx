'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart,
  Settings,
  HelpCircle,
  LogOut,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n/context';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
  patientCount?: number;
}

export function Sidebar({ className, onClose, patientCount }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();

  type MenuItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; badge?: number };
  const menuItems: MenuItem[] = [
    { name: t.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
    { name: t.nav.patients, href: '/patients', icon: Users, badge: patientCount },
    { name: t.nav.calendar, href: '#', icon: Calendar, disabled: true },
    { name: t.nav.analytics, href: '#', icon: BarChart, disabled: true },
  ];

  const generalItems = [
    { name: t.nav.settings, href: '/settings', icon: Settings },
    { name: t.nav.help, href: '#', icon: HelpCircle, disabled: true },
  ];

  return (
    <div className={cn('flex h-full w-full flex-col bg-card border-r border-border', className)}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-transparent">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pytc-logo.png" alt="PYTC" width={32} height={32} className="object-contain" />
          <span className="text-lg font-bold tracking-tight">Pawar&apos;s Yog Therapy</span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 no-scrollbar">
        {/* Menu Section */}
        <div>
          <h3 className="mb-3 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Menu
          </h3>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.href) && item.href !== '#';
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    item.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                  {item.name}
                  {item.badge !== undefined && !item.disabled && (
                    <span className="ml-auto min-w-[20px] text-center text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                  {item.disabled && <span className="ml-auto text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t.common.soon}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* General Section */}
        <div>
          <h3 className="mb-3 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            General
          </h3>
          <nav className="space-y-1">
            {generalItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/50 hover:text-foreground',
                    item.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                  )}
                >
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                  {item.name}
                  {item.disabled && <span className="ml-auto text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t.common.soon}</span>}
                </Link>
              );
            })}

            {/* Logout Action */}
            <form action={signOutAction} className="w-full">
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-5 w-5 text-muted-foreground group-hover:text-destructive" />
                {t.nav.logout}
              </button>
            </form>
          </nav>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="p-4 shrink-0">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-4 text-primary-foreground shadow-sm">
          <div className="relative z-10">
            <h4 className="font-semibold text-sm">{t.nav.needHelp}</h4>
            <p className="mt-1 text-xs text-primary-foreground/80 leading-relaxed">
              {t.nav.needHelpBody}
            </p>
            <Button variant="secondary" size="sm" className="mt-4 w-full text-xs font-medium bg-white text-primary hover:bg-white/90">
              {t.nav.contactSupport}
            </Button>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-black/10 blur-xl" />
        </div>
      </div>
    </div>
  );
}
