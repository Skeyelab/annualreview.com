# Setting up GitHub OAuth

This guide explains how to register a GitHub OAuth App so that AnnualReview.dev can import your GitHub activity without you pasting any JSON.

---

## 1. Register a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → [New OAuth App](https://github.com/settings/applications/new)**.
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Application name** | `AnnualReview.dev (local)` |
   | **Homepage URL** | `http://localhost:5173` |
   | **Authorization callback URL** | `http://localhost:5173/api/auth/callback` |

3. Click **Register application**.
4. On the next page, note the **Client ID**.
5. Click **Generate a new client secret** and note the **Client Secret**.

---

## 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

> **Never commit `.env` to version control.** It is already in `.gitignore`.

---

## 3. Start the dev server

```bash
npm run dev
```

Navigate to [http://localhost:5173/generate](http://localhost:5173/generate) and click **Connect GitHub (public repos)**.

---

## Scopes

| Button | Scopes requested | Use when |
|--------|-----------------|----------|
| Connect GitHub (public repos) | `read:user`, `public_repo` | Default; analyzes only public repos |
| Connect (include private repos) | `read:user`, `repo` | Opt-in; analyzes private repos too |

See [docs/oauth-scopes.md](./oauth-scopes.md) for full details.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `GITHUB_CLIENT_ID not set` error on `/api/auth/start` | Check `.env` exists and the server was restarted after editing it |
| Callback shows "Missing OAuth parameters" | Ensure `GITHUB_CLIENT_SECRET` is set |
| `bad_verification_code` from GitHub | The code expired; click **Connect GitHub** again |
| `redirect_uri_mismatch` from GitHub | The callback URL in your OAuth App settings must exactly match `http://localhost:5173/api/auth/callback` |
