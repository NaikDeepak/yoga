import { signUpAction } from '@/actions/auth';
import Link from 'next/link';

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Pawar Yoga Therapy</h1>
      <p className="mb-6 text-sm text-stone-500">Admin Register / नवीन नोंदणी</p>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <form action={signUpAction} className="space-y-4">
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
          Register / नोंदणी करा
        </button>
      </form>
      <div className="mt-4 text-center text-sm text-stone-500">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-700 hover:underline">
          Sign in / लॉगिन
        </Link>
      </div>
    </main>
  );
}
