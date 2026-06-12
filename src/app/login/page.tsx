import { signInAction } from '@/actions/auth';
import Link from 'next/link';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; registered?: string }> }) {
  const { error, registered } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Pawar Yoga Therapy</h1>
      <p className="mb-6 text-sm text-stone-500">Admin Login / प्रवेश</p>
      
      {error && (
        <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">
          Wrong email or password / चुकीचा ईमेल किंवा पासवर्ड
        </p>
      )}

      {registered === '1' && (
        <p className="mb-4 rounded bg-emerald-50 p-2 text-sm text-emerald-700">
          Account registered successfully! Please sign in. / खाते यशस्वीरित्या नोंदणीकृत झाले! कृपया लॉग इन करा.
        </p>
      )}

      <form action={signInAction} className="space-y-4">
        <label className="block text-sm">
          Email / ईमेल
          <input name="email" type="email" required
            className="mt-1 w-full rounded border border-stone-300 p-2" />
        </label>
        <label className="block text-sm">
          Password / पासवर्ड
          <input name="password" type="password" required
            className="mt-1 w-full rounded border border-stone-300 p-2" />
        </label>
        <button className="w-full rounded bg-emerald-700 p-2 font-medium text-white hover:bg-emerald-800">
          Sign in / लॉगिन
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-stone-500">
        Don't have an account?{' '}
        <Link href="/register" className="text-emerald-700 hover:underline">
          Register / नोंदणी करा
        </Link>
      </div>
    </main>
  );
}

