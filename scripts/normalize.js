/**
 * Raw GitHub JSON → evidence JSON (AGENTS.md contract). Dedupes: commits under PRs are dropped; orphan commits kept.
 * CLI: node scripts/normalize.js [--input raw.json] [--output evidence.json] [--start/--end YYYY-MM-DD]
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseArgs as parseArgsBase } from "../lib/parse-args.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NORMALIZE_SCHEMA = {
  flags: [
    { name: "input", option: "--input", type: "string" },
    { name: "output", option: "--output", type: "string" },
    { name: "start", option: "--start", type: "string" },
    { name: "end", option: "--end", type: "string" },
  ],
};

function parseArgs(argv) {
  return parseArgsBase(NORMALIZE_SCHEMA, argv);
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(dateStr, start, end) {
  const d = parseDate(dateStr);
  if (!d) return false;
  if (start && parseDate(start) && d < parseDate(start)) return false;
  if (end && parseDate(end) && d > parseDate(end)) return false;
  return true;
}

function contributionId(repo, type, numberOrSha) {
  const slug = (repo || "").replace(/\/$/, "");
  return slug ? `${slug}#${numberOrSha}` : `#${numberOrSha}`;
}

/** Returns canonical contribution object (AGENTS.md contract) with defaults; overrides merge in. */
function createContribution(overrides = {}) {
  return {
    id: "",
    type: "",
    source: "github",
    title: "",
    url: "",
    repo: "",
    merged_at: null,
    labels: [],
    files_changed: 0,
    additions: 0,
    deletions: 0,
    summary: "",
    body: "",
    linked_issues: [],
    review_comments_count: 0,
    approvals_count: 0,
    ...overrides,
  };
}

function normalizePr(pr, repo) {
  const mergedAt = pr.merged_at || null;
  return createContribution({
    id: contributionId(repo, "pull_request", pr.number),
    type: "pull_request",
    title: pr.title || "",
    url: pr.html_url || pr.url || "",
    repo: repo || pr.base?.repo?.full_name || "",
    merged_at: mergedAt,
    labels: (pr.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
    files_changed: pr.changed_files ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    summary: (pr.body || "").slice(0, 500),
    body: pr.body || "",
    review_comments_count: pr.review_comments ?? 0,
  });
}

function normalizeReview(review, repo, pullNumber) {
  return createContribution({
    id: contributionId(repo, "review", `${pullNumber}-${review.id}`),
    type: "review",
    title: `Review: ${(review.body || "").slice(0, 60)}` || `Review #${review.id}`,
    url: review.html_url || review.url || "",
    repo: repo || "",
    summary: (review.body || "").slice(0, 500),
    body: review.body || "",
    approvals_count: review.state === "APPROVED" ? 1 : 0,
  });
}

function normalizeRelease(release, repo) {
  const publishedAt = release.published_at || release.created_at || null;
  return createContribution({
    id: contributionId(repo, "release", release.id ?? release.tag_name),
    type: "release",
    title: release.name || release.tag_name || "Release",
    url: release.html_url || release.url || "",
    repo: repo || release.target_commitish || "",
    merged_at: publishedAt,
    summary: (release.body || "").slice(0, 500),
    body: release.body || "",
  });
}

function normalizeCommit(commit, repo, sha) {
  const date = commit.author?.date || commit.committer?.date || commit.commit?.author?.date || null;
  const msg = commit.commit?.message || commit.message || "";
  return createContribution({
    id: contributionId(repo, "issue", (sha || "").slice(0, 7)),
    type: "issue",
    title: msg.split("\n")[0].slice(0, 200) || sha?.slice(0, 7) || "",
    url: commit.html_url || `https://github.com/${repo}/commit/${sha}`,
    repo: repo || "",
    merged_at: date,
    summary: msg.slice(0, 500),
    body: msg,
  });
}

// Schema allows pull_request|review|release|issue. Orphan commits → issue for simplicity.
function normalize(raw, start, end) {
  const contributions = [];
  const prNumbersByRepo = new Set(); // "owner/repo#123" for dedupe

  const rawPrs = raw.pull_requests || raw.pulls || raw.pull_requests_list || [];
  for (const pr of rawPrs) {
    const repo = pr.base?.repo?.full_name || pr.head?.repo?.full_name || raw.repo || "";
    const mergedAt = pr.merged_at || null;
    if (start || end) {
      const useDate = mergedAt || pr.created_at || pr.updated_at;
      if (!inRange(useDate, start, end)) continue;
    }
    prNumbersByRepo.add(`${repo}#${pr.number}`);
    contributions.push(normalizePr(pr, repo));
  }

  const rawReviews = raw.reviews || [];
  for (const r of rawReviews) {
    const repo = r.repository?.full_name || r.repo || raw.repo || "";
    const pullNumber = r.pull_request_url?.split("/").pop() || r.pull_number;
    const date = r.submitted_at || r.created_at;
    if (start || end) { if (!inRange(date, start, end)) continue; }
    contributions.push(normalizeReview(r, repo, pullNumber));
  }

  const rawReleases = raw.releases || [];
  for (const rel of rawReleases) {
    const repo = rel.target_commitish ? raw.repo : (rel.repository?.full_name || raw.repo || "");
    const date = rel.published_at || rel.created_at;
    if (start || end) { if (!inRange(date, start, end)) continue; }
    contributions.push(normalizeRelease(rel, repo));
  }

  const rawCommits = raw.commits || [];
  const commitShaToPr = new Map(); // optional: if raw has pull_requests, we know which commits belong to PRs
  for (const pr of rawPrs) {
    const shas = Array.isArray(pr.commits) ? pr.commits : [];
    for (const c of shas) {
      const sha = typeof c === "string" ? c : (c.sha || c.commit?.sha);
      if (sha) commitShaToPr.set(sha, true);
    }
  }
  for (const c of rawCommits) {
    const sha = c.sha || c.commit?.sha;
    const repo = c.repository?.full_name || raw.repo || "";
    const date = c.commit?.author?.date || c.commit?.committer?.date || c.author?.date;
    if (start || end) { if (!inRange(date, start, end)) continue; }
    if (commitShaToPr.has(sha)) continue; // squash: skip commit when it's part of a PR
    contributions.push(normalizeCommit(c.commit || c, repo, sha));
  }

  const startDate = start || raw.timeframe?.start_date || "2020-01-01";
  const endDate = end || raw.timeframe?.end_date || new Date().toISOString().slice(0, 10);
  return {
    timeframe: { start_date: startDate, end_date: endDate },
    role_context_optional: raw.role_context_optional || null,
    contributions,
  };
}

function main() {
  const { input, output, start, end } = parseArgs();
  const inputPath = input || join(process.cwd(), "raw-github.json");
  const outputPath = output || join(process.cwd(), "evidence.json");

  let raw;
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("Input file not found:", inputPath);
      console.error("Create raw-github.json with keys: pull_requests, reviews, releases, commits (see AGENTS.md).");
      process.exit(1);
    }
    throw e;
  }

  const evidence = normalize(raw, start, end);
  writeFileSync(outputPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log("Wrote", evidence.contributions.length, "contributions to", outputPath);
}

export { normalize };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
