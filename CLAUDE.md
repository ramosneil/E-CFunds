# CLAUDE.md — E-CFunds

Fund monitoring app for OMSC Office of Student Affairs (SAS) clubs & organizations.
Rebuild of a PHP/MySQL/XAMPP system (`C:\xampp\htdocs\mini system`) as a cloud PWA + Android app.

## Status
- Phase 0 (repo setup) — done 2026-11-12
- Next: Phase 1 — extract business rules/formulas from old PHP → `docs/business-rules.md`
- Full plan & phases: `docs/plan.md`

## Stack (decided)
- Frontend: React + TypeScript + Vite + Tailwind, mobile-first, light/dark mode
- Mobile: installable PWA + Android APK via Capacitor (no Play Store, no iOS)
- Backend: Supabase (Postgres, Auth, RLS, Storage, Realtime, Edge Functions)
- Hosting: Vercel (auto-deploy from GitHub)
- Budget: free tiers only → keep-alive ping so Supabase Free doesn't pause
- AI chatbot: Gemini free tier via Edge Function, provider-swappable (Claude Haiku later)

## Roles
- SAS Admin — everything; approves remits, releases funds, approves accounts
- Treasurer — one per org/club; students, dues, remit requests, expenses
- Student — read-only: school summary, every org/club report, own dues status
  (NOT transaction-level ledger)

## Core rules
- Student belongs to max 1 club + max 1 organization
- Money tracked per semester; balances carry forward
- One ledger; balances are computed in SQL views, never stored as totals
- Self-register → approval (students must match a roster student ID)
- Student login: Google OR Student ID + password; staff: email/password or Google

## Security (non-negotiable)
- No secrets in git. Keys live in Supabase secrets / Vercel env / local `.env` (gitignored)
- Every table has RLS; test each role
- Old Gemini key was hard-coded in `api/config.php` → treated as leaked, rotated

## Working rules (from Neil)
- Start every session in plan mode; ask until 95% sure; no assumptions, no guessing
- To-do lists include a self-check step; don't advance until current step is verified
- UI: premium quality, always design light AND dark mode
- "ULTRA…" = maximum-quality output
- Update this file at session end; keep it 150–200 lines max; link out to docs/

## Docs map
- `docs/plan.md` — decisions, data model draft, phases with check gates
- `docs/business-rules.md` — (Phase 1) money formulas & workflows
- `docs/design-system.md` — (Phase 2) colors, type, components, light/dark
