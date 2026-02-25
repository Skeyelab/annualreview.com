import { describe, it, expect } from "vitest";
import { validateEvidence } from "../lib/validate-evidence.js";

describe("validateEvidence", () => {
  it("accepts valid evidence with timeframe and contributions", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "r#1", type: "pull_request", title: "Fix", url: "https://github.com/a/b/pull/1", repo: "a/b" },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts evidence with optional role_context_optional", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      role_context_optional: { level: "Senior", focus_areas: ["Backend"] },
      contributions: [],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts evidence with optional goals", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      goals: "Improve system reliability\nGrow as a technical leader",
      contributions: [],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects evidence with non-string goals", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      goals: ["goal 1", "goal 2"],
      contributions: [],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects missing timeframe", () => {
    const result = validateEvidence({ contributions: [] });
    expect(result.valid).toBe(false);
    expect("errors" in result && result.errors.length).toBeGreaterThan(0);
  });

  it("rejects missing contributions", () => {
    const result = validateEvidence({ timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" } });
    expect(result.valid).toBe(false);
  });

  it("rejects contribution with invalid type", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "r#1", type: "invalid", title: "x", url: "https://x", repo: "a/b" },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts contribution with source field", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "r#1", type: "pull_request", title: "Fix", url: "https://github.com/a/b/pull/1", repo: "a/b", source: "github" },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts Slack contribution without repo", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "slack#C123#1234567890.123456", type: "slack_message", title: "Answered questions in #onboarding", url: "https://slack.com/archives/C123/p1234567890123456", source: "slack", channel: "C123" },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts Jira contribution with project field", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "jira#PROJ-123", type: "jira_issue", title: "Resolve incident", url: "https://jira.example.com/browse/PROJ-123", source: "jira", project: "PROJ" },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts contribution with meta field", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "slack#C123#ts", type: "slack_thread", title: "Led incident thread", url: "https://slack.com/archives/C123/p123", source: "slack", channel: "C123", meta: { thread_ts: "1234567890.123456", reply_count: 5 } },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects contribution with unknown source value", () => {
    const result = validateEvidence({
      timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
      contributions: [
        { id: "r#1", type: "pull_request", title: "Fix", url: "https://github.com/a/b/pull/1", repo: "a/b", source: "unknown_source" },
      ],
    });
    expect(result.valid).toBe(false);
  });
});
