TASK: Cluster GitHub contributions into meaningful annual-review themes.

INPUT:
You will receive JSON with:
- timeframe {start_date, end_date}
- role_context (optional) {level, job_family, focus_areas}
- contributions: array of items with fields:
  { id, type, title, url, repo, merged_at, labels, files_changed, additions, deletions,
    summary, body, linked_issues, review_comments_count, approvals_count }

OUTPUT (valid JSON only) with this schema:
{
  "themes": [
    {
      "theme_id": "string",
      "theme_name": "string",
      "one_liner": "string",
      "why_it_matters": "string",
      "evidence_ids": ["string"],
      "anchor_evidence": [
        { "id": "string", "url": "string", "title": "string", "repo": "string" }
      ],
      "confidence": "high|medium|low",
      "notes_or_assumptions": "string"
    }
  ],
  "missing_info_questions": ["string"]
}

RULES:
- 4–8 themes max.
- Themes must be human-readable (e.g., “Reliability & incident response”, “Developer experience”, “Performance/cost”, “Feature delivery”, “Security”, “Data/ingest”, “Architecture & refactors”).
- Each theme needs 3–12 evidence_ids (unless low volume).
- If a theme is based on only 1–2 items, set confidence=low and say why.
- Generate missing_info_questions when impact is implied but not proven in evidence.
