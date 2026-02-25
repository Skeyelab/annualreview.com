/**
 * On-demand collector: fetch current user's PRs (and optionally reviews) from GitHub for a date range.
 * Outputs raw JSON in the shape expected by the normalizer (pull_requests, reviews).
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/collect-github.js --start 2025-01-01 --end 2025-12-31 [--output raw.json] [--no-reviews]
 *
 * Requires: GITHUB_TOKEN with repo scope (or public_repo for public only).
 */

import { writeFileSync } from "fs";
import { join } from "path";

const GITHUB_API = "https://api.github.com";
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN required");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github.v3+json",
  Authorization: `Bearer ${token}`,
};

function parseArgs() {
  const args = process.argv.slice(2);
  let start = null, end = null, output = null, noReviews = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && args[i + 1]) start = args[++i];
    else if (args[i] === "--end" && args[i + 1]) end = args[++i];
    else if (args[i] === "--output" && args[i + 1]) output = args[++i];
    else if (args[i] === "--no-reviews") noReviews = true;
  }
  return { start, end, output, noReviews };
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchSearchIssues(q, maxPages = 10) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&page=${page}&per_page=100`;
    const data = await fetchJson(url);
    const items = data.items ?? [];
    if (items.length === 0) break;
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

async function main() {
  const { start, end, output, noReviews } = parseArgs();
  if (!start || !end) {
    console.error("--start YYYY-MM-DD and --end YYYY-MM-DD required");
    process.exit(1);
  }

  const user = await fetchJson(`${GITHUB_API}/user`);
  const login = user.login;
  const q = `author:${login} type:pr created:${start}..${end}`;
  console.error("Fetching PRs:", q);

  const issues = await fetchSearchIssues(q, 5);
  const prs = issues.filter((i) => i.pull_request);

  const pull_requests = [];
  for (const issue of prs) {
    const prUrl = issue.pull_request.url.replace("https://api.github.com/", `${GITHUB_API}/`);
    const pr = await fetchJson(prUrl);
    pull_requests.push(pr);
  }

  let reviews = [];
  if (!noReviews && pull_requests.length > 0) {
    console.error("Fetching reviews for", pull_requests.length, "PRs...");
    for (const pr of pull_requests) {
      const [owner, repo] = pr.base.repo.full_name.split("/");
      const r = await fetchJson(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${pr.number}/reviews`);
      for (const rev of r) {
        reviews.push({ ...rev, repository: { full_name: `${owner}/${repo}` }, pull_number: pr.number });
      }
    }
  }

  const raw = {
    timeframe: { start_date: start, end_date: end },
    pull_requests,
    reviews,
  };

  const json = JSON.stringify(raw, null, 2);
  if (output) {
    writeFileSync(output, json);
    console.error("Wrote", output);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
