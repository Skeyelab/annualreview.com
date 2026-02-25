/**
 * Four-step pipeline: evidence JSON → themes → bullets → STAR stories → self_eval.
 * Each step uses one prompt from prompts/ and passes previous outputs forward. Needs OPENAI_API_KEY.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { fitEvidenceToBudget } from "./context-budget.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "prompts");

function loadPrompt(name) {
  return readFileSync(join(PROMPTS_DIR, name), "utf8").trim();
}

/** Pull first {...} from LLM response text and parse as JSON. */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end));
}

const STEPS = [
  { key: "themes", label: "Themes" },
  { key: "bullets", label: "Impact bullets" },
  { key: "stories", label: "STAR stories" },
  { key: "self_eval", label: "Self-eval sections" },
];

export async function runPipeline(evidence, { apiKey = process.env.OPENAI_API_KEY, model = "gpt-4o-mini", onProgress } = {}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  const openai = new OpenAI({ apiKey });

  const system = loadPrompt("00_system.md");
  const prompt10 = loadPrompt("10_theme_cluster.md");
  const prompt20 = loadPrompt("20_impact_bullets.md");
  const prompt30 = loadPrompt("30_star_stories.md");
  const prompt40 = loadPrompt("40_self_eval_sections.md");

  const total = STEPS.length;
  function progress(stepIndex, label) {
    if (typeof onProgress === "function") onProgress({ stepIndex, total, step: STEPS[stepIndex - 1].key, label: label || STEPS[stepIndex - 1].label });
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
  const input1 = payloadForStep1(evidence);
  const res1 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${prompt10}\n\nINPUT JSON:\n${input1}` },
    ],
  });
  const themes = extractJson(res1.choices[0]?.message?.content ?? "{}");
  // Step 2: impact bullets (from themes + contributions)
  progress(2);
  const input2 = JSON.stringify(
    { timeframe: evidence.timeframe, themes, contributions: evidence.contributions },
    null,
    2
  );
  const res2 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${prompt20}\n\nINPUT JSON:\n${input2}` },
    ],
  });
  const bullets = extractJson(res2.choices[0]?.message?.content ?? "{}");
  // Step 3: STAR stories
  progress(3);
  const input3 = JSON.stringify(
    { timeframe: evidence.timeframe, themes, bullets_by_theme: bullets.bullets_by_theme, contributions: evidence.contributions },
    null,
    2
  );
  const res3 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${prompt30}\n\nINPUT JSON:\n${input3}` },
    ],
  });
  const stories = extractJson(res3.choices[0]?.message?.content ?? "{}");
  // Step 4: self-eval sections
  progress(4);
  const input4 = JSON.stringify({
    timeframe: evidence.timeframe,
    role_context_optional: evidence.role_context_optional,
    themes,
    top_10_bullets_overall: bullets.top_10_bullets_overall ?? [],
    stories: stories.stories ?? [],
    contributions: evidence.contributions,
  }, null, 2);
  const res4 = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${prompt40}\n\nINPUT JSON:\n${input4}` },
    ],
  });
  const self_eval = extractJson(res4.choices[0]?.message?.content ?? "{}");

  return { themes, bullets, stories, self_eval };
}
