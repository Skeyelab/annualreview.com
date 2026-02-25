import { describe, it, expect, vi } from "vitest";
import { extractJson, runPipeline, clearPipelineCache } from "../lib/run-pipeline.js";

const mockThemes = { themes: [{ theme_id: "t1", theme_name: "Reliability" }] };
const mockBullets = { bullets_by_theme: [], top_10_bullets_overall: [] };
const mockStories = { stories: [] };
const mockSelfEval = { sections: { summary: { text: "Done" } } };

let createCallCount = 0;
function MockOpenAI() {
  const contents = [
    JSON.stringify(mockThemes),
    JSON.stringify(mockBullets),
    JSON.stringify(mockStories),
    JSON.stringify(mockSelfEval),
  ];
  let i = 0;
  this.chat = {
    completions: {
      create: () => {
        createCallCount++;
        return Promise.resolve({ choices: [{ message: { content: contents[i++ % 4] } }] });
      },
    },
  };
}
vi.mock("@posthog/ai/openai", () => ({ OpenAI: MockOpenAI }));
vi.mock("posthog-node", () => ({
  PostHog: function MockPostHog() {
    this.shutdown = () => Promise.resolve();
  },
}));

describe("extractJson", () => {
  it("extracts a single JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips leading and trailing text", () => {
    expect(extractJson("Here is the result:\n{\"themes\":[]}\nDone.")).toEqual({ themes: [] });
  });

  it("uses first { and last } for nested object", () => {
    expect(extractJson("x{\"nested\":{\"b\":2}}y")).toEqual({ nested: { b: 2 } });
  });

  it("throws when no object found", () => {
    expect(() => extractJson("no json here")).toThrow("No JSON object");
  });
});

describe("runPipeline", () => {
  beforeEach(() => {
    createCallCount = 0;
    clearPipelineCache();
    process.env.POSTHOG_API_KEY = "ph_test";
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    const orig = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(runPipeline({ timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" }, contributions: [] })).rejects.toThrow("OPENAI_API_KEY");
    } finally {
      if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
    }
  });

  it("returns themes, bullets, stories, self_eval with mocked OpenAI", async () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [],
    };
    const result = await runPipeline(evidence, { apiKey: "sk-test" });
    expect(result).toEqual({ themes: mockThemes, bullets: mockBullets, stories: mockStories, self_eval: mockSelfEval });
    expect(createCallCount).toBe(4);
  });

  it("cache hit returns same output shape without calling OpenAI again", async () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [],
    };
    const result1 = await runPipeline(evidence, { apiKey: "sk-test" });
    const result2 = await runPipeline(evidence, { apiKey: "sk-test" });
    expect(result1).toEqual(result2);
    expect(result2).toEqual({ themes: mockThemes, bullets: mockBullets, stories: mockStories, self_eval: mockSelfEval });
    expect(createCallCount).toBe(4);
  });

  it("step 2 payload uses slimmed contributions", async () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "r#1", type: "pull_request", title: "T", url: "https://x/y", repo: "x/y", body: "long body", summary: "s" },
      ],
    };
    await runPipeline(evidence, { apiKey: "sk-test" });
    expect(createCallCount).toBe(4);
  });
});
