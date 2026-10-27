// reset-password logic: sets a login's password via Neon's emailed reset link, with no admin session and
// sign-up left off (first-admin bootstrap). Talks straight to NEON_AUTH_BASE_URL. Better Auth
// (better-auth/dist/api/routes/password.mjs):
//   POST request-password-reset { email, redirectTo } -> emails `{base}/reset-password/<token>?callbackURL=<redirectTo>`
//     (clicking it redirects to `<redirectTo>?token=<token>`; both forms are accepted here)
//   POST reset-password { newPassword, token }
// Never prints the link, token or password; errors carry status + code only.
import { newPasswordProblem, parseClinicArgs } from './cli';
import { errorCode } from './http';
import { AdminApiError, type CreateLoginMainDeps } from './neon-admin';

const TOKEN = /^[A-Za-z0-9_-]{1,256}$/;
const BAD_LINK = 'that is not a Neon password-reset link (expected …/reset-password/<token> or …?token=<token>)';

export function extractResetToken(pasted: string): string {
  let url: URL;
  try {
    url = new URL(pasted.trim());
  } catch {
    throw new Error(BAD_LINK);
  }
  const fromPath = url.pathname.match(/\/reset-password\/([^/]+)\/?$/)?.[1];
  let token: string | null;
  try {
    token = fromPath !== undefined ? decodeURIComponent(fromPath) : url.searchParams.get('token');
  } catch {
    throw new Error(BAD_LINK); // malformed %-escape
  }
  if (!token || !TOKEN.test(token)) throw new Error(BAD_LINK);
  return token;
}

export type ResetPasswordMainDeps = CreateLoginMainDeps;

export async function resetPasswordMain(d: ResetPasswordMainDeps): Promise<number> {
  try {
    const args = parseClinicArgs(d.argv);
    const config = d.readConfig(args.clinic);
    const base = config.authBaseUrl.replace(/\/+$/, '');
    const post = async (step: string, path: string, body: unknown) => {
      const res = await d.fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { origin: config.siteUrl, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'manual',
      });
      if (res.status !== 200) throw new AdminApiError(step, res.status, await errorCode(res));
    };

    await post('request-password-reset', 'request-password-reset', { email: args.email, redirectTo: `${config.siteUrl}/login` });
    d.out(`Reset email sent to ${args.email} (from Neon). Open it, copy the link, paste it below.`);
    const token = extractResetToken(await d.ask('Paste the link from the email: '));
    const newPassword = await d.ask(`New password for ${args.email}: `);
    const problem = newPasswordProblem(newPassword, await d.ask('New password again: '));
    if (problem) throw new Error(problem);
    await post('reset-password', 'reset-password', { newPassword, token });
    d.out(`password set for ${args.email}`);
    return 0;
  } catch (e) {
    d.err(`reset-password: ${(e as Error).message}`);
    return 1;
  }
}
