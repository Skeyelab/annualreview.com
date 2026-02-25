# Multi-source integration plan (Slack, Jira, etc.)

Future phase: ingest not only GitHub but Slack, Jira, and other tools so the annual review narrative can reference discussions, tickets, and cross-tool context. The pipeline (themes → bullets → STAR → self-eval) stays the same; only how we **build** the `contributions[]` input changes.

---

## 1) Principle: one evidence contract, many feeders

- **Pipeline input** remains a single `evidence.json`: `timeframe`, `role_context_optional`, and a flat **contributions** array.
- Each contribution has at minimum: `id`, `type`, `title`, `url`, and a date-like field (`merged_at` or equivalent). The rest is optional and source-specific.
- **Per-source:** we add a **collector** (fetch raw data) and a **normalizer** (raw → list of contributions in the shared shape). A **merge** step (or UI) combines outputs from all enabled sources into one `contributions[]` for the existing pipeline.

No change to prompts or to the theme/bullet/STAR/self-eval steps; they already work on a generic list of evidence items with id/url/title/summary/body.

---

## 2) Extending the contribution model

Current types: `pull_request`, `review`, `release`, `issue`. To support more sources without breaking the schema:

- **Add optional `source`:** e.g. `"source": "github" | "slack" | "jira" | "linear"`. Default `"github"` for backward compatibility.
- **Extend `type` enum** as we add sources, e.g.:
  - **Slack:** `slack_message`, `slack_thread_reply`, `slack_reaction` (or a single “discussion” type).
  - **Jira:** `jira_issue`, `jira_comment`, `jira_worklog` (optional).
- **Generalize “repo”:** today it’s `repo` (org/repo). For Slack we can use `channel_id` or `channel_name` in the same field or add optional `channel`; for Jira, `project` or `project_key`. Schema can allow optional `channel` / `project` and keep `repo` for GitHub.
- **Date field:** keep `merged_at` for GitHub; for other sources use the same field for “primary date” (e.g. message timestamp, issue updated) so filtering by timeframe stays trivial.
- **Optional `meta`:** free-form object for source-specific fields (e.g. Slack thread_ts, Jira issue key, status) so we don’t pollute the core contract but can still pass through for future use or display.

Concretely: add `source` (optional), allow new types in a single union, add optional `channel` / `project` and `meta`, and keep existing fields. Validate with the schema; prompts stay agnostic.

---

## 3) Per-source integration outline

### GitHub (current)

- **Collect:** PRs, reviews, releases (and optionally commits) via API; already have `scripts/collect-github.js` and normalizer.
- **Normalize:** raw → contributions with `type`: `pull_request`, `review`, `release`, `issue`; `source`: `github` (optional today, set when we add multi-source).

### Slack (future)

- **Goal:** Treat meaningful Slack activity as evidence (e.g. “Led incident discussion in #incidents”, “Answered questions in #onboarding”).
- **Collect:** OAuth (scopes: `channels:history`, `groups:history`, `im:history`, `users:read` etc.); fetch messages by user in selected channels/DMs in the timeframe. Optionally threads and reactions.
- **Normalize:** Each message (or thread summary) → one contribution:
  - `id`: e.g. `slack#C12345#1234567890.123456`
  - `type`: `slack_message` or `slack_thread`
  - `title`: first line of message or thread subject
  - `url`: deep link to message/thread
  - `repo` or `channel`: channel name/id
  - `merged_at`: message timestamp
  - `body` / `summary`: message text (possibly truncated)
  - `source`: `slack`
- **Privacy:** Channel list and message content; need clear consent and redaction (e.g. hide channel names, redact message bodies in export). Prefer “select channels” like we do “select repos”.

### Jira (future)

- **Goal:** “Shipped X”, “Resolved N incidents”, “Led design for PROJ-123” with links to tickets.
- **Collect:** OAuth or API token; Jira REST/GraphQL: issues assigned to/user reported by/updated by user, comments by user, optionally worklogs, in the timeframe.
- **Normalize:** Each issue or comment → one contribution:
  - `id`: e.g. `jira#PROJ-123` or `jira#PROJ-123#comment-456`
  - `type`: `jira_issue`, `jira_comment`
  - `title`: issue summary or “Comment on PROJ-123”
  - `url`: link to issue/comment
  - `repo` or `project`: project key
  - `merged_at`: updated/created date
  - `body` / `summary`: description or comment text
  - `labels`: Jira labels
  - `source`: `jira`
- **Linking:** If a PR body contains “PROJ-123”, we can add `linked_issues: ["PROJ-123"]` to the PR contribution; same for Jira issue → link to PR. Optional “linker” step that enriches contributions with cross-refs.

### Others (later)

- **Linear, Asana, Notion, etc.:** Same pattern: collector (API + auth) → normalizer → list of contributions with `id`, `type`, `title`, `url`, date, `source`. Add types and optional fields as needed.
- **CI / incidents:** Optional: “deploy” or “incident” events as contribution type (e.g. from PagerDuty, CircleCI) for “Reliability” themes. Lower priority.

---

## 4) Merge and deduplication

- **Merge:** Concatenate contributions from all source normalizers; sort by `merged_at` (or primary date). Optionally tag each with `source` so the UI or prompts can say “from GitHub” / “from Slack”.
- **Deduplication:** Same real-world event might appear in multiple sources (e.g. “Merged PR that closed Jira PROJ-123”). Options:
  - **None:** Keep all; let the model cluster. Simplest.
  - **Link only:** Add `linked_issues` / `linked_prs` so themes can group them; no deletion.
  - **Heuristic merge:** If a contribution has a link to another (e.g. PR references Jira key), optionally keep one as “primary” and attach the other as metadata. More complex, can be a later step.
- **Timeframe:** Apply the same `start_date` / `end_date` in each collector; merged list is already in range.

---

## 5) Identity and auth

- **Per-source OAuth/tokens:** User connects GitHub, then separately Slack, then Jira. Store tokens per source (encrypted, same as today for GitHub).
- **User identity:** Match by email or by “connected identity” (e.g. Slack user ID, Jira accountId). No need for a single global user id if we only ever merge in the context of one user’s review.
- **Scopes:** Least-privilege per source (e.g. read-only, only selected channels/projects). Document in the same way as `docs/oauth-scopes.md` for each new source.

---

## 6) Privacy and compliance

- **Redaction:** Extend current redaction (repo names, etc.) to Slack channel names and Jira project names if the user wants “internal only” export.
- **Retention:** Same policy as GitHub: user can disconnect and delete; we don’t keep data longer than needed for the review.
- **Compliance:** Slack and Jira have their own ToS and data policies; we only use data the user is authorized to access (OAuth). No scraping; only official APIs.

---

## 7) Phased rollout

| Phase | Scope | Deliverable |
|-------|--------|-------------|
| **Current** | GitHub only | One evidence contract, one pipeline. Done. |
| **Schema** ✅ | Extend evidence.json | Added optional `source`, new types (`slack_message`, `slack_thread`, `jira_issue`, `jira_comment`), optional `channel`/`project`/`meta`, `repo` made optional. Backward compatible. GitHub normalizer emits `source: "github"`. |
| **Merge** | Multi-source evidence | UI or script: “Import from GitHub + Slack + Jira” → run each collector/normalizer → merge into one contributions array → run existing pipeline. |
| **Slack** | Slack ingestion | Slack OAuth, collector, normalizer (messages/threads → contributions), add to merge. |
| **Jira** | Jira ingestion | Jira auth, collector, normalizer (issues/comments → contributions), add to merge. |
| **Linking** (optional) | Cross-refs | Parser/linker that adds `linked_issues` / `linked_prs` from body text; optional dedupe. |
| **Others** | Linear, etc. | Same pattern: collector + normalizer per tool. |

---

## 8) Open questions

- **Slack:** Which channels to include by default (e.g. only public the user is in vs DMs vs private)? Rate limits and pagination for large workspaces.
- **Jira:** Cloud vs Data Center; scopes (read issues vs read comments vs worklogs). How to map “resolution” or “story points” into the contribution shape without over-promising impact.
- **Ordering:** When merging, sort by date; when presenting in the UI, allow “by source” or “by date” so the user can sanity-check.
- **Prompts:** Today prompts are source-agnostic. If we add “Slack discussion” or “Jira ticket”, we may add one line in the system prompt: “Evidence can come from GitHub, Slack, Jira; use id and url to cite.” No structural change.

---

## 9) Summary

- **Single pipeline:** Evidence (from any mix of sources) → themes → bullets → STAR → self-eval. No change to the pipeline itself.
- **One contract:** Extend the contribution schema with optional `source`, new types, and optional `channel`/`project`/`meta`; keep id/type/title/url/date/summary/body as the core.
- **Per-source collectors + normalizers:** GitHub (done), then Slack, then Jira; each outputs a list of contributions; merge and pass to the existing pipeline.
- **Auth and privacy:** Per-source OAuth/tokens, redaction and retention policy applied to all sources.
- **Rollout:** Schema first (backward compatible), then merge UX, then Slack, then Jira, then optional linking and more tools.

This keeps the current design intact and makes “add another source” a repeatable pattern: **collect → normalize → merge → run pipeline**.
