# E-CFunds in Docker

The image contains the **E-CFunds web app** (React + Vite, built and served by nginx). The database, sign-in,
file storage and notifications are the online **Supabase** project, so the container shows the same live data as
https://e-cfunds.vercel.app. Internet is needed to sign in and see data. The image runs as a non-root user and
holds no secret keys (only the public Supabase address + publishable key, which every visitor's browser gets anyway).

| | |
|---|---|
| Image | `e-cfunds:1.0.0` (also `e-cfunds:latest`), ~86 MB |
| Port | `8080` inside the container |
| Export file | `release/e-cfunds-docker-image.tar.gz` (~23 MB, not in git) |

## For the teacher — from Docker Hub (easiest)

Public image: **https://hub.docker.com/r/ramosneil/e-cfunds** (tags `1.0.0` and `latest`, no Docker account needed).

```bash
docker run --rm -p 8080:8080 ramosneil/e-cfunds:1.0.0
```

Open **http://localhost:8080**. Stop it with `Ctrl+C`.

Publish a new version (on Neil's computer, signed in to Docker Desktop as `ramosneil`):

```bash
docker compose build
docker tag e-cfunds:latest ramosneil/e-cfunds:1.0.1
docker tag e-cfunds:latest ramosneil/e-cfunds:latest
docker push ramosneil/e-cfunds:1.0.1
docker push ramosneil/e-cfunds:latest
```

## For the teacher — run the image file

Needs Docker Desktop (Windows/Mac) or Docker Engine (Linux).

```bash
docker load -i e-cfunds-docker-image.tar.gz
docker run --rm -p 8080:8080 e-cfunds:1.0.0
```

Open **http://localhost:8080**. Stop it with `Ctrl+C`.

## For developers — build from the source

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. `docker compose up --build` → http://localhost:8080 (published on 127.0.0.1 only).

Make a new export file after changes:

```bash
docker compose build
docker tag e-cfunds:latest e-cfunds:1.0.0
docker save e-cfunds:latest e-cfunds:1.0.0 | gzip > release/e-cfunds-docker-image.tar.gz
```

## Files
- `Dockerfile` — stage 1 `node:24-alpine` runs `npm ci` + `npm run build`; stage 2 `nginx-unprivileged` serves `dist/`.
- `docker/nginx.conf` + `docker/security-headers.conf` — the same routing, headers and caching as `vercel.json`.
- `compose.yaml` — one service `web`, reads the two VITE_ values from `.env`.
- `.dockerignore` — keeps `.env` (it has the Supabase SECRET key), `node_modules`, `android`, `docs`… out of the build.

## Notes / limits
- "Continue with Google" returns to the address set in Supabase (the Vercel site), not to localhost — use email +
  password inside the container, or add `http://localhost:8080` to Supabase → Authentication → URL Configuration.
- Docker Hub: pushed 2026-11-17 as ramosneil/e-cfunds:1.0.0 + latest (public); pulled back with no local copy and it served the app.
- Checked 2026-11-17: all app routes, security headers, asset caching, health check "healthy", offline mode
  (service worker cached 75 files in headless Edge), and the exported file loads and runs on a clean `docker load`.
