# Request to OMSC IT — DNS records for E-CFunds

Ready to send. Neil: copy everything between the lines into an email or letter to OMSC's IT / MIS office.
First paste the email records from Resend into section 2 (see `docs/handoff.md`, "Own email sender").

---

**Subject:** DNS records for E-CFunds (SAS fund monitoring system) — `ecfunds.omsc.edu.ph`

Good day!

I am Neil Christian Ramos, developer of **E-CFunds**, the fund monitoring system of the Office of Student Affairs
and Services (SAS) for student organizations and clubs. It currently runs at https://e-cfunds.vercel.app.

May we request the subdomain **`ecfunds.omsc.edu.ph`** for it, so students and officers see an official OMSC
address, and so its emails (account sign-up and password reset) come from `no-reply@ecfunds.omsc.edu.ph`.

The `omsc.edu.ph` DNS is on **Cloudflare**. Please add these records:

**1. Website** (hosted on Vercel)

| Type | Name | Value | Proxy status |
|---|---|---|---|
| CNAME | `ecfunds` | `e519b2a79f16bbc1.vercel-dns-017.com` | **DNS only** (grey cloud — not proxied) |

"DNS only" matters: Vercel issues the HTTPS certificate itself, and the orange-cloud proxy blocks that.

**2. Email sending** (Resend — sending only, no mailboxes; does not affect any existing OMSC email)

| Type | Name | Value | Priority |
|---|---|---|---|
| _(Neil pastes the records from Resend here — usually 1 MX, 2 TXT)_ | | | |

These are only for the `ecfunds` subdomain (e.g. `send.ecfunds` and `resend._domainkey.ecfunds`), so they do not
change mail for `omsc.edu.ph` itself. All records: **DNS only**, TTL Auto.

Nothing else on `omsc.edu.ph` changes. Thank you very much!

Neil Christian Ramos
E-CFunds developer, for the Office of Student Affairs and Services

---

## For Claude (after IT is done)
- Check: Vercel `get_domain_config ecfunds.omsc.edu.ph` → `misconfigured: false`; https://ecfunds.omsc.edu.ph loads.
- Then do Part 3 step 3 of the plan (LIVE_URL, OTA SITE, CORS, Vercel primary domain + redirect except `/ota/*`)
  and give Neil the Supabase Auth URL steps.
- If IT picks a different name, remove `ecfunds.omsc.edu.ph` from the Vercel project, add the new one, and send IT
  the new CNAME value Vercel recommends.
