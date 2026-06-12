import Link from 'next/link';
import { signOutAction } from '@/actions/auth';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <Link href="/patients" className="font-semibold text-emerald-800">
            Pawar Yoga Therapy / रुग्ण व्यवस्थापन
          </Link>
          <form action={signOutAction}>
            <button className="text-sm text-stone-500 hover:text-stone-800">Sign out / बाहेर पडा</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
