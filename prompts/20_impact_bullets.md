TASK: Write impact-focused annual review bullets from theme clusters + evidence.

INPUT JSON:
{
  "timeframe": {...},
  "goals": "optional annual goals, one per line",
  "themes": [... from previous step ...],
  "contributions": [... same as before ...],
  "user_context_optional": {
    "preferred_tone": "direct|confident|humble",
    "target_format": "workday|lattice|generic",
    "word_limit_per_bullet": 28
  }
}

OUTPUT (valid JSON only):
{
  "bullets_by_theme": [
    {
      "theme_id": "string",
      "bullets": [
        {
          "text": "string",
          "evidence": [{ "id": "string", "url": "string" }],
          "impact_level": "high|medium|low",
          "impact_type": ["reliability|velocity|quality|security|cost|customer_value|enablement|leadership"],
          "confidence": "high|medium|low",
          "needs_user_confirmation": ["string"]
        }
      ]
    }
  ],
  "top_10_bullets_overall": [
    { "text": "string", "evidence": [{ "id": "string", "url": "string" }], "theme_id": "string" }
  ],
  "missing_info_questions": ["string"]
}

BULLET WRITING RULES:
- If goals are provided, prioritize bullets from themes that align with those goals, and note goal alignment when present.
- Each bullet: “Did X so that Y” (action → outcome). If outcome not proven, write:
  “Did X (outcome likely: Y; confirm?)”
- Avoid vanity metrics. Don’t fabricate numbers.
- Mention cross-team / leverage when supported (e.g., tooling adopted, CI improvements).
- Every bullet must cite 1–3 evidence items.
- 2–5 bullets per theme.
