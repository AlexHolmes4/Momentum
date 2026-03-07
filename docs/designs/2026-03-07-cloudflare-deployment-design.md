# Cloudflare Pages Deployment — Design

**Date:** 2026-03-07

## Overview

Deploy Momentum to Cloudflare Pages using GitHub Actions for CI/CD. Every push to `main` triggers a build and deploy. The built `out/` folder is uploaded to Cloudflare Pages via the `cloudflare/pages-action` GitHub Action.

## Approach

**GitHub Actions + Direct Upload** (not CF native Git integration).

Chosen because:
- Gates deployment on a passing build (native integration always deploys on push)
- Controls Node.js version explicitly
- Not a one-way door — native Git integration cannot be switched to Direct Upload later
- Extensible: add lint/test jobs before deploy in future

## Pipeline

File: `.github/workflows/deploy.yml`

Trigger: `push` to `main`

Steps:
1. Checkout repo
2. Setup Node.js (version pinned to match local dev)
3. `npm ci` — install dependencies
4. `npm run build` — generates `out/` (Next.js static export)
5. `cloudflare/pages-action@v1` — uploads `out/` to Cloudflare Pages

## Cloudflare Pages Project Setup (one-time, manual)

1. Create a new Pages project in the CF dashboard using **Direct Upload** (not Git integration)
2. Project name: `momentum`
3. No build command needed in CF dashboard — build runs in GitHub Actions

## Secrets

Stored in GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `CF_API_TOKEN` | CF API token scoped to `Cloudflare Pages: Edit` |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |

The Supabase env vars must be available at build time (GitHub Actions) because `npm run build` bakes them into the static output.

## Preview Deploys

`cloudflare/pages-action` automatically creates a preview URL for every non-main branch push and posts it as a GitHub commit status. Production URL only updates on `main`.

## Environment Variables in CF Dashboard

Not needed for the build (handled in GHA). May be needed later if CF Pages Functions are used (currently none).

## Static Export Compatibility

Already configured:
- `next.config.js`: `output: 'export'`, `trailingSlash: true`, `images: { unoptimized: true }`
- `public/_headers`: security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

No changes needed to the Next.js config.
