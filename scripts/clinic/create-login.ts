// npm run create-login -- --clinic <slug> --email <staff email> [--reset]
// Creates a staff login (or resets its password) on the clinic's Neon Auth, signed in as the clinic admin.
// Settings: ~/.config/clinics/<slug>.env (chmod 600). Passwords are asked (hidden), never printed.
import { readClinicLoginConfig } from './login-config';
import { createLoginMain } from './neon-admin';
import { askHidden } from './prompt';

createLoginMain({
  argv: process.argv.slice(2),
  readConfig: (slug) => readClinicLoginConfig(slug),
  ask: askHidden,
  fetch,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => { process.exitCode = code; });
