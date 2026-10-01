# FORTUNE NOIR secure admin backend

## What this adds
- Server-side `391x` admin authentication.
- Admin-only coin grant endpoint.
- Server-side player balance storage in Cloudflare D1.
- Idempotent player balance ledger so a retried client request cannot double-apply the same transaction.
- Admin operation log.
- Player session tokens and balance synchronization.

## Required deployment
GitHub Pages can only serve the static frontend. The secure admin API must run on a server/worker.
This package targets Cloudflare Workers + D1.

### 1. Create D1
```bash
npx wrangler d1 create fortune-noir
```
Copy the returned database id into `wrangler.toml`.

### 2. Apply schema
```bash
npx wrangler d1 execute fortune-noir --remote --file=schema.sql
```

### 3. Set secrets
```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```
`ADMIN_PASSWORD` is the password for the fixed admin username `391x`.
`SESSION_SECRET` is kept as a deployment secret for future token/signing expansion.

### 4. Deploy
```bash
npx wrangler deploy
```

### 5. Configure the frontend
Set the Worker URL in the page before `app.js` loads:
```html
<script>window.FN_ADMIN_API_URL='https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev';</script>
```

Without this URL, the existing static/local behavior remains untouched and the secure admin backend stays inactive.
