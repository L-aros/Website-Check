# Security Update (2026-03)

## Runtime and environment
- Minimum runtime baseline is Node.js 20.18.1+.
- `JWT_SECRET` and `ADMIN_PASSWORD` are required in every environment.
- Placeholder/example values are rejected at startup.
- `CORS_ORIGINS` is a comma-separated allowlist for cookie-based cross-origin access.

## Auth changes
- `POST /api/auth/login` now sets an `HttpOnly` cookie instead of returning a JWT to the frontend.
- `GET /api/auth/session` returns the current auth state.
- `POST /api/auth/logout` clears the auth cookie.
- Frontend requests must send credentials.

## Snapshot and file access
- HTML snapshots are no longer exposed as raw static files.
- Snapshots are sanitized server-side and previewed inside the app through a sandboxed iframe.
- History screenshot endpoint: `GET /api/monitors/:id/history/:historyId/screenshot`
- History snapshot endpoint: `GET /api/monitors/:id/history/:historyId/snapshot`
- Attachment short links under `/d/:token` remain supported.

## Operational notes
- Prefer same-origin deployment for the frontend and backend.
- If the frontend is hosted on another origin, configure `CORS_ORIGINS` explicitly and keep credentialed requests enabled.
