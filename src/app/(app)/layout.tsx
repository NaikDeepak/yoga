import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { signOutAction } from '@/actions/auth';
import { requireUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/patients" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold">Pawar Yoga Therapy</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out / बाहेर पडा
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
