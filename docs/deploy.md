# Deployment Guide

## Runtime requirements
- Node.js 20.18.1+
- Chromium or another browser binary usable by Puppeteer
- SQLite or MySQL

## Required backend environment

The backend refuses to start if these values are missing or left as placeholders:

- `ADMIN_PASSWORD`
- `JWT_SECRET`

Database configuration:

- SQLite:
  - `DB_DIALECT=sqlite`
  - `DB_STORAGE=./data/website_check.sqlite`
- MySQL:
  - `DB_DIALECT=mysql`
  - `DB_HOST=...`
  - `DB_NAME=...`
  - `DB_USER=...`
  - `DB_PASS=...`

Other important variables:

- `NODE_ENV=production`
- `PORT=3000`
- `CORS_ORIGINS=https://your-frontend.example.com`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- `MAX_CONCURRENT_CHECKS=2`

## Auth and cross-origin deployment

- The frontend authenticates with an `HttpOnly` cookie.
- Prefer same-origin deployment for frontend and backend.
- If the frontend is hosted on a different origin, set `CORS_ORIGINS` to an explicit comma-separated allowlist and keep credentialed requests enabled.
- Do not build new clients around Bearer tokens or `localStorage`.

## Docker

The provided Dockerfile uses Node.js `20.18.1` base images.

Build and run:

```bash
docker compose up --build
```

Default production container settings:

- `NODE_ENV=production`
- `DB_DIALECT=sqlite`
- `DB_STORAGE=/data/website_check.sqlite`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

## Notes

- HTML snapshots are previewed through authenticated history endpoints and should be rendered in a sandboxed iframe.
- Screenshot and snapshot files are no longer exposed as public static routes.
- Attachment files are cleaned up best-effort after monitor deletion.
