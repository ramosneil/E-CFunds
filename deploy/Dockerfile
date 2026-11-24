# E-CFunds website as a Docker image (React + Vite build served by nginx).
# The database, sign-in and push notifications stay on Supabase (online); this image is the web app only,
# the same thing Vercel serves at e-cfunds.vercel.app.
#
# Build (from the project root):
#         docker build -f deploy/Dockerfile -t e-cfunds:latest --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... .
#         (or: docker compose build — reads the two values from .env)
# Run:    docker run --rm -p 127.0.0.1:8080:8080 e-cfunds:latest   → http://localhost:8080
#
# Only the two PUBLIC browser values go in (they end up in the website's code anyway). Never pass the secret key.

# ---- 1. Build the website ----------------------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so they're cached when only the source changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
      || (echo "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)" && exit 1)
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
# typecheck + vite build (the Android update bundle step skips itself outside Vercel)
RUN npm run build

# ---- 2. Serve it (small, runs as a non-root user) ------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
LABEL org.opencontainers.image.title="E-CFunds" \
      org.opencontainers.image.description="Student organization fund monitoring — OMSU Mamburao (web app)"
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
