# Annual Review Story Kit

This folder contains:
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

## Scripts
- **Collect (on-demand):** `GITHUB_TOKEN=xxx yarn collect --start YYYY-MM-DD --end YYYY-MM-DD --output raw.json` — fetches your PRs and reviews from GitHub for the date range. No cron required; run when you want fresh data.
- **Normalize:** `yarn normalize --input raw.json --output evidence.json` — turns raw API output into the evidence contract.
- **Generate:** `yarn generate evidence.json` — runs the LLM pipeline (themes → bullets → STAR → self-eval). Requires `OPENAI_API_KEY`.

See `docs/data-collection.md` for on-demand vs optional periodic (cron) refresh.

## Evidence grounding contract
Every generated bullet/claim must cite evidence items by id+url. If impact is not proven, output must ask for confirmation instead of guessing.
