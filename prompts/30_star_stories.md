TASK: Produce 2–3 deeper “impact stories” in STAR format for the strongest themes.

INPUT JSON:
{
  "timeframe": {...},
  "goals": "optional annual goals, one per line",
  "themes": [...],
  "bullets_by_theme": [...],
  "contributions": [...]
}

OUTPUT (valid JSON only):
{
  "stories": [
    {
      "title": "string",
      "theme_id": "string",
      "situation": "string",
      "task": "string",
      "actions": ["string", "string", "string"],
      "results": ["string", "string"],
      "evidence": [{ "id": "string", "url": "string", "title": "string" }],
      "confidence": "high|medium|low",
      "missing_info_questions": ["string"]
    }
  ]
}

RULES:
- If goals are provided, prefer stories from themes that most directly support those goals.
- 2–3 stories total.
- Keep situation/task concise; focus on actions/results.
- Results must be evidenced; if not, mark as “Potential result (confirm)”.
- Evidence list must include anchor PR(s) for the story.
