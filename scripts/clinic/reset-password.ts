// npm run reset-password -- --clinic <slug> --email <email>
// Sets a login's password through Neon's reset email: no admin session, sign-up stays off. For the
// clinic's first admin (Neon's CLI creates users without a password). Settings: ~/.config/clinics/<slug>.env.
import { readClinicLoginConfig } from './login-config';
import { resetPasswordMain } from './password-reset';
import { askHidden } from './prompt';

resetPasswordMain({
  argv: process.argv.slice(2),
  readConfig: (slug) => readClinicLoginConfig(slug),
  ask: askHidden,
  fetch,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => { process.exitCode = code; });
