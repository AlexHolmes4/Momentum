# Cloudflare Workers Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Momentum to Cloudflare Workers (static assets) with automatic deploys on every push to `main` via GitHub Actions.

**Architecture:** GitHub Actions builds the Next.js static export (`out/`) and deploys it to Cloudflare Workers using `cloudflare/wrangler-action@v3` + `wrangler deploy`. A `wrangler.toml` in the project root tells Wrangler to serve the `out/` directory as static assets. The Worker is auto-created on first deploy — no manual dashboard project setup required. Supabase env vars are stored as GitHub secrets and baked into the static output at build time.

**Why Workers over Pages:** Cloudflare has announced that all future investment goes into Workers. Pages is maintenance-only. Workers now natively supports static asset hosting (`[assets]` config), making it the correct platform for new projects.

**Tech Stack:** GitHub Actions, `cloudflare/wrangler-action@v3`, Wrangler, Next.js static export (`output: 'export'`)

---

## Task 1: Verify local build is clean ✅ COMPLETE

Build confirmed clean. `out/` contains `index.html`, `_next/`, `dashboard/`, `goals/`, `tasks/`, `archive/`, `login/`. No fixes needed.

---

## Task 2: Create Cloudflare API token (manual — dashboard)

**Step 1: Log in to Cloudflare**

Go to https://dash.cloudflare.com and sign in (or create account).

**Step 2: Note your Account ID**

In the Cloudflare dashboard URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/...`

Copy and save this — you'll need it as a GitHub secret.

**Step 3: Go to API Tokens**

Top-right profile icon → **My Profile** → **API Tokens** → **Create Token**

**Step 4: Use Custom Token**

Click **"Get started"** under Custom Token (not a template).

**Step 5: Configure the token**

- Token name: `momentum-github-actions`
- Permissions: `Account → Workers Scripts → Edit`
- Account Resources: Include → your account
- Click **"Continue to summary"** → **"Create Token"**

**Step 6: Copy the token immediately**

It's only shown once. Save it — you'll add it as a GitHub secret next.

---

## Task 3: Add secrets to GitHub repository (manual — GitHub settings)

**Step 1: Go to repo secrets**

GitHub → your Momentum repo → Settings → Secrets and variables → Actions → New repository secret

**Step 2: Add each secret**

Add all four, one at a time:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The API token from Task 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID from Task 2 |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (from `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key (from `.env.local`) |

**Step 3: Verify**

Settings → Secrets → Actions should show 4 secrets listed (values hidden).

---

## Task 4: Add wrangler.toml to project root

**Files:**
- Create: `wrangler.toml`

**Step 1: Create wrangler.toml**

Create `wrangler.toml` in the project root with this content:

```toml
name = "momentum"
compatibility_date = "2024-09-23"

[assets]
directory = "./out"
```

Notes:
- `name` — the Worker name; first deploy auto-creates it in Cloudflare dashboard
- `compatibility_date` — required; `2024-09-23` or later is needed for modern compatibility flags
- `[assets].directory` — tells Wrangler to upload `out/` as static assets on deploy

**Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add wrangler.toml for Cloudflare Workers static asset deployment"
```

---

## Task 5: Write the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Create the workflow file**

Create `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

Notes:
- `actions/checkout@v4` — latest stable checkout action
- `actions/setup-node@v4` with `cache: 'npm'` — caches `node_modules` between runs for speed
- Node 20 LTS — stable, supports Next.js 16
- `cloudflare/wrangler-action@v3` — official Cloudflare action; runs `wrangler deploy` using `wrangler.toml`
- No explicit `command` needed — Wrangler reads `wrangler.toml` and deploys automatically
- `gitHubToken` — enables deployment status comments on PRs
- Supabase env vars passed at build step so Next.js bakes them into the static output

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Cloudflare Workers deployment workflow"
```

---

## Task 6: Push and verify first deployment

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Watch the Actions run**

GitHub → Actions tab → "Deploy to Cloudflare Workers" workflow → watch steps complete.

Expected: all steps green, final step shows a Cloudflare Workers URL.

**Step 3: Check the deployment URL**

The action output will include the deployed Worker URL, something like:
```
https://momentum.<your-subdomain>.workers.dev
```

Open that URL and verify:
- App loads
- Redirects to `/login/`
- Login page renders correctly
- Magic link auth works end-to-end

**Step 4: Check Cloudflare dashboard**

CF dashboard → Workers & Pages → momentum → should show the Worker with latest deployment.

---

## Task 7: Update CLAUDE.md and claude-progress.txt

**Step 1: Update CLAUDE.md**

Update the Hosting line in `CLAUDE.md` to reflect Workers and include the live URL (replace with actual URL from Task 6):

```markdown
- **Hosting**: Cloudflare Workers (static assets) — `output: 'export'` in next.config.js, `wrangler.toml` points at `out/` — https://momentum.<your-subdomain>.workers.dev
```

**Step 2: Append to claude-progress.txt**

Add a session summary noting:
- Switched deployment target from Cloudflare Pages to Cloudflare Workers (static assets)
- Added `wrangler.toml` with `[assets] directory = "./out"`
- GitHub Actions workflow added at `.github/workflows/deploy.yml`
- 4 GitHub secrets configured (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Live URL: (update with actual URL from Task 6)

**Step 3: Commit**

```bash
git add CLAUDE.md claude-progress.txt
git commit -m "docs: update hosting docs for Cloudflare Workers deployment"
```
