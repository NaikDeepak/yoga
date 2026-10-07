import { ErrorScreen } from '@/components/ErrorScreen';

// Unknown URLs and notFound() anywhere in the app (share links keep their own page in s/[token]).
export default function NotFound() {
  return <ErrorScreen kind="notFound" />;
}
