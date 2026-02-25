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

export type ContributionType =
  | "pull_request"
  | "review"
  | "release"
  | "issue"
  | "slack_message"
  | "slack_thread"
  | "jira_issue"
  | "jira_comment";

export type SourceType = "github" | "slack" | "jira" | "linear";

export interface Contribution {
  /** e.g. "repo#<number>", "slack#<channel>#<timestamp>", "jira#<project>-<number>" */
  id: string;
  type: ContributionType;
  /** Origin of this contribution. Defaults to "github" for backward compatibility. */
  source?: SourceType;
  title: string;
  url: string;
  /** GitHub org/repo. Optional for non-GitHub sources. */
  repo?: string;
  /** Slack channel name or ID (Slack source). */
  channel?: string;
  /** Jira/Linear project key (Jira/Linear source). */
  project?: string;
  /** Source-specific extra fields (e.g. Slack thread_ts, Jira issue key/status). */
  meta?: Record<string, unknown>;
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
  contributions: Contribution[];
}
