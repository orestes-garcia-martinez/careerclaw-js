/**
 * sources.ts — Source aggregation and deduplication for CareerClaw.
 *
 * `fetchAllJobs(profile)` is the single entry point for the briefing pipeline.
 * Each adapter is isolated so one source failure does not fail the entire run.
 */

import type { NormalizedJob, JobSource, UserProfile } from "./models.js";
import { fetchRemoteOkJobs } from "./adapters/remoteok.js";
import { fetchHnJobs } from "./adapters/hackernews.js";
import { fetchSerpApiGoogleJobs } from "./adapters/serpapi-google-jobs.js";
import {
  HN_WHO_IS_HIRING_ID,
  SERPAPI_GOOGLE_JOBS_ENABLED,
} from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchResult {
  jobs: NormalizedJob[];
  counts: Partial<Record<JobSource, number>>;
  errors: Partial<Record<JobSource, string>>;
}

export type FetchJobsFn = (profile: UserProfile) => Promise<FetchResult>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchAllJobs(profile: UserProfile): Promise<FetchResult> {
  const counts: Partial<Record<JobSource, number>> = {};
  const errors: Partial<Record<JobSource, string>> = {};
  const allJobs: NormalizedJob[] = [];

  const jobsBySource = await Promise.allSettled([
    fetchRemoteOkJobs(),
    fetchHnJobs(HN_WHO_IS_HIRING_ID),
    fetchSerpApiJobsIfEnabled(profile),
  ]);

  collectSourceResult("remoteok", jobsBySource[0], counts, errors, allJobs);
  collectSourceResult("hackernews", jobsBySource[1], counts, errors, allJobs);
  collectSourceResult("serpapi_google_jobs", jobsBySource[2], counts, errors, allJobs);

  return {
    jobs: deduplicate(allJobs),
    counts,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate a list of jobs by `job_id`.
 * First-seen wins — preserves source ordering.
 */
export function deduplicate(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const result: NormalizedJob[] = [];
  for (const job of jobs) {
    if (!seen.has(job.job_id)) {
      seen.add(job.job_id);
      result.push(job);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchSerpApiJobsIfEnabled(profile: UserProfile): Promise<NormalizedJob[]> {
  if (!SERPAPI_GOOGLE_JOBS_ENABLED) {
    return [];
  }

  return fetchSerpApiGoogleJobs(profile);
}

function collectSourceResult(
  source: JobSource,
  settled: PromiseSettledResult<NormalizedJob[]>,
  counts: Partial<Record<JobSource, number>>,
  errors: Partial<Record<JobSource, string>>,
  allJobs: NormalizedJob[],
): void {
  if (settled.status === "fulfilled") {
    counts[source] = settled.value.length;
    allJobs.push(...settled.value);
    return;
  }

  counts[source] = 0;
  errors[source] = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
}
