import { getLocale } from '@/lib/i18n/server';
import { getTranslations, LOCALES } from '@/lib/i18n/translations';
import { saveLanguageAction } from '@/actions/preferences';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getTranslations(locale);

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
            <Button type="submit" className="rounded-full px-6">
              {t.settings.saveBtn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
