'use client';

import { Menu, Mail, Bell } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TopNavProps {
  userEmail: string | null;
  onMenuClick?: () => void;
}

export function TopNav({ userEmail, onMenuClick }: TopNavProps) {
  // Extract initials for the avatar
  const initials = userEmail
    ? userEmail.split('@')[0].substring(0, 2).toUpperCase()
    : 'PY';

  return (
    <header className="sticky top-0 z-20 flex h-20 w-full items-center justify-between gap-4 bg-background px-4 lg:px-8 border-b border-border/50">
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

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground relative" aria-label="Mail">
          <Mail className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background"></span>
        </Button>

        <div className="h-8 w-px bg-border mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src="" alt="Dr. Pawar" />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col text-sm">
            <span className="font-semibold text-foreground leading-none mb-1">Dr. Pawar</span>
            <span className="text-xs text-muted-foreground leading-none truncate max-w-[120px]">
              {userEmail}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
