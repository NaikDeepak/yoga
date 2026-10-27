// npm run login-smoke -- --clinic <slug> --email <test login> [--site <url>]
// Seven sign-in/sign-out/404/401 checks against the clinic site (SITE_URL, or --site for a preview URL).
// Asks (hidden) for the test login's password. Prints PASS/FAIL per check; exits 1 on any FAIL.
import { readClinicLoginConfig } from './login-config';
import { askHidden } from './prompt';
import { loginSmokeMain } from './smoke';

loginSmokeMain({
  argv: process.argv.slice(2),
  readConfig: (slug) => readClinicLoginConfig(slug),
  ask: askHidden,
  fetch,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => { process.exitCode = code; });
