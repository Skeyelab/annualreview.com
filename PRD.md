# PRD: Annual Review Story (GitHub → Evidence → Narrative)

## 1) Overview
Annual Review Story is a web app that connects to a developer’s GitHub account, analyzes their work over a selected time window (e.g., last calendar year), and generates an evidence-backed annual review draft: themes, impact bullets, STAR stories, and an appendix of links. The product turns raw activity into an “impact narrative” that is safe (no hallucinated claims) and easy to paste into HR systems.

## 2) Problem
Developers struggle to write annual reviews because:
- Work is spread across many PRs/repos and hard to summarize.
- People default to activity metrics (“I merged 45 PRs”) instead of impact.
- Evidence gathering (links, dates, artifacts) is time-consuming.
- Managers want clear themes + outcomes + proof, not a changelog.

## 3) Goals / Non-goals
### Goals
- Generate a polished self-review draft with **every claim traceable** to GitHub evidence.
- Produce copy/paste-ready outputs in common formats (generic + “bullets-first”).
- Minimize user effort: connect, pick timeframe, pick repos, generate, optionally add context, regenerate.
- Offer privacy controls and redaction.

### Non-goals (v1)
- Full Jira/Slack ingestion (future phase).
- Auto-confirming business metrics (no access; user provides).
- Performance rating recommendations.

## 4) Target Users
- Individual contributors (mid → staff) writing self-evals.
- Tech leads who want theme-based reporting.
- Contractors/freelancers producing end-of-year summaries.

## 5) Key Use Cases
1. **Self review draft:** “Give me my annual review narrative for 2025.”
2. **Brag doc:** Ongoing or end-of-year evidence compilation.
3. **Promotion packet starter:** Top themes + STAR stories + proof links.

## 6) User Journey (MVP)
1. Sign in → “Connect GitHub” (OAuth).
2. Select timeframe (start/end) and repos (or “all”).
3. System imports PRs + reviews + releases (optionally issues) within timeframe.
4. Generate:
   - 4–8 themes with anchors
   - 2–5 impact bullets per theme
   - Top 10 bullets overall
   - 2–3 STAR stories
   - Evidence appendix (grouped links)
5. Optional “Add context” prompts (metrics, stakeholders, customer impact) → regenerate.

## 7) Functional Requirements
### Auth & Data
- GitHub OAuth with least-privilege scopes.
- Import user’s PRs authored, reviews performed, and relevant metadata:
  - title/body, repo, merged_at, labels, files changed counts, review counts, linked issues/releases when available.
- Repo selection UI and exclusions.

### Story Engine
- Theme clustering (4–8 max) with confidence scoring.
- Bullet generation grounded in evidence IDs/URLs (1–3 citations per bullet).
- STAR story generation grounded in anchor PRs.
- “Missing info questions” when impact cannot be proven from GitHub alone.

### Output & Export
- Render outputs in app with “copy” buttons.
- Export to Markdown + JSON.
- Evidence appendix with links grouped by theme.

### Privacy / Safety
- Redaction controls: hide repo names / replace with “internal repo”.
- Exclude selected repos/PRs.
- No fabricated metrics: anything not in evidence must be labeled “needs confirmation.”

## 8) Non-Functional Requirements
- Data freshness: sync completes within a few minutes for typical accounts (hundreds of PRs).
- Reliability: retries and idempotent imports.
- Security: encrypted tokens at rest; minimal scopes; clear “disconnect & delete” flow.
- Cost control: LLM calls only after structured data is prepared; cache intermediate results.

## 9) Success Metrics
- Activation: % users who connect GitHub and generate a draft.
- Time-to-value: median time from connect → first draft.
- Output usability: % who copy/export at least one section.
- Regeneration rate after adding context (signals usefulness).

## 10) MVP Scope
### In
- GitHub OAuth, timeframe/repo selection, import PRs+reviews+releases
- Theme clustering + bullets + STAR stories + evidence appendix
- Markdown export
- Basic redaction + exclusions

### Out (later)
- Slack/Jira ingestion
- Team-wide rollups
- Automated metric lookups (CI, incident tools)
- Manager dashboard

## 11) Open Questions / Risks
- Best GitHub scopes for private repos vs public-only mode.
- How to infer “impact” safely from limited GitHub artifacts.
- Handling monorepos where PRs are broad and hard to theme.
- Rate limiting and pagination for large orgs.

## 12) Milestones (suggested)
- M1: OAuth + importer + local evidence viewer
- M2: Theme clustering + bullet generation
- M3: STAR stories + export + redaction
- M4: Polish: context prompts + regenerate loop
