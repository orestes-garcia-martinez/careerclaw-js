/**
 * briefing.ts — Daily briefing pipeline orchestrator.
 *
 * `runBriefing()` is the standalone entry point that wires every module
 * into the complete end-to-end workflow:
 *
 *   fetch → deduplicate → rank → draft → persist → return bundle
 *
 * `runBriefingWithContext()` is the trusted platform entry point used by
 * ClawOS after upstream entitlement verification. It enables premium
 * behavior from an in-memory execution context rather than a public CLI flag.
 */

import { randomUUID } from "crypto";
import { createRequire } from "module";
import type {
  UserProfile,
  ScoredJob,
  OutreachDraft,
  CoverLetter,
  GapAnalysisReport,
  BriefingRun,
  BriefingResult,
  ResumeIntelligence,
  GapAnalysisResult,
  SearchOverrides,
} from "./models.js";
import { fetchAllJobs, type FetchJobsFn, type FetchResult } from "./sources.js";
import { rankJobs, rankJobsHybrid, rankJobsWithEmbeddings } from "./matching/index.js";
import { getActiveEmbeddingProvider } from "./embedding/index.js";
import { draftOutreach, buildTemplateCoverLetter } from "./drafting.js";
import {
  enhanceDraft,
  generateCoverLetter,
  enhanceGapAnalysis,
  type EnhanceOptions,
} from "./llm-enhance.js";
import { checkLicense, type CheckLicenseOptions } from "./license.js";
import { TrackingRepository } from "./tracking.js";
import { DEFAULT_TOP_K, FREE_TOP_K, PRO_TOP_K, SEMANTIC_MATCHING } from "./config.js";
import { gapAnalysis } from "./gap.js";
import {
  CAREERCLAW_FEATURES,
  hasCareerClawFeature,
  type ClawOsExecutionContext,
} from "./execution-context.js";

export interface BriefingOptions {
  topK?: number;
  dryRun?: boolean;
  fetchFn?: FetchJobsFn;
  repo?: TrackingRepository;
  resumeIntel?: ResumeIntelligence;
  resumeText?: string;
  proKey?: string;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  licenseFetchFn?: CheckLicenseOptions["fetchFn"];
  licenseCachePath?: string;
  /** 0-based indices into the matches array to generate cover letters for. */
  coverLetterMatchIndices?: number[];
  /** 0-based indices into the matches array to run gap analysis for. */
  gapAnalysisMatchIndices?: number[];
  /**
   * Session-scoped search overrides — augment the profile for this run only.
   * Use for agent-driven queries like "find me AI jobs" or "jobs at Google".
   */
  searchOverrides?: SearchOverrides;
}

export interface ContextBriefingOptions {
  topK?: number;
  dryRun?: boolean;
  fetchFn?: FetchJobsFn;
  repo?: TrackingRepository;
  resumeIntel?: ResumeIntelligence;
  resumeText?: string;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  /** 0-based indices into the matches array to generate cover letters for. */
  coverLetterMatchIndices?: number[];
  /** 0-based indices into the matches array to run gap analysis for. */
  gapAnalysisMatchIndices?: number[];
  /**
   * Session-scoped search overrides — augment the profile for this run only.
   * Use for agent-driven queries like "find me AI jobs" or "jobs at Google".
   */
  searchOverrides?: SearchOverrides;
}

type InternalExecutionMode =
  | {
      kind: "standalone";
      proKey?: string;
      licenseFetchFn?: CheckLicenseOptions["fetchFn"];
      licenseCachePath?: string;
    }
  | {
      kind: "clawos";
      context: ClawOsExecutionContext;
    };

export async function runBriefing(
  profile: UserProfile,
  options: BriefingOptions = {}
): Promise<BriefingResult> {
  return runBriefingInternal(profile, options, {
    kind: "standalone",
    ...(options.proKey !== undefined ? { proKey: options.proKey } : {}),
    ...(options.licenseFetchFn !== undefined
      ? { licenseFetchFn: options.licenseFetchFn }
      : {}),
    ...(options.licenseCachePath !== undefined
      ? { licenseCachePath: options.licenseCachePath }
      : {}),
  });
}

export async function runBriefingWithContext(
  profile: UserProfile,
  context: ClawOsExecutionContext,
  options: ContextBriefingOptions = {}
): Promise<BriefingResult> {
  return runBriefingInternal(profile, options, {
    kind: "clawos",
    context,
  });
}

async function runBriefingInternal(
  profile: UserProfile,
  options: {
    topK?: number;
    dryRun?: boolean;
    fetchFn?: FetchJobsFn;
    repo?: TrackingRepository;
    resumeIntel?: ResumeIntelligence;
    resumeText?: string;
    enhanceFetchFn?: EnhanceOptions["fetchFn"];
    coverLetterMatchIndices?: number[];
    gapAnalysisMatchIndices?: number[];
    searchOverrides?: SearchOverrides;
  },
  executionMode: InternalExecutionMode
): Promise<BriefingResult> {
  const {
    topK = DEFAULT_TOP_K,
    dryRun = false,
    fetchFn = fetchAllJobs,
    repo = new TrackingRepository({ dryRun }),
    resumeIntel,
    resumeText,
    enhanceFetchFn,
    coverLetterMatchIndices = [],
    gapAnalysisMatchIndices = [],
    searchOverrides,
  } = options;

  const rankingProfile = applySearchOverridesToProfile(profile, searchOverrides);

  const isProActive = await resolvePremiumDraftAccess(executionMode, resumeIntel);

  // Enforce tier-aware topK ceiling — the engine must not trust the caller.
  // ClawOS checks the specific TOPK_EXTENDED feature (separate from draft access).
  // Standalone uses isProActive since a valid license grants all Pro capabilities.
  const hasExtendedTopK =
    executionMode.kind === "clawos"
      ? hasCareerClawFeature(
          executionMode.context,
          CAREERCLAW_FEATURES.TOPK_EXTENDED
        )
      : isProActive;
  const maxTopK = hasExtendedTopK ? PRO_TOP_K : FREE_TOP_K;
  const clampedTopK = Math.min(topK, maxTopK);

  const runAt = new Date().toISOString();
  const runId = randomUUID();
  const version = readPackageVersion();

  const fetchStart = Date.now();
  let fetchResult: FetchResult;
  try {
    fetchResult = await fetchFn(profile, searchOverrides);
  } catch {
    fetchResult = { jobs: [], counts: {}, errors: {} };
  }
  const fetchMs = Date.now() - fetchStart;

  const { jobs, counts: sourceCounts } = fetchResult;

  const rankStart = Date.now();
  const embeddingProvider = getActiveEmbeddingProvider();
  const matches: ScoredJob[] = jobs.length === 0
    ? []
    : embeddingProvider
    ? await rankJobsWithEmbeddings(jobs, rankingProfile, {
        embeddingProvider,
        limit: clampedTopK,
        ...(resumeText !== undefined ? { resumeText } : {}),
        ...(searchOverrides !== undefined ? { searchOverrides } : {}),
      })
    : SEMANTIC_MATCHING.ENABLED
    ? await rankJobsHybrid(jobs, rankingProfile, {
        limit: clampedTopK,
        ...(resumeText !== undefined ? { resumeText } : {}),
        ...(resumeIntel !== undefined ? { resumeIntel } : {}),
        ...(searchOverrides !== undefined ? { searchOverrides } : {}),
      })
    : rankJobs(jobs, rankingProfile, clampedTopK, 0.01, searchOverrides);
  const rankMs = Date.now() - rankStart;

  const draftStart = Date.now();
  const drafts: OutreachDraft[] = await Promise.all(
    matches.map(async (scored) => {
      const baseline = draftOutreach(scored.job, profile, scored.matched_keywords);
      if (isProActive && resumeIntel) {
        return enhanceDraft(
          scored.job,
          profile,
          resumeIntel,
          baseline,
          scored.gap_keywords,
          enhanceFetchFn !== undefined ? { fetchFn: enhanceFetchFn } : {}
        );
      }
      return baseline;
    })
  );
  const draftMs = Date.now() - draftStart;

  // ── Gap analysis (Pro + RESUME_GAP_ANALYSIS only) ─────────────────────
  const hasGapAnalysisFeature =
    executionMode.kind === "clawos"
      ? hasCareerClawFeature(
          executionMode.context,
          CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS
        )
      : isProActive;

  // Pre-compute gap analyses — these are reused by cover letters below
  // to ensure "single source of truth" (no drift between gap report and letter).
  const gapCache = new Map<number, GapAnalysisResult>();
  const gapAnalyses: GapAnalysisReport[] = [];

  if (hasGapAnalysisFeature && resumeIntel && gapAnalysisMatchIndices.length > 0) {
    for (const idx of gapAnalysisMatchIndices) {
      if (idx < 0 || idx >= matches.length) continue;
      const match = matches[idx]!;
      const report = await generateGapAnalysisForMatch(match, resumeIntel, {
        enhanceFetchFn,
        ...(executionMode.kind === "clawos" ? { executionContext: executionMode.context } : {}),
      });
      gapAnalyses.push(report);
      gapCache.set(idx, report.analysis);
    }
  }

  // ── Cover letter generation (Pro + TAILORED_COVER_LETTER only) ──────────
  const hasCoverLetterFeature =
    executionMode.kind === "clawos"
      ? hasCareerClawFeature(
          executionMode.context,
          CAREERCLAW_FEATURES.TAILORED_COVER_LETTER
        )
      : isProActive;

  const coverLetters: CoverLetter[] = [];

  if (hasCoverLetterFeature && resumeIntel && coverLetterMatchIndices.length > 0) {
    for (const idx of coverLetterMatchIndices) {
      if (idx < 0 || idx >= matches.length) continue;
      const match = matches[idx]!;
      const precomputedGap = gapCache.get(idx);
      coverLetters.push(
        await generateCoverLetterForMatch(match, profile, resumeIntel, {
          enhanceFetchFn,
          ...(precomputedGap !== undefined && { precomputedGap }),
        })
      );
    }
  }

  const persistStart = Date.now();
  const trackingResult = repo.upsertEntries(
    matches.map((s) => s.job),
    matches
  );

  const run: BriefingRun = {
    run_id: runId,
    run_at: runAt,
    dry_run: dryRun,
    jobs_fetched: jobs.length,
    jobs_ranked: jobs.length,
    jobs_matched: matches.length,
    sources: sourceCounts,
    timings: {
      fetch_ms: fetchMs,
      rank_ms: rankMs,
      draft_ms: draftMs,
      persist_ms: null,
    },
    version,
  };

  repo.appendRun(run);
  const persistMs = Date.now() - persistStart;
  run.timings.persist_ms = persistMs;

  return {
    run,
    matches,
    drafts,
    resume_intel: resumeIntel ?? null,
    cover_letters: coverLetters,
    gap_analyses: gapAnalyses,
    tracking: {
      created: trackingResult.created,
      already_present: trackingResult.already_present,
    },
    dry_run: dryRun,
  };
}

function applySearchOverridesToProfile(
  profile: UserProfile,
  overrides?: SearchOverrides,
): UserProfile {
  const targetSkills = (overrides?.target_skills ?? [])
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);

  if (targetSkills.length === 0) {
    return profile;
  }

  return {
    ...profile,
    skills: [...new Set([...profile.skills, ...targetSkills])],
  };
}

// ---------------------------------------------------------------------------
// Standalone cover letter generation
// ---------------------------------------------------------------------------

export interface CoverLetterOptions {
  /** Injectable fetch for LLM calls — defaults to global fetch. */
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  /** Pre-computed gap analysis result. Skips re-computation if provided. */
  precomputedGap?: GapAnalysisResult;
  /**
   * Verified execution context from the calling platform.
   *
   * When provided, `generateCoverLetterForMatch` enforces the
   * `TAILORED_COVER_LETTER` feature gate as a defense-in-depth check before
   * attempting any LLM call. Callers (e.g. ClawOS worker) are expected to
   * have already verified entitlements upstream — this is a secondary guard.
   */
  executionContext?: ClawOsExecutionContext;
}

export interface GapAnalysisOptions {
  /** Injectable fetch for LLM calls — defaults to global fetch. */
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  /**
   * Verified execution context from the calling platform.
   *
   * When provided, `generateGapAnalysisForMatch` enforces the
   * `LLM_GAP_ANALYSIS` feature gate before attempting any LLM enhancement.
   * The algorithmic `analysis` result is always returned either way.
   */
  executionContext?: ClawOsExecutionContext;
}

/**
 * Generate a cover letter for a single scored match (Pro tier).
 *
 * This is the atomic unit for cover letter generation. It can be called:
 *   - From the briefing pipeline (via coverLetterMatchIndices)
 *   - Standalone by ClawOS when a user picks a specific match
 *   - From the CLI with --cover-letter <index>
 *
 * Attempts LLM generation first; falls back to a deterministic template.
 *
 * If you already have a `GapAnalysisResult` for this match (e.g. from a prior
 * call to `generateGapAnalysisForMatch`), pass it as `options.precomputedGap`
 * to avoid running `gapAnalysis()` a second time. Without it, this function
 * computes the gap analysis internally on every call.
 *
 * @see generateGapAnalysisForMatch
 */
export async function generateCoverLetterForMatch(
  match: ScoredJob,
  profile: UserProfile,
  resumeIntel: ResumeIntelligence,
  options: CoverLetterOptions = {}
): Promise<CoverLetter> {
  const { enhanceFetchFn, precomputedGap, executionContext } = options;
  // Hoist gap computation — used by both the feature-gate early return and the
  // normal LLM/template paths, so compute once regardless of which path runs.
  const gapResult = precomputedGap ?? gapAnalysis(resumeIntel, match.job);

  // Defense-in-depth: if a verified context is provided and the
  // TAILORED_COVER_LETTER feature is absent, return template immediately
  // without attempting any LLM call. The primary gate lives upstream in the
  // calling platform — this is a secondary guard.
  if (
    executionContext !== undefined &&
    !hasCareerClawFeature(executionContext, CAREERCLAW_FEATURES.TAILORED_COVER_LETTER)
  ) {
    const templateResult = buildTemplateCoverLetter(
      match.job,
      profile,
      match.matched_keywords,
      gapResult
    );
    return {
      ...templateResult,
      _meta: {
        provider: "template",
        model: "deterministic",
        attempts: 0,
        fallback_reason: "feature_not_entitled",
        latency_ms: 0,
      },
    };
  }

  const genStartMs = Date.now();

  // Attempt LLM generation; fall back to deterministic template
  const { result: llmResult, attempts: llmAttempts } = await generateCoverLetter(
    match.job,
    profile,
    resumeIntel,
    match.gap_keywords,
    enhanceFetchFn !== undefined ? { fetchFn: enhanceFetchFn } : {}
  );

  const genLatencyMs = Date.now() - genStartMs;

  if (llmResult) {
    return {
      job_id: match.job.job_id,
      body: llmResult.body,
      tone: "professional",
      is_template: false,
      match_score: gapResult.fit_score,
      keyword_coverage: {
        top_signals: gapResult.summary.top_signals.keywords,
        top_gaps: gapResult.summary.top_gaps.keywords,
      },
      _meta: {
        provider: llmResult.provider,
        model: llmResult.model,
        attempts: llmAttempts,
        fallback_reason: null,
        latency_ms: genLatencyMs,
      },
    };
  }

  // LLM failed — deterministic template fallback
  const templateResult = buildTemplateCoverLetter(
    match.job,
    profile,
    match.matched_keywords,
    gapResult
  );

  return {
    ...templateResult,
    _meta: {
      provider: "template",
      model: "deterministic",
      attempts: llmAttempts,
      fallback_reason: "llm_chain_exhausted",
      latency_ms: genLatencyMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Standalone gap analysis
// ---------------------------------------------------------------------------

/**
 * Run a detailed gap analysis for a single scored match (Pro tier).
 *
 * This is the atomic unit for gap analysis. It can be called:
 *   - From the briefing pipeline (via gapAnalysisMatchIndices)
 *   - Standalone by ClawOS when a user picks a specific match
 *   - From the CLI with --gap-analysis <index>
 *
 * Returns the algorithmic gap analysis plus optional LLM-generated
 * qualitative enhancement when the caller is entitled.
 *
 * The returned `analysis` field can be passed as `precomputedGap` to
 * `generateCoverLetterForMatch()` to avoid redundant computation.
 */
export async function generateGapAnalysisForMatch(
  match: ScoredJob,
  resumeIntel: ResumeIntelligence,
  options: GapAnalysisOptions = {}
): Promise<GapAnalysisReport> {
  const { executionContext, enhanceFetchFn } = options;
  const result = gapAnalysis(resumeIntel, match.job);

  if (
    executionContext === undefined ||
    !hasCareerClawFeature(executionContext, CAREERCLAW_FEATURES.LLM_GAP_ANALYSIS)
  ) {
    return {
      job_id: match.job.job_id,
      title: match.job.title,
      company: match.job.company,
      analysis: result,
      _meta: {
        provider: "none",
        model: "none",
        attempts: 0,
        fallback_reason:
          executionContext === undefined ? "execution_context_missing" : "feature_not_entitled",
        latency_ms: 0,
      },
    };
  }

  const enhancementStartMs = Date.now();
  const { result: enhancementResult, attempts } = await enhanceGapAnalysis(
    result,
    match.job,
    resumeIntel,
    enhanceFetchFn !== undefined ? { fetchFn: enhanceFetchFn } : {}
  );
  const enhancementLatencyMs = Date.now() - enhancementStartMs;

  if (!enhancementResult) {
    return {
      job_id: match.job.job_id,
      title: match.job.title,
      company: match.job.company,
      analysis: result,
      _meta: {
        provider: "none",
        model: "none",
        attempts,
        fallback_reason: "llm_chain_exhausted",
        latency_ms: enhancementLatencyMs,
      },
    };
  }

  return {
    job_id: match.job.job_id,
    title: match.job.title,
    company: match.job.company,
    analysis: result,
    enhancement: enhancementResult.enhancement,
    _meta: {
      provider: enhancementResult.provider,
      model: enhancementResult.model,
      attempts,
      fallback_reason: null,
      latency_ms: enhancementLatencyMs,
    },
  };
}

async function resolvePremiumDraftAccess(
  executionMode: InternalExecutionMode,
  resumeIntel?: ResumeIntelligence
): Promise<boolean> {
  if (!resumeIntel) {
    return false;
  }

  if (executionMode.kind === "clawos") {
    return (
      executionMode.context.tier === "pro" &&
      hasCareerClawFeature(
        executionMode.context,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT
      )
    );
  }

  const proKey = executionMode.proKey?.trim();
  if (!proKey) {
    return false;
  }

  const licenseOptions: CheckLicenseOptions = {};
  if (executionMode.licenseFetchFn !== undefined) {
    licenseOptions.fetchFn = executionMode.licenseFetchFn;
  }
  if (executionMode.licenseCachePath !== undefined) {
    licenseOptions.cachePath = executionMode.licenseCachePath;
  }

  const licenseResult = await checkLicense(proKey, licenseOptions);
  return licenseResult.valid;
}

function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("./package.json") as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}
