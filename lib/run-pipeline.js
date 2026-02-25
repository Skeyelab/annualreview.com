/**
 * Four-step pipeline: evidence JSON → themes → bullets → STAR stories → self_eval.
 * Each step uses one prompt from prompts/ and passes previous outputs forward. Needs OPENAI_API_KEY.
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import { PostHog } from "posthog-node";
import { fitEvidenceToBudget, estimateTokens, slimContributions } from "./context-budget.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "prompts");

function loadPrompt(name) {
  return readFileSync(join(PROMPTS_DIR, name), "utf8").trim();
}

const SYSTEM_PROMPT = loadPrompt("00_system.md");

const RESULT_CACHE_MAX = 50;
const resultCache = new Map();

/** Clear result cache (for tests). */
export function clearPipelineCache() {
  resultCache.clear();
}

function cacheKey(evidence, model) {
  const str = JSON.stringify({ evidence, model });
  return createHash("sha256").update(str).digest("hex");
}

/** Pull first {...} from LLM response text and parse as JSON. */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end));
}

/** Collect all evidence ids referenced in themes and bullets (and optional stories). */
function collectEvidenceIds(themes, bullets, stories = null) {
  const ids = new Set();
  for (const t of themes?.themes ?? []) {
    for (const id of t.evidence_ids ?? []) ids.add(id);
    for (const a of t.anchor_evidence ?? []) if (a?.id) ids.add(a.id);
  }
  for (const g of bullets?.bullets_by_theme ?? []) {
    for (const b of g.bullets ?? []) {
      for (const e of b.evidence ?? []) if (e?.id) ids.add(e.id);
    }
  }
  for (const s of stories?.stories ?? []) {
    for (const e of s.evidence ?? []) if (e?.id) ids.add(e.id);
  }
  return ids;
}

/** Filter contributions to those whose id is in the set; return slimmed for payload. */
function contributionsForPayload(contributions, idSet, opts = {}) {
  const byId = new Map(contributions.map((c) => [c.id, c]));
  const subset = idSet.size > 0
    ? [...idSet].map((id) => byId.get(id)).filter(Boolean)
    : contributions;
  return slimContributions(subset, opts);
}

/** Declarative pipeline steps: key, label, prompt file, and buildInput(evidence, previousResults). */
const STEPS = [
  {
    key: "themes",
    label: "Themes",
    promptFile: "10_theme_cluster.md",
    buildInput(evidence) {
      return JSON.stringify(
        { timeframe: evidence.timeframe, role_context_optional: evidence.role_context_optional, contributions: evidence.contributions },
        null,
        2
      );
    },
  },
  {
    key: "bullets",
    label: "Impact bullets",
    promptFile: "20_impact_bullets.md",
    buildInput(evidence, prev) {
      const slimmed = slimContributions(evidence.contributions, { bodyChars: 400, summaryChars: 500 });
      return JSON.stringify(
        { timeframe: evidence.timeframe, themes: prev.themes, contributions: slimmed },
        null,
        2
      );
    },
  },
  {
    key: "stories",
    label: "STAR stories",
    promptFile: "30_star_stories.md",
    buildInput(evidence, prev) {
      const ids = collectEvidenceIds(prev.themes, prev.bullets);
      const contribs = contributionsForPayload(evidence.contributions, ids, { bodyChars: 300, summaryChars: 400 });
      return JSON.stringify(
        {
          timeframe: evidence.timeframe,
          themes: prev.themes,
          bullets_by_theme: prev.bullets.bullets_by_theme,
          contributions: contribs,
        },
        null,
        2
      );
    },
  },
  {
    key: "self_eval",
    label: "Self-eval sections",
    promptFile: "40_self_eval_sections.md",
    buildInput(evidence, prev) {
      const ids = collectEvidenceIds(prev.themes, prev.bullets, prev.stories);
      const contribs = contributionsForPayload(evidence.contributions, ids, { minimal: true });
      return JSON.stringify(
        {
          timeframe: evidence.timeframe,
          role_context_optional: evidence.role_context_optional,
          themes: prev.themes,
          top_10_bullets_overall: prev.bullets.top_10_bullets_overall ?? [],
          stories: prev.stories.stories ?? [],
          contributions: contribs,
        },
        null,
        2
      );
    },
  },
];

export async function runPipeline(evidence, {
  apiKey = process.env.OPENAI_API_KEY,
  model = "gpt-4o-mini",
  onProgress,
  posthogTraceId,
  posthogDistinctId,
} = {}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY required");

  const key = cacheKey(evidence, model);
  const cached = resultCache.get(key);
  if (cached) {
    if (typeof onProgress === "function") {
      for (let i = 1; i <= STEPS.length; i++) {
        onProgress({
          stepIndex: i,
          total: STEPS.length,
          step: STEPS[i - 1].key,
          label: STEPS[i - 1].label,
        });
      }
    }
    return cached;
  }

  const phKey = process.env.POSTHOG_API_KEY;
  const phClient = phKey
    ? new PostHog(phKey, { host: process.env.POSTHOG_HOST || "https://us.i.posthog.com" })
    : null;
  const openai = phClient
    ? new PostHogOpenAI({ apiKey, posthog: phClient })
    : new OpenAI({ apiKey });

  const total = STEPS.length;
  const posthogOpts = {};
  if (posthogTraceId != null) posthogOpts.posthogTraceId = posthogTraceId;
  if (posthogDistinctId != null) posthogOpts.posthogDistinctId = posthogDistinctId;

  try {
  const totalStart = Date.now();
  function progress(stepIndex, label, extra = {}) {
    if (typeof onProgress === "function") {
      onProgress({
        stepIndex,
        total,
        step: STEPS[stepIndex - 1].key,
        label: label || STEPS[stepIndex - 1].label,
        ...extra,
      });
    }
  }

  evidence = fitEvidenceToBudget(evidence, (ev) => STEPS[0].buildInput(ev, {}));

  let previousResults = {};
  let prevStepMs;
  let prevStepPayloadTokens;

  for (let stepIndex = 1; stepIndex <= total; stepIndex++) {
    const step = STEPS[stepIndex - 1];
    progress(stepIndex, undefined, stepIndex === 1 ? {} : { prevStepMs, prevStepPayloadTokens });

    const stepStart = Date.now();
    const input = step.buildInput(evidence, previousResults);
    const promptContent = loadPrompt(step.promptFile);
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${promptContent}\n\nINPUT JSON:\n${input}` },
      ],
      ...posthogOpts,
    });
    const stepResult = extractJson(res.choices[0]?.message?.content ?? "{}");
    previousResults[step.key] = stepResult;
    prevStepMs = Date.now() - stepStart;
    prevStepPayloadTokens = estimateTokens(input);
  }

  progress(total, undefined, { prevStepMs, prevStepPayloadTokens, totalMs: Date.now() - totalStart });

  const result = {
    themes: previousResults.themes,
    bullets: previousResults.bullets,
    stories: previousResults.stories,
    self_eval: previousResults.self_eval,
  };
  if (resultCache.size >= RESULT_CACHE_MAX) {
    const firstKey = resultCache.keys().next().value;
    if (firstKey !== undefined) resultCache.delete(firstKey);
  }
  resultCache.set(key, result);
  return result;
  } finally {
    if (phClient) await phClient.shutdown();
  }
}
