export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}
