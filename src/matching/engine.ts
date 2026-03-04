/**
 * matching/engine.ts — Matching engine orchestrator.
 *
 * `rankJobs()` is the single entry point for the briefing pipeline's
 * ranking step. It scores every job against the user profile, sorts
 * descending by composite score, and returns the top-K results as
 * `ScoredJob[]`.
 *
 * Downstream layers (gap analysis, drafting, tracking) only consume
 * `ScoredJob[]` — they are score-agnostic.
 */

import type { NormalizedJob, UserProfile, ScoredJob } from "../models.js";
import { DEFAULT_TOP_K } from "../config.js";
import {
  scoreKeyword,
  scoreExperience,
  scoreSalary,
  scoreWorkMode,
  compositeScore,
} from "./scoring.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rank a list of jobs against a user profile.
 *
 * @param jobs     - Deduplicated job list from `fetchAllJobs()`
 * @param profile  - User profile (skills, experience, salary, work mode)
 * @param topK     - Number of top results to return (default: DEFAULT_TOP_K)
 * @returns        - Top-K `ScoredJob[]` sorted descending by composite score
 */
export function rankJobs(
  jobs: NormalizedJob[],
  profile: UserProfile,
  topK: number = DEFAULT_TOP_K
): ScoredJob[] {
  const scored: ScoredJob[] = jobs.map((job) => scoreJob(job, profile));

  // Sort descending by composite score, stable (insertion order preserved for ties)
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scoreJob(job: NormalizedJob, profile: UserProfile): ScoredJob {
  const keyword = scoreKeyword(profile, job);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const score = compositeScore({
    keyword: keyword.score,
    experience,
    salary,
    work_mode,
  });

  return {
    job,
    score: roundScore(score),
    breakdown: {
      keyword_score: roundScore(keyword.score),
      experience_score: roundScore(experience),
      salary_score: roundScore(salary),
      work_mode_score: roundScore(work_mode),
    },
    matched_keywords: keyword.matched,
    gap_keywords: keyword.gaps,
  };
}

/** Round to 4 decimal places — matches Python output format. */
function roundScore(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
