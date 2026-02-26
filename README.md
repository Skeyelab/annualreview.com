# AnnualReview.dev

Turn GitHub contributions into an evidence-backed annual review. **https://annualreview.dev**

This repo contains:
- `PRD.md` — one-page product requirements doc
- `prompts/` — Cursor-ready prompt templates for a GitHub→story pipeline
- `AGENTS.md` — suggested agent workflow and guardrails

## Suggested pipeline
1) Import GitHub evidence (PRs, reviews, releases) into a structured JSON payload.
2) Run prompts in order:
   - `prompts/00_system.md` (as system)
   - `prompts/10_theme_cluster.md`
   - `prompts/20_impact_bullets.md`
   - `prompts/30_star_stories.md`
   - `prompts/40_self_eval_sections.md`

## Development with Foreman (Rails backend)

To run the full stack (Rails API + Vite frontend + Solid Queue worker) with one command:

```bash
foreman start
```

- **Rails API** → http://localhost:3000  
- **Vite (React)** → http://localhost:5173 — open this in the browser; it proxies `/api` and `/auth` to Rails.

**Before first run:** In the repo root, `cd backend && bundle install && bin/rails db:prepare`. Copy `.env` (or create it) with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`. For GitHub OAuth with Foreman, add **Authorization callback URL** `http://localhost:5173/auth/github/callback` to your GitHub OAuth app so the redirect goes through Vite to Rails.

**Without Foreman:** Run only the frontend with `yarn dev` — the dev server uses the in-process Node API. Run only Rails with `cd backend && bin/rails server -p 3000`.

## How to get the data to paste

**Quick path:** [docs/how-to-get-evidence.md](docs/how-to-get-evidence.md) — create a GitHub token, run collect + normalize, then paste or upload **evidence.json** on the Generate page.

## Production (Coolify / Node)

The app needs a Node server in production so `/api/auth/*` and other API routes work. Use the included server:

- **Build:** `yarn build`
- **Run:** `yarn start` (or `node --import tsx/esm server.ts`) — serves `dist/` and API on `PORT` (default 3000).

**Required env in production:** `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`. In GitHub OAuth App settings, set **Authorization callback URL** to `https://<your-domain>/api/auth/callback/github`. See [docs/oauth-scopes.md](docs/oauth-scopes.md).

**Optional (analytics):** `VITE_POSTHOG_API_KEY` (or `POSTHOG_API_KEY`) — enables client-side PostHog (pageviews and autocapture). For EU host use `VITE_POSTHOG_HOST=https://eu.i.posthog.com`. For server-side LLM analytics (Traces/Generations in PostHog), set `POSTHOG_API_KEY` and optionally `POSTHOG_HOST` (default `https://us.i.posthog.com`). Same project token as frontend is fine. In PostHog, open **Product → LLM analytics** (or filter Events by `$ai_generation`) to see pipeline generations.

## Scripts

- **Collect (on-demand):** `GITHUB_TOKEN=xxx yarn collect --start YYYY-MM-DD --end YYYY-MM-DD --output raw.json` — fetches your PRs and reviews from GitHub for the date range. No cron required; run when you want fresh data.
- **Normalize:** `yarn normalize --input raw.json --output evidence.json` — turns raw API output into the evidence contract.
- **Generate:** `yarn generate evidence.json` — runs the LLM pipeline (themes → bullets → STAR → self-eval). Writes to `./out` by default; use `--out dir` to override. Requires `OPENAI_API_KEY`.

See `docs/data-collection.md` for on-demand vs optional periodic (cron) refresh. For future Slack/Jira and other sources, see `docs/multi-source-plan.md`.

## Evidence grounding contract
Every generated bullet/claim must cite evidence items by id+url. If impact is not proven, output must ask for confirmation instead of guessing.
