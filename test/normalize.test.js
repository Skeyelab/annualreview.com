import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { normalize } from "../scripts/normalize.js";

describe("normalize", () => {
  it("outputs timeframe and contributions from empty raw", () => {
    const evidence = normalize({}, null, null);
    expect(evidence.timeframe).toBeDefined();
    expect(evidence.contributions).toBeInstanceOf(Array);
    expect(evidence.contributions).toHaveLength(0);
  });

  it("normalizes one PR into evidence contribution", () => {
    const raw = {
      pull_requests: [
        {
          number: 42,
          title: "Add feature",
          html_url: "https://github.com/org/repo/pull/42",
          base: { repo: { full_name: "org/repo" } },
          merged_at: "2025-06-01T12:00:00Z",
          labels: [{ name: "feature" }],
          changed_files: 3,
          additions: 100,
          deletions: 20,
          body: "Summary",
          review_comments: 2,
        },
      ],
    };
    const evidence = normalize(raw, null, null);
    expect(evidence.contributions).toHaveLength(1);
    const c = evidence.contributions[0];
    expect(c.type).toBe("pull_request");
    expect(c.id).toBe("org/repo#42");
    expect(c.title).toBe("Add feature");
    expect(c.repo).toBe("org/repo");
    expect(c.merged_at).toBe("2025-06-01T12:00:00Z");
    expect(c.labels[0]).toBe("feature");
    expect(c.files_changed).toBe(3);
    expect(c.additions).toBe(100);
    expect(c.deletions).toBe(20);
  });

  it("filters PRs by start/end date", () => {
    const raw = {
      pull_requests: [
        { number: 1, merged_at: "2025-01-01T00:00:00Z", base: { repo: { full_name: "org/r" } }, title: "A", html_url: "https://x", labels: [] },
        { number: 2, merged_at: "2025-07-15T12:00:00Z", base: { repo: { full_name: "org/r" } }, title: "B", html_url: "https://x", labels: [] },
      ],
    };
    const evidence = normalize(raw, "2025-06-01", "2025-12-31");
    expect(evidence.contributions).toHaveLength(1);
    expect(evidence.contributions[0].id).toBe("org/r#2");
  });

  it("squashes commits that belong to PRs", () => {
    const raw = {
      pull_requests: [
        { number: 1, merged_at: "2025-06-01T00:00:00Z", base: { repo: { full_name: "org/r" } }, title: "PR", html_url: "https://x", labels: [], commits: [{ sha: "abc1234" }] },
      ],
      commits: [
        { sha: "abc1234", repository: { full_name: "org/r" }, commit: { author: { date: "2025-06-01T00:00:00Z" }, message: "fix" } },
      ],
    };
    const evidence = normalize(raw, null, null);
    const prs = evidence.contributions.filter((c) => c.type === "pull_request");
    const issues = evidence.contributions.filter((c) => c.type === "issue");
    expect(prs).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  it("keeps orphan commits as issue contributions", () => {
    const raw = {
      commits: [
        { sha: "deadbeef", repository: { full_name: "org/r" }, commit: { author: { date: "2025-06-01T00:00:00Z" }, message: "direct commit" } },
      ],
    };
    const evidence = normalize(raw, null, null);
    expect(evidence.contributions).toHaveLength(1);
    expect(evidence.contributions[0].type).toBe("issue");
    expect(evidence.contributions[0].id).toBe("org/r#deadbee");
  });
});

describe("normalize CLI", () => {
  it("reads raw file and writes evidence.json", () => {
    const dir = join(tmpdir(), randomUUID());
    mkdirSync(dir, { recursive: true });
    const rawPath = join(dir, "raw.json");
    const outPath = join(dir, "evidence.json");
    writeFileSync(
      rawPath,
      JSON.stringify({
        pull_requests: [
          { number: 1, title: "PR", html_url: "https://github.com/a/b/pull/1", base: { repo: { full_name: "a/b" } }, merged_at: null, labels: [], body: "" },
        ],
      })
    );
    execSync(`node scripts/normalize.js --input ${rawPath} --output ${outPath}`, { cwd: join(process.cwd()) });
    const evidence = JSON.parse(readFileSync(outPath, "utf8"));
    expect(evidence.contributions).toHaveLength(1);
    expect(evidence.contributions[0].id).toBe("a/b#1");
    rmSync(dir, { recursive: true });
  });
});
