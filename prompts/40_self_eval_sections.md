TASK: Draft self-evaluation sections aligned to typical HR forms.

INPUT JSON:
{
  "timeframe": {...},
  "goals": "optional annual goals, one per line",
  "role_context_optional": {...},
  "themes": [...],
  "top_10_bullets_overall": [...],
  "stories": [...],
  "contributions": [...]
}

OUTPUT (valid JSON only):
{
  "sections": {
    "summary": {
      "text": "string",
      "evidence": [{ "id": "string", "url": "string" }]
    },
    "key_accomplishments": [
      { "text": "string", "evidence": [{ "id": "string", "url": "string" }] }
    ],
    "how_i_worked": {
      "text": "string",
      "evidence": [{ "id": "string", "url": "string" }]
    },
    "growth": {
      "text": "string",
      "evidence": [{ "id": "string", "url": "string" }]
    },
    "next_year_goals": [
      { "text": "string", "evidence": [{ "id": "string", "url": "string" }], "needs_user_input": ["string"] }
    ]
  },
  "missing_info_questions": ["string"]
}

RULES:
- If goals are provided, reference them in the summary and key_accomplishments to show alignment between work done and intended goals.
- Keep each section concise and form-friendly.
- Evidence should back claims; if evidence doesn’t exist, ask a question instead.
- Next year goals can be inferred from themes, but MUST ask for confirmation.
