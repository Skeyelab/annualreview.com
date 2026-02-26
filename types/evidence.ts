/**
 * TypeScript types for the evidence input contract.
 * Derived from schemas/evidence.json — keep in sync with that schema.
 */

/** ISO 8601 date string (YYYY-MM-DD). */
export type DateString = string;

/** ISO 8601 datetime string. */
export type DateTimeString = string;

export interface Timeframe {
  start_date: DateString;
  end_date: DateString;
}

export interface RoleContext {
  level?: string;
  job_family?: string;
  focus_areas?: string[];
}

export type ContributionType = "pull_request" | "review" | "release" | "issue";

export interface Contribution {
  /** e.g. "repo#1234" */
  id: string;
  type: ContributionType;
  title: string;
  url: string;
  repo: string;
  merged_at?: DateTimeString | null;
  labels?: string[];
  files_changed?: number;
  additions?: number;
  deletions?: number;
  summary?: string;
  body?: string;
  linked_issues?: string[];
  review_comments_count?: number;
  approvals_count?: number;
}

export interface Evidence {
  timeframe: Timeframe;
  role_context_optional?: RoleContext | null;
  /** Optional annual goals, one per line. Used to frame themes, bullets, and stories. */
  goals?: string;
  contributions: Contribution[];
}
