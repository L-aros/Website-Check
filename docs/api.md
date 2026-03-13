# API Reference

All backend routes are under `/api`.

## Authentication

Authentication is cookie-based.

- `POST /api/auth/login`
  - Body:

```json
{ "password": "your-admin-password" }
```

  - Success response:

```json
{
  "authenticated": true,
  "user": { "role": "admin" }
}
```

  - The server sets `Set-Cookie: auth_token=...; HttpOnly; SameSite=Lax; Path=/`.
  - In production the cookie is also `Secure`.

- `GET /api/auth/session`

```json
{
  "authenticated": true,
  "user": { "role": "admin" }
}
```

- `POST /api/auth/logout`

```json
{
  "authenticated": false,
  "user": null
}
```

Clients must send credentials with requests. Do not use `Authorization: Bearer`.

## Settings

- `GET /api/settings`
- `PUT /api/settings`

Example payload:

```json
{
  "autoDownloadAttachmentsFromNewLinks": true,
  "attachmentDateAfter": "2026-01-01",
  "attachmentLogLevel": "debug",
  "maxNewLinksPerCheck": 20
}
```

## Monitors

- `POST /api/monitors`
- `GET /api/monitors`
- `GET /api/monitors/:id`
- `PUT /api/monitors/:id`
- `DELETE /api/monitors/:id`
- `GET /api/monitors/:id/history`
- `POST /api/monitors/:id/check`

Create/update payload fields are whitelist-based. Internal system fields such as `lastContentHash`, `lastLinksHash`, `baselineLinksProcessedAt`, and `lastCheckTime` are not accepted from user input.

Example monitor payload:

```json
{
  "name": "Example monitor",
  "url": "https://example.com/list",
  "selectorType": "css",
  "selector": "#content",
  "frequency": "*/30 * * * *",
  "status": "active",
  "saveHtml": true,
  "trackLinks": true,
  "linkScopeSelector": "#content",
  "downloadAttachments": false,
  "downloadAttachmentsFromNewLinks": true,
  "attachmentTypes": "pdf,docx,xlsx,zip",
  "matchType": "none",
  "matchPattern": "",
  "matchIgnoreCase": true
}
```

Manual trigger response:

```json
{
  "queued": true
}
```

If the same monitor is already running or queued:

```json
{
  "queued": false,
  "reason": "already_pending"
}
```

If the monitor is not `active`, the server returns `409`.

## History assets

Screenshot and snapshot access is bound to an authenticated monitor history record.

- `GET /api/monitors/:id/history/:historyId/screenshot`
- `GET /api/monitors/:id/history/:historyId/snapshot`

Snapshot response example:

```json
{
  "html": "<!doctype html>...",
  "fileName": "monitor_1_1234567890.html"
}
```

The snapshot payload contains sanitized HTML only. It is intended to be rendered inside a sandboxed iframe in the application.

## Downloads

- `GET /api/dashboard/downloads`
- `GET /d/:token`

Attachment short links remain supported through `/d/:token`.

## Monitor link and attachment inspection

- `GET /api/monitors/:id/links`
- `GET /api/monitors/:id/link-logs`
- `GET /api/monitors/:id/attachments`
- `GET /api/monitors/:id/attachment-logs`

## Removed public file routes

These old routes are no longer available:

- `/api/storage/screenshots/<filename>`
- `/api/storage/archives/<filename>`

Only attachment downloads under `/d/:token` remain externally accessible.
