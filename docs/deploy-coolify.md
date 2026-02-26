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
   - `OPENROUTER_API_KEY` — **recommended** for the generate pipeline; uses `anthropic/claude-3.5-sonnet` by default (best quality for structured performance review generation). Takes priority over `OPENAI_API_KEY` when both are set.
   - `OPENAI_API_KEY` — alternative to `OPENROUTER_API_KEY`; uses `gpt-4o-mini` by default.
   - `LLM_MODEL` — (optional) override the model, e.g. `google/gemini-2.0-flash` (OpenRouter, faster/cheaper) or `gpt-4o` (OpenAI)
   - `POSTHOG_API_KEY` — (optional) same project token as frontend; enables LLM analytics (Traces/Generations in PostHog). If missing, pipeline runs but no LLM events are sent.
   - `POSTHOG_HOST` — (optional) default `https://us.i.posthog.com`; use `https://eu.i.posthog.com` for EU.

3. **GitHub OAuth App**
   - Create an OAuth App (or use existing). Set **Authorization callback URL** to:
     `https://<your-coolify-domain>/api/auth/callback/github`
   - No trailing slash; must match the public URL Coolify gives the app.

4. **Proxy**
   - Coolify’s reverse proxy should send `X-Forwarded-Proto: https` and `Host` so the server can build the correct callback URL and set `Secure` cookies.
