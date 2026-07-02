import { getLocale } from '@/lib/i18n/server';
import { getTranslations, LOCALES } from '@/lib/i18n/translations';
import { saveLanguageAction, saveWhatsappNumberAction } from '@/actions/preferences';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineForm } from '@/components/InlineForm';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { getWhatsappNumber } from '@/data/preferences';
import { CLINIC } from '@/lib/clinic';

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const user = await requireUser();
  const whatsappNumber = await getWhatsappNumber(getDb(), user.id);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <Card className="rounded-2xl shadow-sm border-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t.settings.languageTitle}</CardTitle>
          <CardDescription>{t.settings.languageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              'use server';
              const selected = formData.get('locale') as string;
              if ((LOCALES as readonly string[]).includes(selected)) {
                await saveLanguageAction(selected as typeof LOCALES[number]);
              }
            }}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3">
              {LOCALES.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-3 cursor-pointer rounded-xl border border-border p-4 hover:bg-accent/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="locale"
                    value={loc}
                    defaultChecked={loc === locale}
                    className="accent-primary h-4 w-4"
                  />
                  <span className="font-medium text-sm">{t.settings.languages[loc]}</span>
                </label>
              ))}
            </div>
            <Button type="submit" className="rounded-full px-6 w-full sm:w-auto">
              {t.settings.saveBtn}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t.settings.whatsappTitle}</CardTitle>
          <CardDescription>{t.settings.whatsappDescription.replace('{phone}', CLINIC.phone)}</CardDescription>
        </CardHeader>
        <CardContent>
          <InlineForm action={saveWhatsappNumberAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">{t.form.mobile}</Label>
              <Input
                id="whatsappNumber"
                name="whatsappNumber"
                inputMode="numeric"
                maxLength={10}
                placeholder={t.form.mobilePlaceholder}
                defaultValue={whatsappNumber ?? ''}
              />
            </div>
            <Button type="submit" className="rounded-full px-6 w-full sm:w-auto">
              {t.settings.saveBtn}
            </Button>
          </InlineForm>
        </CardContent>
      </Card>
    </div>
  );
}
