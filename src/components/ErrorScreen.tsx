import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';
import { clinicProfile } from '@/clinics';

type Kind = 'error' | 'notFound';

/**
 * Full-page message in both languages. Error pages can render outside the locale provider
 * (and global-error even replaces the root layout), so this never depends on context.
 */
export function ErrorScreen({ kind, digest, onRetry }: { kind: Kind; digest?: string; onRetry?: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
      <img src={clinicProfile.logo.src} alt="" className="mx-auto h-14 w-14" referrerPolicy="no-referrer" />
      {[en, mr].map(({ errors: t }) => (
        <div key={t.retry} className="space-y-1">
          <h1 className="text-xl font-bold">{kind === 'error' ? t.errorTitle : t.notFoundTitle}</h1>
          <p className="text-muted-foreground">{kind === 'error' ? t.errorBody : t.notFoundBody}</p>
        </div>
      ))}
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
            {en.errors.retry} / {mr.errors.retry}
          </button>
        )}
        <a href="/dashboard" className="rounded-md border px-4 py-2 font-medium">
          {en.errors.home} / {mr.errors.home}
        </a>
      </div>
      {digest && (
        <p className="text-xs text-muted-foreground">
          {en.errors.reference} / {mr.errors.reference}: <code>{digest}</code>
        </p>
      )}
    </main>
  );
}
