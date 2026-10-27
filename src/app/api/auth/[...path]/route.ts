import { isAllowedAuthRoute } from '@/lib/auth-routes';
import { loginProvider } from '@/lib/login-provider';

// Neon login only (LOGIN_PROVIDER=neon), allowlisted paths only (src/lib/auth-routes.ts).
// Everything else, every method, answers 404, so nothing falls through to Next's default 405.
type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new Response('Not found', { status: 404 });

function forward(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const { path } = await ctx.params;
    // Next sends HEAD to the GET export; check the method actually forwarded, not the export's name.
    if (req.method !== method) return notFound();
    if (loginProvider() !== 'neon' || !isAllowedAuthRoute(method, path)) return notFound();
    // Lazy: the SDK is only loaded (and its env required) when Neon login is on.
    const { getNeonAuth } = await import('@/lib/neon-auth');
    return getNeonAuth().handler()[method](req, ctx);
  };
}

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const PATCH = forward('PATCH');
export const DELETE = forward('DELETE');
