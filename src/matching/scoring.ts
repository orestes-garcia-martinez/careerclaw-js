/**
 * matching/scoring.ts — Pure per-dimension scoring functions.
 *
 * The original deterministic scorer remains intact for backward
 * compatibility. This file now also exposes a hybrid path that layers:
 *
 *   1. Enhanced lexical overlap via taxonomy expansion
 *   2. Semantic concept overlap via canonical skill mapping
 *   3. The existing metadata quality dimensions
 *
 * Design principle: the ranking engine must remain local-first and
 * fail-soft. If semantic signals are unavailable, the hybrid path falls
 * back to lexical-only behaviour rather than producing neutral inflation.
 */

import type {
  MatchBreakdown,
  NormalizedJob,
  ResumeIntelligence,
  SearchOverrides,
  UserProfile,
} from "../models.js";
import {
  tokenizeUnique,
  tokenOverlap,
  matchedTokens,
  gapTokens,
} from "../core/text-processing.js";
import {
  buildJobSemanticView,
  buildProfileSemanticView,
  computeSemanticScore,
  weightedOverlapScore,
} from "./semantic-scoring.js";
import { cosineSimilarity } from "../embedding/cosine.js";
import { EMBEDDING_MATCHING, SEMANTIC_MATCHING } from "../config.js";
import {
  getCredentials,
  getSkillAliases,
  getCanonicalSkill,
  normalizeSkill,
} from "../core/skill-taxonomy.js";
import {
  inferRoleFamiliesFromJob,
  inferRoleFamiliesFromProfile,
  roleFamilyCompatibility,
} from "./intent.js";

/**
 * Quality dimension weights — applied AFTER the keyword signal multiplier.
 * Normalised to sum to 1.0 so the quality base stays in [0, 1].
 *
 * Originating weights (additive model):
 *   experience 20%, salary 15%, work_mode 15%  →  sum = 50%
 * Normalised:
 *   experience 0.4, salary 0.3, work_mode 0.3
 */
const QUALITY_WEIGHTS = {
  role_alignment: 0.35,
  experience: 0.25,
  salary: 0.2,
  work_mode: 0.2,
} as const;

const SKILL_WEIGHT_BONUS = 0.25;

// Verify weights sum to 1.0 at module load time
const _weightSum = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(_weightSum - 1.0) > 1e-9) {
  throw new Error(`QUALITY_WEIGHTS must sum to 1.0, got ${_weightSum}`);
}

export interface HybridMatchBreakdown extends MatchBreakdown {
  lexical_keyword: number;
  semantic: number;
}

export interface EmbeddingMatchBreakdown extends MatchBreakdown {
  embedding: number;
}

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

  return {
    score: tokenOverlap(profileTokens, jobTokens),
    matched: matchedTokens(profileTokens, jobTokens),
    gaps: gapTokens(jobTokens, profileTokens),
  };
}

export function scoreKeywordEnhanced(
  profile: UserProfile,
  job: NormalizedJob,
  options: { resumeText?: string; resumeIntel?: ResumeIntelligence | null } = {}
): { score: number; matched: string[]; gaps: string[] } {
  const profileView = buildProfileSemanticView(profile, options);
  const jobView = buildJobSemanticView(job);
  return weightedOverlapScore(profileView.lexicalWeights, jobView.lexicalWeights);
}

/**
 * Score alignment between user experience years and job requirements.
 *
 * Returns neutral 0.5 if either side has no data.
 * Returns 1.0 if the job requires 0 years.
 * Clamped linear: user_years / job_years, capped at 1.0 (over-qualified not penalised).
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

/**
 * Score alignment between user salary expectations and the job's posted range.
 *
 * Returns neutral 0.5 if either side has no data.
 * Returns 1.0 if job minimum meets or exceeds user minimum.
 * Proportional score if job pays less, clamped to [0, 1].
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

/**
 * Score alignment between user work mode preference and job work mode.
 *
 * Returns 1.0 on exact match, or if the user accepts any work mode.
 * Returns 0.5 if either side is null (insufficient data) or one side is hybrid.
 * Returns 0.0 on hard mismatch (e.g. remote vs onsite).
 */
export function scoreWorkMode(
  profile: UserProfile,
  job: NormalizedJob
): number {
  const userMode = profile.work_mode;
  const jobMode = job.work_mode;

  if (userMode === null || userMode === undefined) return 0.5;
  if (jobMode === null || jobMode === undefined) return 0.5;
  if (userMode === "any") return 1.0;
  if (userMode === jobMode) return 1.0;

  // A hybrid job is acceptable for any work-mode preference.
  if (jobMode === "hybrid") return 0.5;

  // Hybrid users are flexible: they prefer remote (can always work from home)
  // over onsite (less flexibility), but both are acceptable.
  if (userMode === "hybrid") {
    return jobMode === "remote" ? 0.75 : 0.5;
  }

  // Hard mismatch: remote vs onsite (or onsite vs remote).
  return 0.0;
}

export function scoreRoleAlignment(
  profile: UserProfile,
  job: NormalizedJob,
): number {
  const profileFamilies = inferRoleFamiliesFromProfile(profile);
  const jobFamilies = inferRoleFamiliesFromJob(job);

  if (profileFamilies.length === 0 || jobFamilies.length === 0) {
    return 0.5;
  }

  let best = 0.05;
  for (const profileFamily of profileFamilies) {
    for (const jobFamily of jobFamilies) {
      best = Math.max(best, roleFamilyCompatibility(profileFamily, jobFamily));
    }
  }

  return best;
}

export function scoreSkillAlignment(
  job: NormalizedJob,
  overrides?: SearchOverrides,
): number | null {
  const requestedSkills = normalizeTargetSkills(overrides?.target_skills);
  if (requestedSkills.length === 0) {
    return null;
  }

  const jobView = buildJobSemanticView(job);
  const matchedCount = requestedSkills.filter((skill) =>
    jobMatchesTargetSkill(jobView, skill),
  ).length;

  return roundScore(matchedCount / requestedSkills.length);
}

/**
 * Compute the weighted composite score (legacy / lexical-only path).
 *
 * Formula:
 *   qualityBase = (experience × 0.4) + (salary × 0.3) + (work_mode × 0.3)
 *   total       = sqrt(keyword) × qualityBase
 *
 * The keyword score acts as a signal multiplier:
 *   - keyword = 0.0 → total = 0.0 always (the "dentist fix")
 *   - keyword = 1.0 → total = qualityBase
 *   - keyword = 0.25 → signal = 0.5 (sqrt softens partial-match penalty)
 */
export function compositeScore(
  profile: UserProfile,
  job: NormalizedJob,
  overrides?: SearchOverrides,
): { total: number; breakdown: MatchBreakdown; matched: string[]; gaps: string[] } {
  const kw = scoreKeyword(profile, job);
  const role_alignment = scoreRoleAlignment(profile, job);
  const skill_alignment = scoreSkillAlignment(job, overrides);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase = computeQualityBase({
    role_alignment,
    skill_alignment,
    experience,
    salary,
    work_mode,
  });

  const signal = Math.sqrt(kw.score);
  const total = roundScore(signal * qualityBase);

  return {
    total,
    breakdown: {
      keyword: kw.score,
      role_alignment,
      ...(skill_alignment !== null ? { skill_alignment } : {}),
      experience,
      salary,
      work_mode,
    },
    matched: kw.matched,
    gaps: kw.gaps,
  };
}

export function compositeScoreHybrid(
  profile: UserProfile,
  job: NormalizedJob,
  options: {
    resumeText?: string;
    resumeIntel?: ResumeIntelligence | null;
    searchOverrides?: SearchOverrides;
  } = {}
): {
  total: number;
  breakdown: HybridMatchBreakdown;
  matched: string[];
  gaps: string[];
} {
  const lexicalBaseline = scoreKeyword(profile, job);

  // Build views once — shared by both lexical-enhanced and semantic scoring
  // to avoid recomputing the job view twice per job.
  const profileView = buildProfileSemanticView(profile, options);
  const jobView = buildJobSemanticView(job);
  const lexicalEnhanced = weightedOverlapScore(profileView.lexicalWeights, jobView.lexicalWeights);
  const semantic = computeSemanticScore(profileView, jobView);

  const role_alignment = scoreRoleAlignment(profile, job);
  const skill_alignment = scoreSkillAlignment(job, options.searchOverrides);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase = computeQualityBase({
    role_alignment,
    skill_alignment,
    experience,
    salary,
    work_mode,
  });

  const lexicalForRanking = lexicalEnhanced.score;
  const signalInput = semantic.available
    ? lexicalForRanking * SEMANTIC_MATCHING.WEIGHTS.LEXICAL +
      semantic.score * SEMANTIC_MATCHING.WEIGHTS.SEMANTIC
    : lexicalForRanking;

  const signal = Math.sqrt(signalInput);
  const total = roundScore(signal * qualityBase);

  return {
    total,
    breakdown: {
      keyword: lexicalForRanking,
      lexical_keyword: lexicalBaseline.score,
      semantic: semantic.available ? semantic.score : 0,
      role_alignment,
      ...(skill_alignment !== null ? { skill_alignment } : {}),
      experience,
      salary,
      work_mode,
    },
    matched: [...new Set([...lexicalEnhanced.matched, ...semantic.matched])],
    gaps: [...new Set([...lexicalEnhanced.gaps, ...semantic.gaps])],
  };
}

/**
 * Compute composite score using pre-computed embedding vectors.
 *
 * Formula:
 *   signalInput = lexical × 0.3 + embedding_cosine × 0.7
 *   total       = sqrt(signalInput) × qualityBase
 *
 * The lexical score (Jaccard) still serves as the keyword gate signal
 * (`breakdown.keyword`) and anchors exact technology term matches.
 * The embedding cosine similarity provides the dominant semantic signal
 * without requiring a hand-curated taxonomy.
 *
 * Vectors must be L2-normalized (produced by LocalEmbeddingProvider
 * with `normalize: true`), so cosine similarity equals the dot product.
 */
export function compositeScoreWithEmbedding(
  profile: UserProfile,
  job: NormalizedJob,
  profileVec: Float32Array,
  jobVec: Float32Array,
  overrides?: SearchOverrides,
): {
  total: number;
  breakdown: EmbeddingMatchBreakdown;
  matched: string[];
  gaps: string[];
} {
  const kw = scoreKeyword(profile, job);
  const embed = cosineSimilarity(profileVec, jobVec);

  const role_alignment = scoreRoleAlignment(profile, job);
  const skill_alignment = scoreSkillAlignment(job, overrides);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase = computeQualityBase({
    role_alignment,
    skill_alignment,
    experience,
    salary,
    work_mode,
  });

  const signalInput =
    kw.score * EMBEDDING_MATCHING.WEIGHTS.LEXICAL +
    embed    * EMBEDDING_MATCHING.WEIGHTS.SEMANTIC;

  const signal = Math.sqrt(signalInput);
  const total = roundScore(signal * qualityBase);

  return {
    total,
    breakdown: {
      keyword: kw.score,
      embedding: embed,
      role_alignment,
      ...(skill_alignment !== null ? { skill_alignment } : {}),
      experience,
      salary,
      work_mode,
    },
    matched: kw.matched,
    gaps: kw.gaps,
  };
}

function roundScore(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function computeQualityBase(scores: {
  role_alignment: number;
  skill_alignment: number | null;
  experience: number;
  salary: number;
  work_mode: number;
}): number {
  const weightedParts = [
    { score: scores.role_alignment, weight: QUALITY_WEIGHTS.role_alignment },
    { score: scores.experience, weight: QUALITY_WEIGHTS.experience },
    { score: scores.salary, weight: QUALITY_WEIGHTS.salary },
    { score: scores.work_mode, weight: QUALITY_WEIGHTS.work_mode },
  ];

  if (scores.skill_alignment !== null) {
    weightedParts.push({
      score: scores.skill_alignment,
      weight: SKILL_WEIGHT_BONUS,
    });
  }

  const totalWeight = weightedParts.reduce((sum, entry) => sum + entry.weight, 0);
  return weightedParts.reduce(
    (sum, entry) => sum + entry.score * (entry.weight / totalWeight),
    0,
  );
}

function normalizeTargetSkills(skills: string[] | undefined): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const skill of skills ?? []) {
    const clean = skill.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }

  return normalized;
}

function jobMatchesTargetSkill(
  jobView: ReturnType<typeof buildJobSemanticView>,
  skill: string,
): boolean {
  const normalized = normalizeSkill(skill);
  const canonical = getCanonicalSkill(skill);

  if (canonical && jobView.semanticConcepts.has(canonical)) {
    return true;
  }

  const candidateTerms = new Set<string>([
    normalized,
    skill.toLowerCase().trim(),
  ]);

  const normalizedJobPhrases = new Set(
    [...jobView.semanticPhrases].map((phrase) => normalizeSkill(phrase)),
  );
  if (normalized && normalizedJobPhrases.has(normalized)) {
    return true;
  }

  if (canonical) {
    for (const term of [canonical, ...getSkillAliases(canonical), ...getCredentials(canonical)]) {
      candidateTerms.add(term.toLowerCase().trim());
    }
  }

  for (const term of candidateTerms) {
    if (term && jobView.lexicalWeights.has(term)) {
      return true;
    }
  }

  return false;
}
