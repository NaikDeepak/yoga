import { signUpAction } from '@/actions/auth';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>Pawar&apos;s Yog Therapy</CardTitle>
          <CardDescription>Admin Register / नवीन नोंदणी</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Registration failed. Please try again. / नोंदणी अयशस्वी. कृपया पुन्हा प्रयत्न करा.
            </p>
          )}
          <form action={signUpAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email / ईमेल</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password / पासवर्ड</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full">Register / नोंदणी करा</Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in / लॉगिन
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
