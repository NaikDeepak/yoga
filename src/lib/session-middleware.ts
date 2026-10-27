import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/auth-paths';
import { MOCK_SESSION_COOKIE } from '@/lib/local-mock';
import { loginProvider } from '@/lib/login-provider';
import { safeErrorMessage } from '@/lib/log';

// The SDK's NEON_AUTH_SESSION_COOKIE_NAME (a test pins it). Kept here so the proxy loads the SDK
// only when there is a session to check.
export const NEON_SESSION_COOKIE = '__Secure-neon-auth.session_token';

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  // API routes check the session themselves and must answer 401 JSON, not a
  // 307 to /login (applies to every provider).
  const isApiPath = request.nextUrl.pathname.startsWith('/api/');
  // Outside any try: a missing LOGIN_PROVIDER in production must fail loudly, not redirect.
  const provider = loginProvider();

  if (provider === 'neon') return neonSession(request, isApiPath);

  if (provider === 'mock') {
    const hasSession = request.cookies.has(MOCK_SESSION_COOKIE);
    const { pathname } = request.nextUrl;
    if (!hasSession && !isApiPath && !isPublicPath(pathname)) {
      return redirectTo(request, '/login');
    }
    if (hasSession && pathname === '/login') {
      return redirectTo(request, '/dashboard');
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();

  // If user is not logged in and path is not public, redirect to login
  if (!user && !isApiPath && !isPublicPath(request.nextUrl.pathname)) {
    const redirectResponse = redirectTo(request, '/login');
    // Copy cookies to ensure session changes (like clearing session) are persisted
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // If user is logged in and visits login, redirect to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    const redirectResponse = redirectTo(request, '/dashboard');
    // Copy cookies to ensure the logged-in session cookie is passed along
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return response;
}

// The SDK's own middleware is not handed the whole app: it would also guard /s/…, /api/* and the
// manifest, and it waves its login page through without looking at the session. So:
// - /api/* and public paths: never checked here (API routes answer their own 401).
// - protected pages: the SDK middleware. It may answer from its 5-minute signed cookie copy, which
//   is fine because requireUser re-reads uncached on the page; it refreshes cookies on the response.
// - /login: an uncached read. A cached "yes" for a revoked session would bounce /login → /dashboard
//   → requireUser → /login for up to 5 minutes.
// No session cookie (including requests that carry only old Supabase sb-* cookies) never reaches
// the auth service.
async function neonSession(request: NextRequest, isApiPath: boolean): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';
  if (isApiPath || (isPublicPath(pathname) && !isLogin)) return NextResponse.next({ request });

  if (!request.cookies.has(NEON_SESSION_COOKIE)) {
    return isLogin ? NextResponse.next({ request }) : redirectTo(request, '/login');
  }

  try {
    const neon = await import('@/lib/neon-auth');
    if (!isLogin) return await neon.getNeonAuth().middleware({ loginUrl: '/login' })(request);

    const { user, cookies } = await neon.readNeonSessionFromRequest(request);
    const response = user ? redirectTo(request, '/dashboard') : NextResponse.next({ request });
    for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
    return response;
  } catch (err) {
    // The message only: never the request or its cookies.
    console.error('[proxy] Neon session check failed:', safeErrorMessage(err));
    // Fail closed for pages; /login stays put (a redirect to itself would loop).
    return isLogin ? NextResponse.next({ request }) : redirectTo(request, '/login');
  }
}
