import Image from 'next/image';
import { CLINIC } from '@/lib/clinic';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';
import { clinicProfile } from '@/clinics';

// Same page for unknown, expired and revoked links, in both languages (no way to know which the client reads).
export default function SharedLinkNotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
      <Image src={clinicProfile.logo.src} alt="" width={56} height={56} className="mx-auto h-14 w-14 object-contain" referrerPolicy="no-referrer" />
      {[en, mr].map(({ sharedPage: t }) => (
        <div key={t.expiredTitle}>
          <h1 className="text-xl font-bold">{t.expiredTitle}</h1>
          <p className="text-muted-foreground">{t.expiredBody}</p>
        </div>
      ))}
      <a href={`tel:${CLINIC.phone.replace(/\s/g, '')}`} className="inline-block font-medium text-primary">{CLINIC.phone}</a>
    </main>
  );
}
