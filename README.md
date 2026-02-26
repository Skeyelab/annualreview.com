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

## How to get the data to paste

**Quick path:** [docs/how-to-get-evidence.md](docs/how-to-get-evidence.md) — create a GitHub token, run collect + normalize, then paste or upload **evidence.json** on the Generate page.

## Production (Coolify / Node)

The app needs a Node server in production so `/api/auth/*` and other API routes work. Use the included server:

- **Build:** `yarn build`
- **Run:** `yarn start` (or `node --import tsx/esm server.ts`) — serves `dist/` and API on `PORT` (default 3000).

**Required env in production:** `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and either `OPENROUTER_API_KEY` **or** `OPENAI_API_KEY` (OpenRouter is recommended — see below). In GitHub OAuth App settings, set **Authorization callback URL** to `https://<your-domain>/api/auth/callback/github`. See [docs/oauth-scopes.md](docs/oauth-scopes.md).

**OpenRouter (recommended):** Set `OPENROUTER_API_KEY` to your [OpenRouter](https://openrouter.ai) key. The pipeline defaults to `anthropic/claude-3.5-sonnet` — best-in-class instruction following and structured JSON quality for performance review generation. Override the model with `LLM_MODEL` (e.g. `LLM_MODEL=google/gemini-2.0-flash` for a faster/cheaper option). When `OPENROUTER_API_KEY` is set it takes priority over `OPENAI_API_KEY`.

**OpenAI (legacy):** Set `OPENAI_API_KEY`. Default model is `gpt-4o-mini`; override with `LLM_MODEL`.

**Optional (analytics):** `VITE_POSTHOG_API_KEY` (or `POSTHOG_API_KEY`) — enables client-side PostHog (pageviews and autocapture). For EU host use `VITE_POSTHOG_HOST=https://eu.i.posthog.com`. For server-side LLM analytics (Traces/Generations in PostHog), set `POSTHOG_API_KEY` and optionally `POSTHOG_HOST` (default `https://us.i.posthog.com`). Same project token as frontend is fine. In PostHog, open **Product → LLM analytics** (or filter Events by `$ai_generation`) to see pipeline generations.

## Scripts

- **Collect (on-demand):** `GITHUB_TOKEN=xxx yarn collect --start YYYY-MM-DD --end YYYY-MM-DD --output raw.json` — fetches your PRs and reviews from GitHub for the date range. No cron required; run when you want fresh data.
- **Normalize:** `yarn normalize --input raw.json --output evidence.json` — turns raw API output into the evidence contract.
- **Generate:** `yarn generate evidence.json` — runs the LLM pipeline (themes → bullets → STAR → self-eval). Writes to `./out` by default; use `--out dir` to override. Requires `OPENROUTER_API_KEY` (recommended) or `OPENAI_API_KEY`. Override the model with `LLM_MODEL` env var.

See `docs/data-collection.md` for on-demand vs optional periodic (cron) refresh. For future Slack/Jira and other sources, see `docs/multi-source-plan.md`.

## Evidence grounding contract
Every generated bullet/claim must cite evidence items by id+url. If impact is not proven, output must ask for confirmation instead of guessing.
