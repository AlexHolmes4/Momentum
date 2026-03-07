# Cloudflare Pages Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Momentum to Cloudflare Pages with automatic deploys on every push to `main` via GitHub Actions.

**Architecture:** GitHub Actions builds the Next.js static export (`out/`) and uploads it to Cloudflare Pages using `cloudflare/pages-action@v1`. The CF Pages project is created once manually via Direct Upload — all subsequent deploys are automated. Supabase env vars are stored as GitHub secrets and baked into the static output at build time.

**Tech Stack:** GitHub Actions, `cloudflare/pages-action@v1`, Wrangler (used internally by the action), Next.js static export

---

## Task 1: Verify local build is clean

Before touching any CI config, confirm the build passes locally.

**Files:** none

**Step 1: Run the build**

```bash
cd /path/to/Momentum
npm run build
```

Expected: `out/` directory created, no errors. If errors appear, fix them before continuing.

**Step 2: Confirm out/ contents**

```bash
ls out/
```

Expected: `index.html` (or `index/index.html` with trailingSlash), `_next/`, `dashboard/`, `goals/`, `tasks/`, `archive/`, `login/`

**Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors before deployment setup"
```

---

## Task 2: Create Cloudflare Pages project (manual — dashboard)

This is a one-time setup in the Cloudflare dashboard. Cannot be automated.

**Step 1: Log in to Cloudflare**

Go to https://dash.cloudflare.com and sign in (or create account).

**Step 2: Navigate to Workers & Pages**

Left sidebar → Workers & Pages → Create → Pages tab

**Step 3: Choose Direct Upload**

Click **"Direct Upload"** (NOT "Connect to Git" — that's the native integration we're avoiding).

**Step 4: Create the project**

- Project name: `momentum`
- Click **"Create project"**
- On the next screen it asks you to upload files — upload any file temporarily (e.g. drag the `out/` folder) just to initialise the project. GitHub Actions will handle all future deploys.

**Step 5: Note your Account ID**

In the Cloudflare dashboard, click the account name (top-right) → the URL contains your Account ID:
`https://dash.cloudflare.com/<ACCOUNT_ID>/...`

Copy and save this — you'll need it as a GitHub secret.

---

## Task 3: Create Cloudflare API token (manual — dashboard)

**Step 1: Go to API Tokens**

Cloudflare dashboard → top-right profile icon → My Profile → API Tokens → Create Token

**Step 2: Use Custom Token**

Click **"Get started"** under Custom Token (not a template).

**Step 3: Configure the token**

- Token name: `momentum-github-actions`
- Permissions: `Account → Cloudflare Pages → Edit`
- Account Resources: Include → your account
- Click **"Continue to summary"** → **"Create Token"**

**Step 4: Copy the token immediately**

It's only shown once. Save it — you'll add it as a GitHub secret next.

---

## Task 4: Add secrets to GitHub repository (manual — GitHub settings)

**Step 1: Go to repo secrets**

GitHub → your Momentum repo → Settings → Secrets and variables → Actions → New repository secret

**Step 2: Add each secret**

Add all four, one at a time:

| Name | Value |
|---|---|
| `CF_API_TOKEN` | The API token from Task 3 |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID from Task 2 |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (from `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key (from `.env.local`) |

**Step 3: Verify**

Settings → Secrets → Actions should show 4 secrets listed (values hidden).

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
name: Deploy to Cloudflare Pages

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
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: momentum
          directory: out
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

Notes:
- `actions/checkout@v4` — latest stable checkout action
- `actions/setup-node@v4` with `cache: 'npm'` — caches `node_modules` between runs for speed
- Node 20 LTS — stable, supports Next.js 16
- `gitHubToken` passed to `pages-action` — enables preview URL comments on PRs
- Supabase env vars passed at build step so Next.js bakes them into the static output

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Cloudflare Pages deployment workflow"
```

---

## Task 6: Push and verify first deployment

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Watch the Actions run**

GitHub → Actions tab → "Deploy to Cloudflare Pages" workflow → watch steps complete.

Expected: all steps green, final step shows a Cloudflare Pages URL.

**Step 3: Check the deployment URL**

The action output will include a line like:
```
✨ Deployment complete! Take a peek over at https://momentum.pages.dev
```

Open that URL and verify:
- App loads
- Redirects to `/login/`
- Login page renders correctly
- Magic link auth works end-to-end

**Step 4: Check Cloudflare dashboard**

CF dashboard → Workers & Pages → momentum → Deployments tab — should show the deployment with a green "Active" status.

---

## Task 7: Update CLAUDE.md and claude-progress.txt

**Step 1: Update CLAUDE.md hosting section**

In `CLAUDE.md`, update the Hosting line to include the live URL:

```markdown
- **Hosting**: Cloudflare Pages — static export (`output: 'export'` in next.config.js) — https://momentum.pages.dev
```

**Step 2: Append to claude-progress.txt**

Add a session summary noting:
- Cloudflare Pages project created (Direct Upload)
- GitHub Actions workflow added at `.github/workflows/deploy.yml`
- 4 GitHub secrets configured
- Live URL: https://momentum.pages.dev (update with actual URL)

**Step 3: Commit**

```bash
git add CLAUDE.md claude-progress.txt
git commit -m "docs: add live deployment URL and session notes"
```
