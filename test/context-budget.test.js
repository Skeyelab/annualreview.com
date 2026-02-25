import { describe, it, expect } from "vitest";
import { estimateTokens, slimContributions, fitEvidenceToBudget } from "../lib/context-budget.js";

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("aaaa")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("returns 0 for non-string", () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });
});

describe("slimContributions", () => {
  it("keeps core fields and truncates long body/summary", () => {
    const contributions = [
      {
        id: "r#1",
        type: "pull_request",
        title: "Fix bug",
        url: "https://github.com/a/b/pull/1",
        repo: "a/b",
        body: "x".repeat(1000),
        summary: "y".repeat(600),
      },
    ];
    const out = slimContributions(contributions, { bodyChars: 100, summaryChars: 50 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("r#1");
    expect(out[0].body).toBeUndefined();
    expect(out[0].body_preview).toBe("x".repeat(100) + "...");
    expect(out[0].summary).toBe("y".repeat(50) + "...");
  });

  it("leaves short body/summary unchanged when under limit", () => {
    const contributions = [{ id: "r#1", title: "T", body: "short", summary: "brief" }];
    const out = slimContributions(contributions, { bodyChars: 400, summaryChars: 400 });
    expect(out[0].body_preview).toBe("short");
    expect(out[0].summary).toBe("brief");
  });

  it("caps labels and linked_issues", () => {
    const contributions = [
      {
        id: "r#1",
        labels: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
        linked_issues: ["i1", "i2", "i3", "i4", "i5", "i6"],
      },
    ];
    const out = slimContributions(contributions, {});
    expect(out[0].labels).toHaveLength(8);
    expect(out[0].linked_issues).toHaveLength(5);
  });

  it("minimal keeps only id, type, title, url, repo, merged_at, summary", () => {
    const contributions = [
      {
        id: "r#1",
        type: "pull_request",
        title: "Fix",
        url: "https://x/y",
        repo: "x/y",
        merged_at: "2025-01-01",
        summary: "Did the thing",
        body: "long body",
        labels: ["bug"],
      },
    ];
    const out = slimContributions(contributions, { minimal: true });
    expect(out[0]).toEqual({
      id: "r#1",
      type: "pull_request",
      title: "Fix",
      url: "https://x/y",
      repo: "x/y",
      merged_at: "2025-01-01",
      summary: "Did the thing",
    });
    expect(out[0].body_preview).toBeUndefined();
    expect(out[0].labels).toBeUndefined();
  });
});

describe("fitEvidenceToBudget", () => {
  it("returns evidence unchanged when payload is under budget", () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [{ id: "r#1", title: "Small" }],
    };
    const getPayload = (ev) => JSON.stringify(ev);
    const fitted = fitEvidenceToBudget(evidence, getPayload, 10_000);
    expect(fitted.contributions).toHaveLength(1);
    expect(fitted.contributions[0].title).toBe("Small");
  });

  it("slims contributions when payload exceeds budget", () => {
    const evidence = {
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: Array.from({ length: 5 }, (_, i) => ({
        id: `r#${i}`,
        type: "pull_request",
        title: "PR",
        url: "https://x/y",
        repo: "x/y",
        body: "z".repeat(2000),
        summary: "s".repeat(800),
      })),
    };
    const getPayload = (ev) => JSON.stringify(ev);
    const fitted = fitEvidenceToBudget(evidence, getPayload, 1200);
    expect(estimateTokens(getPayload(fitted))).toBeLessThanOrEqual(1200);
    expect(fitted.contributions[0].body).toBeUndefined();
    expect(fitted.contributions[0].body_preview).toBeDefined();
  });
});
