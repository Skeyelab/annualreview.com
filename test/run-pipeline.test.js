import { describe, it, expect, vi } from "vitest";
import { extractJson, runPipeline, clearPipelineCache } from "../lib/run-pipeline.js";

const mockThemes = { themes: [{ theme_id: "t1", theme_name: "Reliability" }] };
const mockBullets = { bullets_by_theme: [], top_10_bullets_overall: [] };
const mockStories = { stories: [] };
const mockSelfEval = { sections: { summary: { text: "Done" } } };

let createCallCount = 0;
let lastCreateArgs = [];
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
      create: (args) => {
        createCallCount++;
        lastCreateArgs.push(args);
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
    lastCreateArgs = [];
    clearPipelineCache();
    process.env.POSTHOG_API_KEY = "ph_test";
  });

  it("throws when both OPENAI_API_KEY and OPENROUTER_API_KEY are missing", async () => {
    const origOAI = process.env.OPENAI_API_KEY;
    const origOR = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      await expect(runPipeline({ timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" }, contributions: [] })).rejects.toThrow("OPENAI_API_KEY or OPENROUTER_API_KEY required");
    } finally {
      if (origOAI !== undefined) process.env.OPENAI_API_KEY = origOAI;
      if (origOR !== undefined) process.env.OPENROUTER_API_KEY = origOR;
    }
  });

  it("uses OPENROUTER_API_KEY with OpenRouter base URL when provided", async () => {
    const origOR = process.env.OPENROUTER_API_KEY;
    const origOAI = process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    delete process.env.OPENAI_API_KEY;
    try {
      const evidence = {
        timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
        contributions: [],
      };
      const result = await runPipeline(evidence);
      expect(result).toEqual({ themes: mockThemes, bullets: mockBullets, stories: mockStories, self_eval: mockSelfEval });
    } finally {
      if (origOR !== undefined) process.env.OPENROUTER_API_KEY = origOR;
      else delete process.env.OPENROUTER_API_KEY;
      if (origOAI !== undefined) process.env.OPENAI_API_KEY = origOAI;
    }
  });

  it("sets posthogProviderOverride=openrouter when PostHog and OpenRouter are both active", async () => {
    const origOR = process.env.OPENROUTER_API_KEY;
    const origOAI = process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    delete process.env.OPENAI_API_KEY;
    try {
      await runPipeline({ timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" }, contributions: [] });
      expect(lastCreateArgs.length).toBe(4);
      for (const args of lastCreateArgs) {
        expect(args).toMatchObject({ posthogProviderOverride: "openrouter" });
      }
    } finally {
      if (origOR !== undefined) process.env.OPENROUTER_API_KEY = origOR;
      else delete process.env.OPENROUTER_API_KEY;
      if (origOAI !== undefined) process.env.OPENAI_API_KEY = origOAI;
    }
  });

  it("does not set posthogProviderOverride when using OpenAI directly", async () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [],
    };
    await runPipeline(evidence, { apiKey: "sk-test" });
    for (const args of lastCreateArgs) {
      expect(args).not.toHaveProperty("posthogProviderOverride");
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

  it("passes goals through to pipeline when provided", async () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      goals: "Improve reliability\nGrow as a technical leader",
      contributions: [],
    };
    const result = await runPipeline(evidence, { apiKey: "sk-test" });
    expect(result).toEqual({ themes: mockThemes, bullets: mockBullets, stories: mockStories, self_eval: mockSelfEval });
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
