/**
 * matching/scoring.ts — Pure per-dimension scoring functions.
 *
 * Each function returns a value in [0, 1].
 * Neutral value (0.5) is used when there is insufficient data to score,
 * so missing job data neither rewards nor penalises the composite score.
 *
 * All functions are pure and stateless — safe to unit test in isolation.
 */

import type { NormalizedJob, UserProfile, WorkMode } from "../models.js";
import { tokenizeUnique, tokenOverlap, matchedTokens, gapTokens } from "../core/text-processing.js";

// ---------------------------------------------------------------------------
// Score weights (must sum to 1.0)
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  keyword: 0.50,
  experience: 0.20,
  salary: 0.15,
  work_mode: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Keyword score
// ---------------------------------------------------------------------------

/**
 * Score keyword overlap between the user profile and a job posting.
 *
 * Profile corpus: skills + target_roles + resume_summary tokens (combined).
 * Job corpus:     title + description tokens.
 *
 * Returns Jaccard-like intersection/union in [0, 1].
 * Returns 0.0 if either corpus tokenises to empty.
 */
export function scoreKeyword(
  profile: UserProfile,
  job: NormalizedJob
): { score: number; matched: string[]; gaps: string[] } {
  // Build profile token set from all available text signals
  const profileText = [
    ...profile.skills,
    ...profile.target_roles,
    profile.resume_summary ?? "",
  ].join(" ");

  const profileTokens = tokenizeUnique(profileText);
  const jobTokens = tokenizeUnique(`${job.title} ${job.description}`);

  if (profileTokens.length === 0 || jobTokens.length === 0) {
    return { score: 0.0, matched: [], gaps: [] };
  }

  const score = tokenOverlap(profileTokens, jobTokens);
  const matched = matchedTokens(profileTokens, jobTokens);
  const gaps = gapTokens(jobTokens, profileTokens);

  return { score, matched, gaps };
}

// ---------------------------------------------------------------------------
// Experience score
// ---------------------------------------------------------------------------

/**
 * Score alignment between user experience years and job requirements.
 *
 * - Returns neutral 0.5 if the job specifies no experience requirement.
 * - Returns neutral 0.5 if the user has no experience years set.
 * - Clamped linear: user_years / job_years, capped at 1.0.
 *   (Over-qualified candidates are not penalised.)
 */
export function scoreExperience(
  profile: UserProfile,
  job: NormalizedJob
): number {
  const userYears = profile.experience_years;
  const jobYears = job.experience_years;

  if (userYears === null || userYears === undefined) return 0.5;
  if (jobYears === null || jobYears === undefined) return 0.5;
  if (jobYears === 0) return 1.0;

  return Math.min(userYears / jobYears, 1.0);
}

// ---------------------------------------------------------------------------
// Salary score
// ---------------------------------------------------------------------------

/**
 * Score alignment between user salary expectations and the job's posted range.
 *
 * - Returns neutral 0.5 if the job has no salary data.
 * - Returns neutral 0.5 if the user has no salary minimum set.
 * - Returns 1.0 if the job's minimum salary meets or exceeds the user's minimum.
 * - Returns a proportional score < 1.0 if the job pays less than the user's
 *   minimum, clamped to [0, 1].
 */
export function scoreSalary(
  profile: UserProfile,
  job: NormalizedJob
): number {
  const userMin = profile.salary_min;
  const jobMin = job.salary_min;

  if (userMin === null || userMin === undefined) return 0.5;
  if (jobMin === null || jobMin === undefined) return 0.5;
  if (userMin === 0) return 1.0;

  if (jobMin >= userMin) return 1.0;

  return Math.max(jobMin / userMin, 0.0);
}

// ---------------------------------------------------------------------------
// Work mode score
// ---------------------------------------------------------------------------

/**
 * Score alignment between user work mode preference and job work mode.
 *
 * - Returns 1.0 on exact match (remote↔remote, hybrid↔hybrid, onsite↔onsite).
 * - Returns 0.5 if either side is null (insufficient data, neutral).
 * - Returns 0.5 if one side is hybrid (partial match — hybrid is compatible
 *   with both remote and onsite in practice).
 * - Returns 0.0 on a hard mismatch (e.g. user wants remote, job is onsite).
 */
export function scoreWorkMode(
  profile: UserProfile,
  job: NormalizedJob
): number {
  const userMode = profile.work_mode;
  const jobMode = job.work_mode;

  if (userMode === null || userMode === undefined) return 0.5;
  if (jobMode === null || jobMode === undefined) return 0.5;
  if (userMode === jobMode) return 1.0;

  // Hybrid is a partial match against both remote and onsite
  if (userMode === "hybrid" || jobMode === "hybrid") return 0.5;

  // Hard mismatch: remote vs onsite
  return 0.0;
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

/**
 * Compute the weighted composite score from individual dimension scores.
 * Weights are defined in WEIGHTS and must sum to 1.0.
 */
export function compositeScore(scores: {
  keyword: number;
  experience: number;
  salary: number;
  work_mode: number;
}): number {
  return (
    scores.keyword * WEIGHTS.keyword +
    scores.experience * WEIGHTS.experience +
    scores.salary * WEIGHTS.salary +
    scores.work_mode * WEIGHTS.work_mode
  );
}
