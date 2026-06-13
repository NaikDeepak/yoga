import { signInAction } from '@/actions/auth';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; registered?: string }> }) {
  const { error, registered } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>Pawar Yoga Therapy</CardTitle>
          <CardDescription>Admin Login / प्रवेश</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Wrong email or password / चुकीचा ईमेल किंवा पासवर्ड
            </p>
          )}
          {registered === '1' && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              Account registered! Please sign in. / खाते नोंदणीकृत झाले!
            </p>
          )}
          <form action={signInAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email / ईमेल</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password / पासवर्ड</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full">Sign in / लॉगिन</Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Register / नोंदणी करा
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
