import { signUpAction } from '@/actions/auth';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = getTranslations(await getLocale());
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>{t.auth.registerTitle}</CardTitle>
          <CardDescription>{t.auth.registerSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t.auth.registrationFailed}
            </p>
          )}
          <form action={signUpAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>
            <SubmitButton className="w-full" pendingLabel={`${t.auth.registerBtn}...`}>
              {t.auth.registerBtn}
            </SubmitButton>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {t.auth.alreadyHaveAccount}{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t.auth.signIn}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
