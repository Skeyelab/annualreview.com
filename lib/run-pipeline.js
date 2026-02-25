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
const PROMPT_10 = loadPrompt("10_theme_cluster.md");
const PROMPT_20 = loadPrompt("20_impact_bullets.md");
const PROMPT_30 = loadPrompt("30_star_stories.md");
const PROMPT_40 = loadPrompt("40_self_eval_sections.md");

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

const STEPS = [
  { key: "themes", label: "Themes" },
  { key: "bullets", label: "Impact bullets" },
  { key: "stories", label: "STAR stories" },
  { key: "self_eval", label: "Self-eval sections" },
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

  // Keep payload under model context limit (e.g. 128k); slim contributions if needed
  const payloadForStep1 = (ev) =>
    JSON.stringify(
      { timeframe: ev.timeframe, role_context_optional: ev.role_context_optional, contributions: ev.contributions },
      null,
      2
    );
  evidence = fitEvidenceToBudget(evidence, payloadForStep1);

  // Step 1: cluster contributions into themes
  progress(1);
  const step1Start = Date.now();
  const input1 = payloadForStep1(evidence);
  const res1 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${PROMPT_10}\n\nINPUT JSON:\n${input1}` },
    ],
    ...posthogOpts,
  });
  const themes = extractJson(res1.choices[0]?.message?.content ?? "{}");
  const step1Ms = Date.now() - step1Start;
  const step1Tokens = estimateTokens(input1);

  // Step 2: themes + slimmed contributions (cached once for steps 2–4)
  const slimmedContributions = slimContributions(evidence.contributions, {
    bodyChars: 400,
    summaryChars: 500,
  });
  progress(2, undefined, { prevStepMs: step1Ms, prevStepPayloadTokens: step1Tokens });
  const step2Start = Date.now();
  const input2 = JSON.stringify(
    { timeframe: evidence.timeframe, themes, contributions: slimmedContributions },
    null,
    2
  );
  const res2 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${PROMPT_20}\n\nINPUT JSON:\n${input2}` },
    ],
    ...posthogOpts,
  });
  const bullets = extractJson(res2.choices[0]?.message?.content ?? "{}");
  const step2Ms = Date.now() - step2Start;
  const step2Tokens = estimateTokens(input2);

  // Step 3: themes + bullets + only evidence-referenced contributions
  const idsStep3 = collectEvidenceIds(themes, bullets);
  const contributionsStep3 = contributionsForPayload(evidence.contributions, idsStep3, {
    bodyChars: 300,
    summaryChars: 400,
  });
  progress(3, undefined, { prevStepMs: step2Ms, prevStepPayloadTokens: step2Tokens });
  const step3Start = Date.now();
  const input3 = JSON.stringify(
    {
      timeframe: evidence.timeframe,
      themes,
      bullets_by_theme: bullets.bullets_by_theme,
      contributions: contributionsStep3,
    },
    null,
    2
  );
  const res3 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${PROMPT_30}\n\nINPUT JSON:\n${input3}` },
    ],
    ...posthogOpts,
  });
  const stories = extractJson(res3.choices[0]?.message?.content ?? "{}");
  const step3Ms = Date.now() - step3Start;
  const step3Tokens = estimateTokens(input3);

  // Step 4: themes + top bullets + stories + role context; minimal contributions for citations only
  const idsStep4 = collectEvidenceIds(themes, bullets, stories);
  const contributionsStep4 = contributionsForPayload(evidence.contributions, idsStep4, {
    minimal: true,
  });
  progress(4, undefined, { prevStepMs: step3Ms, prevStepPayloadTokens: step3Tokens });
  const step4Start = Date.now();
  const input4 = JSON.stringify(
    {
      timeframe: evidence.timeframe,
      role_context_optional: evidence.role_context_optional,
      themes,
      top_10_bullets_overall: bullets.top_10_bullets_overall ?? [],
      stories: stories.stories ?? [],
      contributions: contributionsStep4,
    },
    null,
    2
  );
  const res4 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${PROMPT_40}\n\nINPUT JSON:\n${input4}` },
    ],
    ...posthogOpts,
  });
  const self_eval = extractJson(res4.choices[0]?.message?.content ?? "{}");
  const step4Ms = Date.now() - step4Start;
  const totalMs = Date.now() - totalStart;
  progress(4, undefined, {
    prevStepMs: step4Ms,
    prevStepPayloadTokens: estimateTokens(input4),
    totalMs,
  });

  const result = { themes, bullets, stories, self_eval };
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
