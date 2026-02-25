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

## Evidence grounding contract
Every generated bullet/claim must cite evidence items by id+url. If impact is not proven, output must ask for confirmation instead of guessing.
