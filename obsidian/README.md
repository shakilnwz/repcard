# GenForge Knowledgebase App (`./app`)

Offline-first installable Progressive Web App (PWA) for reading, navigating, and syncing `genforge-lab-knowledgebase`.

## Local Development

```bash
cd app
pnpm install
pnpm dev
```

## Build & Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm preview --port 4173
```

## Cloudflare Pages Deployment & Free Private-Repo Collaborator Access

Deploy `./app` on **Cloudflare Pages** (Free tier):

- **Root directory**: `app`
- **Build command**: `pnpm build`
- **Build output directory**: `dist`

### Required Environment Variables (Cloudflare Pages → Settings → Environment variables)

Create a **GitHub OAuth App** (Developer Settings → OAuth Apps) with callback URL `https://<your-pages-domain>/api/auth/callback`, then configure:

| Variable | Type | Value |
| :--- | :--- | :--- |
| `GITHUB_CLIENT_ID` | Plaintext | Your GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | Your GitHub OAuth App Client Secret |
| `ALLOWED_REPO` | Plaintext (optional) | `shakilnwz/genforge-lab-knowledgebase` (default) |

### How Access Control Works ($0 / Free)

1. Users click **Sign in with GitHub** (`/api/auth/login`).
2. After GitHub OAuth completes (`/api/auth/callback`), the Cloudflare Pages Function checks `GET /repos/${ALLOWED_REPO}` with the user's token and enforces `permissions.push === true`.
3. Only repository collaborators with push access are admitted; removing a collaborator on GitHub revokes access automatically.
4. For local solo testing without OAuth configured, choose **Fine-Grained PAT** inside Onboarding.
