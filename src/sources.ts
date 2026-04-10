/**
 * sources.ts — Source aggregation and deduplication for CareerClaw.
 *
 * `fetchAllJobs(profile)` is the single entry point for the briefing pipeline.
 * Each adapter is isolated so one source failure does not fail the entire run.
 */

import type { NormalizedJob, JobSource, UserProfile, SearchOverrides } from "./models.js";
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

export type FetchJobsFn = (profile: UserProfile, overrides?: SearchOverrides) => Promise<FetchResult>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchAllJobs(profile: UserProfile, overrides?: SearchOverrides): Promise<FetchResult> {
  const counts: Partial<Record<JobSource, number>> = {};
  const errors: Partial<Record<JobSource, string>> = {};
  const allJobs: NormalizedJob[] = [];

  const jobsBySource = await Promise.allSettled([
    fetchRemoteOkJobs(),
    fetchHnJobs(HN_WHO_IS_HIRING_ID),
    fetchSerpApiJobsIfEnabled(profile, overrides),
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
 * Deduplicate a list of jobs by stable ids plus a canonical content fingerprint.
 * This collapses syndicated multi-board copies of the same role while preserving
 * distinct roles that happen to share a company or source.
 */
export function deduplicate(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Map<string, number>();
  const buckets: Array<{
    job: NormalizedJob;
    fingerprints: Set<string>;
    active: boolean;
  }> = [];

  for (const job of jobs) {
    const fingerprints = buildDedupFingerprints(job);
    const matchedIndices = [...new Set(fingerprints
      .map((fingerprint) => seen.get(fingerprint))
      .filter((index): index is number => index !== undefined))];

    if (matchedIndices.length === 0) {
      const newIndex = buckets.length;
      buckets.push({
        job,
        fingerprints: new Set(fingerprints),
        active: true,
      });
      for (const fingerprint of fingerprints) {
        seen.set(fingerprint, newIndex);
      }
      continue;
    }

    const primaryIndex = Math.min(...matchedIndices);
    const primaryBucket = buckets[primaryIndex]!;
    const candidateJobs = [
      ...matchedIndices.map((index) => buckets[index]!.job),
      job,
    ];

    primaryBucket.job = candidateJobs.reduce((winner, candidate) => pickPreferredJob(winner, candidate));

    for (const index of matchedIndices) {
      const bucket = buckets[index]!;
      for (const fingerprint of bucket.fingerprints) {
        primaryBucket.fingerprints.add(fingerprint);
        seen.set(fingerprint, primaryIndex);
      }

      if (index !== primaryIndex) {
        bucket.active = false;
      }
    }

    for (const fingerprint of fingerprints) {
      primaryBucket.fingerprints.add(fingerprint);
      seen.set(fingerprint, primaryIndex);
    }
  }

  return buckets.filter((bucket) => bucket.active).map((bucket) => bucket.job);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchSerpApiJobsIfEnabled(profile: UserProfile, overrides?: SearchOverrides): Promise<NormalizedJob[]> {
  if (!SERPAPI_GOOGLE_JOBS_ENABLED) {
    return [];
  }

  return fetchSerpApiGoogleJobs(profile, overrides !== undefined ? { overrides } : {});
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

function buildDedupFingerprints(job: NormalizedJob): string[] {
  const fingerprints = [job.job_id.trim()].filter((value) => value.length > 0);

  const normalizedTitle = normalizeText(job.title);
  const normalizedCompany = normalizeCompany(job.company);
  const normalizedLocation = normalizeText(job.location);
  const normalizedDescription = normalizeDescription(job.description);

  if (normalizedTitle && normalizedCompany && normalizedLocation) {
    fingerprints.push(`title-company-location:${normalizedTitle}|${normalizedCompany}|${normalizedLocation}`);
  }

  if (normalizedTitle && normalizedCompany && normalizedDescription) {
    fingerprints.push(`title-company-description:${normalizedTitle}|${normalizedCompany}|${normalizedDescription}`);
  }

  return [...new Set(fingerprints)];
}

function pickPreferredJob(existing: NormalizedJob, candidate: NormalizedJob): NormalizedJob {
  const existingScore = jobRichnessScore(existing);
  const candidateScore = jobRichnessScore(candidate);
  return candidateScore > existingScore ? candidate : existing;
}

function jobRichnessScore(job: NormalizedJob): number {
  return (
    (job.salary_min != null ? 1 : 0) +
    (job.salary_max != null ? 1 : 0) +
    (job.work_mode != null ? 1 : 0) +
    (job.experience_years != null ? 1 : 0) +
    (job.posted_at != null ? 1 : 0) +
    Math.min(job.description.length / 500, 1) +
    (hasDirectEmployerUrl(job.url) ? 1 : 0) +
    Math.min(job.location.length / 30, 1)
  );
}

function hasDirectEmployerUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ![
      "linkedin.com",
      "www.linkedin.com",
      "indeed.com",
      "www.indeed.com",
      "tealhq.com",
      "www.tealhq.com",
      "jobrapido.com",
      "us.jobrapido.com",
      "talent.com",
      "www.talent.com",
      "whatjobs.com",
      "www.whatjobs.com",
      "womenforhire.com",
      "jobs.womenforhire.com",
      "monster.com",
      "www.monster.com",
      "ziprecruiter.com",
      "www.ziprecruiter.com",
      "jooble.org",
      "www.jooble.org",
    ].includes(hostname);
  } catch {
    return false;
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompany(value: string): string {
  return normalizeText(value)
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co|holdings|holding|bank|n a|na|usa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDescription(value: string): string {
  return normalizeText(value).slice(0, 180);
}
