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

type RoleFamily =
  | "marketing"
  | "design"
  | "operations"
  | "finance"
  | "engineering"
  | "sales"
  | "data"
  | "product"
  | "customer_success";

const ROLE_FAMILY_KEYWORDS: Record<RoleFamily, readonly string[]> = {
  marketing: [
    "marketing",
    "product marketing",
    "growth",
    "demand gen",
    "demand generation",
    "lifecycle",
    "brand",
    "messaging",
    "campaign",
    "seo",
    "content strategy",
    "content marketing",
    "paid acquisition",
  ],
  design: [
    "design",
    "designer",
    "ux",
    "ui",
    "product design",
    "interaction design",
    "design systems",
    "figma",
    "prototype",
    "accessibility",
    "ux writing",
    "storyboard",
    "storyboarding",
    "design qa",
  ],
  operations: [
    "operations",
    "operator",
    "program management",
    "program manager",
    "project management",
    "launch readiness",
    "process design",
    "vendor management",
    "onboarding",
    "support workflow",
    "support workflows",
    "implementation",
    "enablement",
    "service operations",
  ],
  finance: [
    "finance",
    "fp&a",
    "fpa",
    "financial",
    "accounting",
    "accountant",
    "pricing",
    "cash planning",
    "board reporting",
    "revenue analysis",
    "subscription economics",
    "margin",
    "procurement",
    "netsuite",
  ],
  engineering: [
    "engineer",
    "engineering",
    "developer",
    "software",
    "frontend",
    "backend",
    "full-stack",
    "full stack",
    "platform",
    "devops",
    "sre",
    "python",
    "node",
    "typescript",
    "react",
  ],
  sales: [
    "sales",
    "account executive",
    "sales development",
    "business development",
    "sdr",
    "bdr",
    "revenue generation",
    "pipeline generation",
  ],
  data: [
    "data",
    "analyst",
    "analytics engineer",
    "data scientist",
    "business intelligence",
    "bi",
    "sql analyst",
    "reporting analyst",
  ],
  product: [
    "product manager",
    "product management",
    "product strategy",
    "product lead",
    "go-to-market",
    "gtm",
    "roadmap",
  ],
  customer_success: [
    "customer success",
    "customer operations",
    "implementation manager",
    "account management",
    "customer onboarding",
    "renewal",
    "retention",
    "success manager",
  ],
};

const RELATED_ROLE_FAMILIES: Partial<Record<RoleFamily, readonly RoleFamily[]>> = {
  marketing: ["sales", "product"],
  design: ["product", "engineering"],
  operations: ["customer_success", "product"],
  finance: ["data", "operations"],
  engineering: ["data", "design", "product"],
  sales: ["marketing", "customer_success"],
  data: ["engineering", "finance", "marketing"],
  product: ["design", "engineering", "marketing", "operations"],
  customer_success: ["operations", "sales"],
};

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
  job: NormalizedJob
): { total: number; breakdown: MatchBreakdown; matched: string[]; gaps: string[] } {
  const kw = scoreKeyword(profile, job);
  const role_alignment = scoreRoleAlignment(profile, job);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase =
    role_alignment * QUALITY_WEIGHTS.role_alignment +
    experience * QUALITY_WEIGHTS.experience +
    salary     * QUALITY_WEIGHTS.salary +
    work_mode  * QUALITY_WEIGHTS.work_mode;

  const signal = Math.sqrt(kw.score);
  const total = roundScore(signal * qualityBase);

  return {
    total,
    breakdown: { keyword: kw.score, role_alignment, experience, salary, work_mode },
    matched: kw.matched,
    gaps: kw.gaps,
  };
}

export function compositeScoreHybrid(
  profile: UserProfile,
  job: NormalizedJob,
  options: { resumeText?: string; resumeIntel?: ResumeIntelligence | null } = {}
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
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase =
    role_alignment * QUALITY_WEIGHTS.role_alignment +
    experience * QUALITY_WEIGHTS.experience +
    salary     * QUALITY_WEIGHTS.salary +
    work_mode  * QUALITY_WEIGHTS.work_mode;

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
): {
  total: number;
  breakdown: EmbeddingMatchBreakdown;
  matched: string[];
  gaps: string[];
} {
  const kw = scoreKeyword(profile, job);
  const embed = cosineSimilarity(profileVec, jobVec);

  const role_alignment = scoreRoleAlignment(profile, job);
  const experience = scoreExperience(profile, job);
  const salary = scoreSalary(profile, job);
  const work_mode = scoreWorkMode(profile, job);

  const qualityBase =
    role_alignment * QUALITY_WEIGHTS.role_alignment +
    experience * QUALITY_WEIGHTS.experience +
    salary     * QUALITY_WEIGHTS.salary +
    work_mode  * QUALITY_WEIGHTS.work_mode;

  const signalInput =
    kw.score * EMBEDDING_MATCHING.WEIGHTS.LEXICAL +
    embed    * EMBEDDING_MATCHING.WEIGHTS.SEMANTIC;

  const signal = Math.sqrt(signalInput);
  const total = roundScore(signal * qualityBase);

  return {
    total,
    breakdown: { keyword: kw.score, embedding: embed, role_alignment, experience, salary, work_mode },
    matched: kw.matched,
    gaps: kw.gaps,
  };
}

function roundScore(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function inferRoleFamiliesFromProfile(profile: UserProfile): RoleFamily[] {
  const text = [
    ...profile.target_roles,
    ...profile.skills,
    profile.resume_summary ?? "",
  ].join(" ");
  return inferRoleFamilies(text);
}

function inferRoleFamiliesFromJob(job: NormalizedJob): RoleFamily[] {
  const titleFamilies = inferRoleFamilies(job.title);
  if (titleFamilies.length > 0) {
    return titleFamilies;
  }
  return inferRoleFamilies(`${job.title} ${job.description}`);
}

function inferRoleFamilies(text: string): RoleFamily[] {
  const haystack = text.toLowerCase();
  const scored = Object.entries(ROLE_FAMILY_KEYWORDS)
    .map(([family, keywords]) => {
      const score = keywords.reduce((sum, keyword) => sum + countRoleKeywordHits(haystack, keyword), 0);
      return { family: family as RoleFamily, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [];
  }

  const topScore = scored[0]!.score;
  return scored
    .filter((entry) => entry.score >= Math.max(1, topScore * 0.6))
    .slice(0, 2)
    .map((entry) => entry.family);
}

function countRoleKeywordHits(haystack: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches?.length ?? 0;
}

function roleFamilyCompatibility(a: RoleFamily, b: RoleFamily): number {
  if (a === b) {
    return 1.0;
  }

  if (RELATED_ROLE_FAMILIES[a]?.includes(b) || RELATED_ROLE_FAMILIES[b]?.includes(a)) {
    return 0.35;
  }

  return 0.05;
}
