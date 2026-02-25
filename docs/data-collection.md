# Data collection: on-demand vs periodic

We **don’t need spiders or cron by default**. The product is designed for **on-demand** import: when the user picks a timeframe and (optionally) repos, we fetch from GitHub at that moment.

## On-demand (current)

- **CLI:** Run the collector when you want fresh data:
  ```bash
  GITHUB_TOKEN=ghp_xxx yarn collect --start 2025-01-01 --end 2025-12-31 --output raw.json
  node scripts/normalize.js --input raw.json --output evidence.json
  yarn generate evidence.json
  ```
- **App (future):** “Import” or “Refresh” in the UI will call the same logic: fetch for the selected range, then normalize and optionally cache in the backend.

No scheduled jobs required.

## Optional: periodic refresh

If you want data to be **pre-fetched** so the app feels “always up to date”:

1. **Store** connected users and their tokens (encrypted) and optionally last sync time.
2. **Run a job** on a schedule (e.g. cron, Vercel Cron, GitHub Actions, or a worker):
   - For each user (or only “active” in last 30 days), call the same fetch + normalize logic.
   - Save the latest `evidence.json` (or summary) per user so the app can show “Last synced: …” and use cached data when they open “Generate.”

That job is the “spider/agent” that runs every so often. The **collector script** (`scripts/collect-github.js`) is the building block: run it on-demand from the CLI or from a cron that iterates over users and passes their token.

## Summary

| Mode        | When to use                         | What runs                          |
|------------|--------------------------------------|------------------------------------|
| **On-demand** | Default; user clicks Import/Refresh | Collector + normalizer when user asks |
| **Periodic**  | Optional; “always fresh” UX         | Cron/worker that runs collector for each connected user |

You can add periodic later without changing the on-demand flow.
