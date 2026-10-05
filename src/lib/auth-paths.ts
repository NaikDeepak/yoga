export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/s/') || // client share links (token-checked by the page)
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}
