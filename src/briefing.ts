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
} from "./models.js";
import { fetchAllJobs, type FetchResult } from "./sources.js";
import { rankJobs, rankJobsHybrid } from "./matching/index.js";
import { draftOutreach, buildTemplateCoverLetter } from "./drafting.js";
import { enhanceDraft, generateCoverLetter, type EnhanceOptions } from "./llm-enhance.js";
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
  fetchFn?: () => Promise<FetchResult>;
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
}

export interface ContextBriefingOptions {
  topK?: number;
  dryRun?: boolean;
  fetchFn?: () => Promise<FetchResult>;
  repo?: TrackingRepository;
  resumeIntel?: ResumeIntelligence;
  resumeText?: string;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  /** 0-based indices into the matches array to generate cover letters for. */
  coverLetterMatchIndices?: number[];
  /** 0-based indices into the matches array to run gap analysis for. */
  gapAnalysisMatchIndices?: number[];
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
    fetchFn?: () => Promise<FetchResult>;
    repo?: TrackingRepository;
    resumeIntel?: ResumeIntelligence;
    resumeText?: string;
    enhanceFetchFn?: EnhanceOptions["fetchFn"];
    coverLetterMatchIndices?: number[];
    gapAnalysisMatchIndices?: number[];
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
  } = options;

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
    fetchResult = await fetchFn();
  } catch {
    fetchResult = { jobs: [], counts: {}, errors: {} };
  }
  const fetchMs = Date.now() - fetchStart;

  const { jobs, counts: sourceCounts } = fetchResult;

  const rankStart = Date.now();
  const matches: ScoredJob[] = jobs.length === 0
    ? []
    : SEMANTIC_MATCHING.ENABLED
    ? await rankJobsHybrid(jobs, profile, {
        limit: clampedTopK,
        ...(resumeText !== undefined ? { resumeText } : {}),
        ...(resumeIntel !== undefined ? { resumeIntel } : {}),
      })
    : rankJobs(jobs, profile, clampedTopK);
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
      const report = generateGapAnalysisForMatch(match, resumeIntel);
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

// ---------------------------------------------------------------------------
// Standalone cover letter generation
// ---------------------------------------------------------------------------

export interface CoverLetterOptions {
  /** Injectable fetch for LLM calls — defaults to global fetch. */
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  /** Pre-computed gap analysis result. Skips re-computation if provided. */
  precomputedGap?: GapAnalysisResult;
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
  const { enhanceFetchFn, precomputedGap } = options;
  const gapResult = precomputedGap ?? gapAnalysis(resumeIntel, match.job);

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
 * No LLM calls — pure computation. Returns a GapAnalysisReport with
 * job metadata for UI display symmetry with CoverLetter.
 *
 * The returned `analysis` field can be passed as `precomputedGap` to
 * `generateCoverLetterForMatch()` to avoid redundant computation.
 */
export function generateGapAnalysisForMatch(
  match: ScoredJob,
  resumeIntel: ResumeIntelligence,
): GapAnalysisReport {
  const result = gapAnalysis(resumeIntel, match.job);
  return {
    job_id: match.job.job_id,
    title: match.job.title,
    company: match.job.company,
    analysis: result,
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
