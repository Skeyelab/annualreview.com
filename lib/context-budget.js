/**
 * Keep pipeline payloads under the model context limit (e.g. 128k) by slimming
 * contributions when the serialized input would exceed maxTokens.
 */

/** Rough token estimate: ~4 chars per token for JSON/English. */
export function estimateTokens(str) {
  if (typeof str !== "string") return 0;
  return Math.ceil(str.length / 4);
}

/** Fields we always keep; arrays are capped separately. */
const SLIM_KEYS = [
  "id",
  "type",
  "title",
  "url",
  "repo",
  "merged_at",
  "labels",
  "files_changed",
  "additions",
  "deletions",
  "linked_issues",
  "review_comments_count",
  "approvals_count",
];

/** Smallest set needed for clustering + citations. */
const MINIMAL_KEYS = ["id", "type", "title", "url", "repo", "merged_at"];

const MAX_LABELS = 8;
const MAX_LINKED_ISSUES = 5;

function capArray(arr, max) {
  if (!Array.isArray(arr) || arr.length <= max) return arr;
  return arr.slice(0, max);
}

/**
 * @param {Array<Record<string, unknown>>} contributions
 * @param {{ bodyChars?: number, summaryChars?: number, minimal?: boolean }} opts
 * @returns {Array<Record<string, unknown>>}
 */
export function slimContributions(contributions, opts = {}) {
  const { bodyChars = 400, summaryChars = 500, minimal = false } = opts;
  const keys = minimal ? MINIMAL_KEYS : SLIM_KEYS;
  return contributions.map((c) => {
    const out = {};
    for (const k of keys) {
      if (c[k] === undefined) continue;
      if (k === "labels") out[k] = capArray(c[k], MAX_LABELS);
      else if (k === "linked_issues") out[k] = capArray(c[k], MAX_LINKED_ISSUES);
      else out[k] = c[k];
    }
    const sumLen = minimal ? 200 : summaryChars;
    if (c.summary != null) {
      out.summary =
        typeof c.summary === "string" && c.summary.length > sumLen
          ? c.summary.slice(0, sumLen) + "..."
          : c.summary;
    }
    if (!minimal && c.body != null && typeof c.body === "string" && bodyChars > 0) {
      out.body_preview =
        c.body.length > bodyChars ? c.body.slice(0, bodyChars) + "..." : c.body;
    }
    return out;
  });
}

/** Default max user-message tokens (leaves room for system + response under 128k). */
export const DEFAULT_MAX_USER_TOKENS = 100_000;

/**
 * Returns evidence with contributions slimmer so that getPayload(evidence) fits in maxTokens.
 * Tries reducing body/summary length, then caps contribution count by recency (merged_at).
 *
 * @param {{ timeframe: object, role_context_optional?: object, contributions: Array<object> }} evidence
 * @param {(ev: object) => string} getPayload
 * @param {number} [maxTokens]
 * @returns {{ timeframe: object, role_context_optional?: object, contributions: Array<object> }}
 */
export function fitEvidenceToBudget(evidence, getPayload, maxTokens = DEFAULT_MAX_USER_TOKENS) {
  let contributions = evidence.contributions;
  let bodyChars = 600;
  let summaryChars = 500;

  let payload = getPayload({ ...evidence, contributions });
  while (estimateTokens(payload) > maxTokens && (bodyChars > 0 || summaryChars > 0)) {
    bodyChars = Math.max(0, bodyChars - 150);
    summaryChars = Math.max(0, summaryChars - 100);
    contributions = slimContributions(evidence.contributions, { bodyChars, summaryChars });
    payload = getPayload({ ...evidence, contributions });
  }

  if (estimateTokens(payload) <= maxTokens) {
    return { ...evidence, contributions };
  }

  // Aggressive: minimal view (id, type, title, url, repo, merged_at, short summary only)
  contributions = slimContributions(evidence.contributions, { minimal: true });
  payload = getPayload({ ...evidence, contributions });
  if (estimateTokens(payload) <= maxTokens) {
    return { ...evidence, contributions };
  }

  // Last resort: cap contribution count by recency
  const original = evidence.contributions;
  const byDate = [...original].sort((a, b) =>
    (b.merged_at || "").localeCompare(a.merged_at || "")
  );
  for (let n = byDate.length; n > 0; n--) {
    contributions = slimContributions(byDate.slice(0, n), { minimal: true });
    payload = getPayload({ ...evidence, contributions });
    if (estimateTokens(payload) <= maxTokens) {
      return { ...evidence, contributions };
    }
  }

  return { ...evidence, contributions };
}
