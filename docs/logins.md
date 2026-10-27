# Logins: how to manage them

Each clinic's staff logins live in that clinic's own Neon database (Neon's managed login). Nobody can sign up
on the site. Deepak creates every login and resets every password, from the terminal on his Mac.

**Which clinics use this today**
- **Sunrise preview** (`sunrise-preview`): yes.
- **Pawar** (`pawar`): not yet. Pawar still logs in through Supabase until the switch-over. Until then, manage
  Pawar logins in the Supabase dashboard (Authentication → Users). After the switch-over, use the commands below
  with `--clinic pawar`.

Run every command in the `yoga` folder. Passwords are asked on screen, and nothing shows while you type. They
are never printed, saved, or sent anywhere except to Neon. Never paste a password or a key into a chat.

---

## One-time setup per clinic: the settings file

Each clinic has one settings file on the Mac: `~/.config/clinics/<clinic>.env`. Only you can read it
(`chmod 600`). Claude normally creates it. It holds no passwords:

```
NEON_AUTH_BASE_URL=<the clinic's Neon login address>
ADMIN_EMAIL=<the clinic admin's email (Deepak)>
SITE_URL=<the clinic's web address>
VERCEL_PROTECTION_BYPASS=<only for preview sites; used by the login check>
```

If a command says the file is missing or "too open", ask Claude, or run
`chmod 600 ~/.config/clinics/<clinic>.env`.

---

## Reset the admin password (Deepak's own login)

Use this when you forget your admin password, or want to change it. It needs no admin session, so it works
even when you're locked out.

```
npm run reset-password -- --clinic <clinic> --email <your admin email>
```

1. The command asks Neon to email you a reset link. Check spam too. The email can take a few minutes.
2. In the email, **right-click the link → Copy link**. Don't click it.
   - If you clicked it anyway, copy the full address from the browser's address bar instead.
3. Paste the link at the prompt. Nothing shows as you paste.
4. Type the new password twice, at least 8 characters.
5. You should see: `password set for <your email>`.

Example (Sunrise preview):

```
npm run reset-password -- --clinic sunrise-preview --email deep.naik@gmail.com
```

The same command works for a staff member who can get to their own email. But usually
[reset their password as admin](#reset-a-staff-members-password) instead: it's faster and needs no email.

---

## Create a new staff login

```
npm run create-login -- --clinic <clinic> --email <staff email>
```

1. Type **your admin password**.
2. Type the **new staff password** twice, at least 8 characters.
3. You should see: `created <staff email> id=<id>`.
4. Give the staff member their email and password in person or by phone. Don't send it by WhatsApp or email.
5. Ask them to sign in once on their phone while you're there.

Example:

```
npm run create-login -- --clinic sunrise-preview --email new.staff@example.com
```

If it says `USER_ALREADY_EXISTS`, the login is already there. Reset its password instead (below).

---

## Reset a staff member's password

```
npm run create-login -- --clinic <clinic> --email <staff email> --reset
```

1. Type **your admin password**.
2. Type the **new password** for the staff member, twice.
3. You should see: `password reset for <staff email>`.

The staff member can sign in with the new password straight away.

---

## Check that logins work (after any change to the site)

```
npm run login-smoke -- --clinic <clinic> --email <a test login>
```

It asks for the test login's password and prints 7 lines. All should say `PASS`. Any `FAIL` line names the check
and the status code. Send that line to Claude.

---

## Remove a login (someone leaves)

There is no command for this yet. Ask Claude to remove it. Claude deletes the user through Neon's API, and
that also signs them out everywhere. Until it's removed, you can lock the person out by resetting their password
(above) and not telling them the new one.

---

## Common messages

| Message | What it means | What to do |
|---|---|---|
| `INVALID_EMAIL_OR_PASSWORD` | Your admin password was wrong | Try again, or reset it (above) |
| `YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS` | The admin email in the settings file isn't an admin | Ask Claude |
| `no login found for <email>` | No login with that exact email | Check the spelling, or create it |
| `No input` | You pressed Ctrl-D, or closed the prompt | Run the command again |
| `INVALID_ORIGIN` | The site address isn't trusted by the clinic's Neon login | Ask Claude |
| The reset email never arrives | Neon's shared email is slow or blocked | Wait 10 minutes and check spam, then ask Claude |
