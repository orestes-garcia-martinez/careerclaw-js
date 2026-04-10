/**
 * matching/engine.ts — Matching engine orchestrator.
 *
 * `rankJobs()` is the single entry point for the briefing pipeline's
 * ranking step. It scores every job against the user profile, filters
 * out irrelevant jobs via the signal gate, sorts descending by composite
 * score, and returns the top-K results as `ScoredJob[]`.
 *
 * Two-stage retrieval pipeline:
 *   Stage 1 (Multiplier): compositeScore() — keyword overlap gates the
 *     magnitude of the total score. Zero keyword overlap → score of 0.0.
 *   Stage 2 (Gate): minKeywordScore filter — hard boundary that removes
 *     any job below the minimum technical relevance threshold before
 *     ranking. Prevents irrelevant jobs floating on neutral dimension
 *     scores (the "dentist problem").
 *
 * Downstream layers (gap analysis, drafting, tracking) only consume
 * `ScoredJob[]` — they are score-agnostic.
 */

import type {
  NormalizedJob,
  ResumeIntelligence,
  SearchOverrides,
  UserProfile,
  ScoredJob,
} from "../models.js";
import { DEFAULT_TOP_K } from "../config.js";
import { compositeScore, compositeScoreHybrid, compositeScoreWithEmbedding } from "./scoring.js";
import type { EmbeddingProvider } from "../embedding/provider.js";
import { buildProfileEmbeddingText, buildJobEmbeddingText } from "../embedding/text-builder.js";

const REQUIRED_SKILL_ALIGNMENT = 1.0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score, filter, and rank jobs against a user profile.
 *
 * @param jobs           - Raw normalised jobs from source adapters
 * @param profile        - User profile to rank against
 * @param limit          - Maximum results to return (default: DEFAULT_TOP_K)
 * @param minKeywordScore - Signal gate threshold; jobs with keyword score
 *                         below this are dropped before ranking (default: 0.01)
 */
export function rankJobs(
  jobs: NormalizedJob[],
  profile: UserProfile,
  limit: number = DEFAULT_TOP_K,
  minKeywordScore: number = 0.01,
  searchOverrides?: SearchOverrides,
): ScoredJob[] {
  return jobs
    .map((job): ScoredJob => {
      const { total, breakdown, matched, gaps } = compositeScore(profile, job, searchOverrides);
      return {
        job,
        score: total,
        breakdown,
        matched_keywords: matched,
        gap_keywords: gaps,
      };
    })
    // Stage 2: drop jobs that fail the technical relevance gate
    .filter((scored) => scored.breakdown.keyword >= minKeywordScore)
    .filter(passesSkillGate)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Hybrid variant of rankJobs that layers taxonomy-expanded lexical scoring
 * with semantic concept matching.
 *
 * The signature is async to accommodate future embedding-based signals
 * (e.g. vector similarity via a local model or remote API). The current
 * implementation resolves synchronously — callers should always await to
 * remain forward-compatible.
 */
export async function rankJobsHybrid(
  jobs: NormalizedJob[],
  profile: UserProfile,
  options: {
    resumeText?: string;
    resumeIntel?: ResumeIntelligence | null;
    limit?: number;
    minKeywordScore?: number;
    searchOverrides?: SearchOverrides;
  } = {}
): Promise<ScoredJob[]> {
  const {
    resumeText,
    resumeIntel,
    limit = DEFAULT_TOP_K,
    minKeywordScore = 0.01,
    searchOverrides,
  } = options;

  return jobs
    .map((job): ScoredJob => {
      const { total, breakdown, matched, gaps } = compositeScoreHybrid(profile, job, {
        ...(resumeText !== undefined ? { resumeText } : {}),
        ...(resumeIntel !== undefined ? { resumeIntel } : {}),
        ...(searchOverrides !== undefined ? { searchOverrides } : {}),
      });
      return {
        job,
        score: total,
        breakdown,
        matched_keywords: matched,
        gap_keywords: gaps,
      };
    })
    .filter((scored) => scored.breakdown.keyword >= minKeywordScore)
    .filter(passesSkillGate)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Embedding variant of rankJobs.
 *
 * Scores every job against the user profile using a blend of lexical
 * overlap (30%) and embedding cosine similarity (70%). The embedding
 * provider must already be initialized (via warmEmbeddingProvider).
 *
 * All job texts are embedded in a single batch call before scoring —
 * one ONNX forward pass for all N jobs, not N sequential calls.
 */
export async function rankJobsWithEmbeddings(
  jobs: NormalizedJob[],
  profile: UserProfile,
  options: {
    embeddingProvider: EmbeddingProvider;
    resumeText?: string;
    limit?: number;
    minKeywordScore?: number;
    searchOverrides?: SearchOverrides;
  },
): Promise<ScoredJob[]> {
  const {
    embeddingProvider,
    resumeText,
    limit = DEFAULT_TOP_K,
    // Raised from 0.01 → 0.03: the embedding path needs a tighter keyword gate
    // than the lexical-only path. With 70% embedding weight, jobs with near-zero
    // keyword overlap (e.g. unrelated industries) can float on high cosine similarity
    // alone. 0.03 filters true noise while keeping relevant jobs with unusual vocabulary.
    minKeywordScore = 0.03,
    searchOverrides,
  } = options;

  const profileText = buildProfileEmbeddingText(profile, resumeText);
  const jobTexts = jobs.map(buildJobEmbeddingText);

  // Single ONNX forward pass: profile + all N jobs in one call
  const allVectors = await embeddingProvider.embed([profileText, ...jobTexts]);

  const profileVec = allVectors[0]!;
  const jobVecs = allVectors.slice(1);

  return jobs
    .map((job, i): ScoredJob => {
      const jobVec = jobVecs[i]!;
      const { total, breakdown, matched, gaps } = compositeScoreWithEmbedding(
        profile,
        job,
        profileVec,
        jobVec,
        searchOverrides,
      );
      return { job, score: total, breakdown, matched_keywords: matched, gap_keywords: gaps };
    })
    .filter((scored) => scored.breakdown.keyword >= minKeywordScore)
    .filter(passesSkillGate)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function passesSkillGate(scored: ScoredJob): boolean {
  const skillAlignment = scored.breakdown.skill_alignment;
  if (skillAlignment === undefined) {
    return true;
  }

  return skillAlignment >= REQUIRED_SKILL_ALIGNMENT;
}
