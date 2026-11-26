# E-CFunds

Fund monitoring system for the OMSU Mamburao Office of Student Affairs and Services (SAS): student organizations'
and clubs' dues, remittances, resolution requests, liquidations and transparent financial reports.

- **Live site:** https://e-cfunds.vercel.app
- **Android app:** https://e-cfunds-app.vercel.app/E-CFunds.apk (built and signed on GitHub)

## Roles
- **SAS Admin:** oversees all orgs and clubs, approves accounts, remittances, resolution requests and liquidations.
- **Treasurer:** one per org/club; members, dues, remittances, resolution requests, liquidations, financial report.
- **Student:** own dues and receipts, plus every org's totals and "where the money goes".

## Project layout

```
E-CFunds/
├── frontend/                 Everything users see (React + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── pages/            Screens: admin/, treasurer/, student/, auth/, shared (Account, Messages, Receipt…)
│   │   ├── components/       Reusable UI: app shell, notification bell, financial report, charts, dialogs…
│   │   └── lib/              Data hooks, Supabase client, notifications, push, app updates, exports (PDF/CSV/Excel)
│   ├── public/               Icons, fonts, web-push service worker
│   ├── android/              Android app shell (Capacitor 8, app id ph.edu.omsc.ecfunds)
│   ├── assets/               Android icon and splash sources
│   ├── scripts/              make-ota-bundle (app self-update package), make-app-assets (icons)
│   └── package.json, vite.config.ts, capacitor.config.ts, ota.json …
│
├── backend/                  Everything that runs on the server (Supabase)
│   ├── supabase/
│   │   ├── migrations/       Database changes in order: tables, security rules (RLS), functions, triggers
│   │   ├── functions/        Edge Functions: chat (AI assistant), push (notifications), student-login
│   │   └── tests/            Role-by-role security and money-workflow tests
│   └── scripts/              Database checks and one-time upload scripts
│
├── docs/                     Business rules, database, diagrams, handoff, session notes
├── .github/workflows/        Android APK build, Supabase keep-alive
├── vercel.json               Live site build (from frontend/) + headers
└── .env.example              Copy to .env (one file at the root, used by frontend and backend scripts)
```

## Run it on a computer
```bash
cp .env.example .env          # fill in the two VITE_ values
cd frontend
npm ci
npm run dev                   # http://localhost:3000
```

## Documentation
- [Business rules](docs/business-rules.md) · [Database](docs/database.md)
- [System diagrams](docs/E-CFunds-System-Diagrams.pdf) · [Technology stack](docs/E-CFunds-Technology-Stack.pdf)
- [Things only the owner can do](docs/handoff.md) · [Session notes](docs/sessions.md)
