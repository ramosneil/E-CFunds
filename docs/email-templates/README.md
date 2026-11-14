# E-CFunds email templates (Supabase Auth)

Branded emails in the E-CFunds colours. Paste them into Supabase **after** the own email sender (Resend) works —
see `docs/handoff.md`, session 6, part C. They work with Supabase's default sender too.

| Supabase template | File | Subject to use |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your E-CFunds email |
| Reset Password | `reset-password.html` | Reset your E-CFunds password |
| Magic Link | `magic-link.html` | Your E-CFunds sign-in link |
| Change Email Address | `change-email.html` | Confirm your new E-CFunds email |

## Steps (Neil, about 5 minutes)
1. Open the file in VS Code or Notepad → **Ctrl+A**, **Ctrl+C**.
2. Supabase → project `e-cfunds` → **Authentication** → **Emails** → **Templates** → pick the template from the table.
3. **Subject**: type the subject from the table.
4. **Message body**: click in it → **Ctrl+A** → **Ctrl+V** (replaces the old text) → **Save**.
5. Repeat for the other 3. Then test: **Forgot password?** on the sign-in page with your email.

Keep `{{ .ConfirmationURL }}` and `{{ .Email }}` exactly as they are — Supabase fills them in.
