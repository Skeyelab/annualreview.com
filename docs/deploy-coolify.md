# Deploying to Coolify (Nixpacks)

The repo includes `nixpacks.toml` so Nixpacks runs `yarn build` and then `yarn start` (the Node server). That way the API routes exist in production; without it, Nixpacks might only serve static files and Connect would 404.

1. **Build & start** (handled by Nixpacks via `nixpacks.toml`)
   - Build: `yarn build`
   - Start: `yarn start` (Node server serves `dist/` + `/api/*`)
   - Server listens on `PORT` (Coolify sets this automatically).

2. **Environment variables** (set in Coolify → your service → Environment)
   - `SESSION_SECRET` — random string for signing session cookies (e.g. `openssl rand -hex 32`)
   - `GITHUB_CLIENT_ID` — from [GitHub OAuth App](https://github.com/settings/developers)
   - `GITHUB_CLIENT_SECRET` — from the same OAuth App
   - `OPENAI_API_KEY` — for the generate pipeline

3. **GitHub OAuth App**
   - Create an OAuth App (or use existing). Set **Authorization callback URL** to:
     `https://<your-coolify-domain>/api/auth/callback/github`
   - No trailing slash; must match the public URL Coolify gives the app.

4. **Proxy**
   - Coolify’s reverse proxy should send `X-Forwarded-Proto: https` and `Host` so the server can build the correct callback URL and set `Secure` cookies.
