/**
 * Fetch the current user's PRs and reviews from GitHub for a date range.
 * Output: raw JSON { timeframe, pull_requests, reviews } for the normalizer.
 * CLI: GITHUB_TOKEN=xxx node scripts/collect-github.js --start YYYY-MM-DD --end YYYY-MM-DD [--output raw.json] [--no-reviews]
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { parseArgs as parseArgsBase } from "../lib/parse-args.js";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const SEARCH_PR_PAGE_SIZE = 100;

const COLLECT_GITHUB_SCHEMA = {
  flags: [
    { name: "start", option: "--start", type: "string" },
    { name: "end", option: "--end", type: "string" },
    { name: "output", option: "--output", type: "string" },
    { name: "noReviews", option: "--no-reviews", type: "boolean" },
  ],
};

function parseArgs(argv) {
  return parseArgsBase(COLLECT_GITHUB_SCHEMA, argv);
}

export { parseArgs };

/**
 * POST to GitHub GraphQL; throws on HTTP error or GraphQL errors.
 * @param {{ token: string, query: string, variables?: Record<string, unknown>, fetchFn?: typeof fetch }} opts
 * @returns {Promise<{ data: unknown }>}
 */
async function graphqlFetch({ token, query, variables = {}, fetchFn = fetch }) {
  const res = await fetchFn(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`${GITHUB_GRAPHQL} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(msg);
  }
  return json;
}

function mapGraphQLPrToRaw(node) {
  const repo = node.baseRepository?.nameWithOwner ?? "";
  const labels = (node.labels?.nodes ?? []).map((n) => ({ name: n.name }));
  return {
    number: node.number,
    title: node.title ?? "",
    body: node.body ?? "",
    url: node.url ?? "",
    html_url: node.url ?? "",
    merged_at: node.mergedAt ?? null,
    base: { repo: { full_name: repo } },
    labels,
    changed_files: node.changedFiles ?? 0,
    additions: node.additions ?? 0,
    deletions: node.deletions ?? 0,
    review_comments: node.reviewThreads?.totalCount ?? 0,
  };
}

function mapGraphQLReviewToRaw(reviewNode, repoFullName, pullNumber) {
  return {
    id: reviewNode.id,
    body: reviewNode.body ?? "",
    state: reviewNode.state ?? "",
    submitted_at: reviewNode.submittedAt ?? null,
    url: reviewNode.url ?? "",
    html_url: reviewNode.url ?? "",
    repository: { full_name: repoFullName },
    pull_number: pullNumber,
  };
}

/**
 * Fetch PRs and reviews via GitHub GraphQL (batched, cursor-paginated). Same output shape as collectRaw.
 * @param {{ start: string, end: string, noReviews?: boolean, token: string, fetchFn?: typeof fetch }} opts
 * @returns {Promise<{ timeframe: { start_date: string, end_date: string }, pull_requests: unknown[], reviews: unknown[] }>}
 */
export async function collectRawGraphQL({ start, end, noReviews = false, token, fetchFn = fetch }) {
  const { data: viewerData } = await graphqlFetch({
    token,
    query: "query { viewer { login } }",
    fetchFn,
  });
  const login = viewerData?.viewer?.login;
  if (!login) throw new Error("Could not get viewer login");

  const q = `author:${login} type:pr created:${start}..${end}`;
  const pull_requests = [];
  const reviews = [];
  let cursor = null;

  const searchQuery = `
    query($q: String!, $after: String) {
      search(query: $q, type: ISSUE, first: ${SEARCH_PR_PAGE_SIZE}, after: $after) {
        edges {
          node {
            __typename
            ... on PullRequest {
              number title body url mergedAt additions deletions changedFiles
              baseRepository { nameWithOwner }
              labels(first: 100) { nodes { name } }
              reviewThreads(first: 1) { totalCount }
              reviews(first: 100) { nodes { id body state submittedAt url } }
            }
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  `;

  for (;;) {
    const variables = { q, after: cursor };
    const { data } = await graphqlFetch({ token, query: searchQuery, variables, fetchFn });
    const search = data?.search;
    if (!search) throw new Error("Unexpected GraphQL response: no search");

    const edges = search.edges ?? [];
    for (const edge of edges) {
      const node = edge?.node;
      if (!node || node.__typename !== "PullRequest") continue;

      const rawPr = mapGraphQLPrToRaw(node);
      pull_requests.push(rawPr);

      if (!noReviews && node.reviews?.nodes?.length) {
        const repoFullName = node.baseRepository?.nameWithOwner ?? "";
        for (const r of node.reviews.nodes) {
          reviews.push(mapGraphQLReviewToRaw(r, repoFullName, node.number));
        }
      }
    }

    const hasNext = search.pageInfo?.hasNextPage === true;
    if (!hasNext) break;
    cursor = search.pageInfo?.endCursor ?? null;
    if (!cursor) break;
  }

  return {
    timeframe: { start_date: start, end_date: end },
    pull_requests,
    reviews,
  };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN required");
    process.exit(1);
  }
  const { start, end, output, noReviews } = parseArgs();
  if (!start || !end) {
    console.error("--start YYYY-MM-DD and --end YYYY-MM-DD required");
    process.exit(1);
  }
  const raw = await collectRawGraphQL({ start, end, noReviews, token });
  const json = JSON.stringify(raw, null, 2);
  if (output) {
    writeFileSync(output, json);
    console.error("Wrote", output);
  } else {
    console.log(json);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
