# Making it real: GitHub OAuth and web flow

Right now the app has **no auth**. The Generate page expects pasted/uploaded evidence JSON. The collector runs only via CLI (`GITHUB_TOKEN=xxx yarn collect ...`). To get a real "Connect GitHub" flow you need:

1. **A GitHub OAuth App** (not a "GitHub App" — that’s for bot/install flows).
2. **Auth routes and session** on your server.
3. **An import API** that uses the user’s token to run collect + normalize and return evidence.

---

## 1) Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps** (or [github.com/settings/developers](https://github.com/settings/developers)).
2. **New OAuth App**.
3. Fill in:
   - **Application name:** e.g. `AnnualReview (dev)` or `AnnualReview`.
   - **Homepage URL:** `http://localhost:3000` (dev) or `https://annualreview.dev` (prod).
   - **Authorization callback URL:**  
     - Dev: `http://localhost:3000/api/auth/github/callback`  
     - Prod: `https://annualreview.dev/api/auth/github/callback`  
     (You can only set one per app; use a separate OAuth App for prod if needed.)
4. After creating, copy **Client ID** and generate a **Client secret**.

---

## 2) Environment variables

Add to `.env` (or your host’s env):

```bash
# GitHub OAuth (from the OAuth App above)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Session (any random string; used to sign cookies)
SESSION_SECRET=some_long_random_string
```

Never commit the client secret or session secret. Use different values for dev vs prod.

---

## 3) Scopes (what you’ll request)

From [docs/oauth-scopes.md](./oauth-scopes.md):

| Mode            | Scopes                      | When to use              |
|-----------------|-----------------------------|---------------------------|
| Public repos    | `read:user` `public_repo`    | Default, minimal trust.   |
| Include private | `read:user` `repo`          | User opts in.             |

Start with public-only: request `read:user` and `public_repo` in the authorize URL. You can add a second button or query param later for `?scope=private` that requests `repo` instead.

---

## 4) What’s implemented

`server.js` and `src/Generate.jsx` now include a complete OAuth + import flow:

| Piece | Status |
|-------|--------|
| **GET /api/auth/github** | Redirects to GitHub authorize with `read:user public_repo` scope |
| **GET /api/auth/github/callback** | Exchanges `?code=` for access token, stores in session, redirects to `/generate` |
| **Session middleware** | `express-session` using `SESSION_SECRET`; token stored in `req.session.githubAccessToken` |
| **GET /api/me** | Returns `{ connected: true/false }` so the UI shows “Connect GitHub” or the import form |
| **POST /api/import** | Body: `{ start_date, end_date }`. Runs `collectRaw()` + `normalize()` with the stored token; returns evidence JSON |
| **POST /api/auth/logout** | Destroys session, redirects to `/` |
| **Generate UI** | Shows date-range import form when connected; shows “Connect GitHub” link otherwise |

To activate the flow, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` as described in section 2 above.

---

## 5) Callback URL checklist

- **Local:** callback URL must be exactly `http://localhost:3000/api/auth/github/callback` (or whatever port you use). No trailing slash.
- **Prod:** same idea, e.g. `https://annualreview.dev/api/auth/github/callback`. HTTPS and domain must match where the app is hosted.

If the callback URL doesn’t match exactly, GitHub will show an error and not redirect back with the code.

---

## 6) Token storage and security

- Store the **access token** in the server-side session only (signed cookie or server-side store like Redis). Don’t send it to the browser.
- Use **HTTPS** in production so the session cookie is protected.
- Follow [oauth-scopes.md](./oauth-scopes.md): public-only by default; only request `repo` when the user explicitly chooses "include private repos."

Once the OAuth App exists and these routes + session + import API are implemented, the app becomes "real": users can connect GitHub, pick a timeframe, import evidence, and generate without touching the CLI or pasting JSON.
