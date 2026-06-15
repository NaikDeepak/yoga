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
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-80">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Pawar&apos;s Yog Therapy</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Dashboard / डॅशबोर्ड
              </Link>
              <Link
                href="/patients"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Patients / रुग्ण
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user.email && (
              <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            )}
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
