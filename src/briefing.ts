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
  BriefingRun,
  BriefingResult,
  ResumeIntelligence,
} from "./models.js";
import { fetchAllJobs, type FetchResult } from "./sources.js";
import { rankJobs } from "./matching/index.js";
import { draftOutreach } from "./drafting.js";
import { enhanceDraft, type EnhanceOptions } from "./llm-enhance.js";
import { checkLicense, type CheckLicenseOptions } from "./license.js";
import { TrackingRepository } from "./tracking.js";
import { DEFAULT_TOP_K, FREE_TOP_K, PRO_TOP_K } from "./config.js";
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
  proKey?: string;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  licenseFetchFn?: CheckLicenseOptions["fetchFn"];
  licenseCachePath?: string;
}

export interface ContextBriefingOptions {
  topK?: number;
  dryRun?: boolean;
  fetchFn?: () => Promise<FetchResult>;
  repo?: TrackingRepository;
  resumeIntel?: ResumeIntelligence;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
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
    enhanceFetchFn?: EnhanceOptions["fetchFn"];
  },
  executionMode: InternalExecutionMode
): Promise<BriefingResult> {
  const {
    topK = DEFAULT_TOP_K,
    dryRun = false,
    fetchFn = fetchAllJobs,
    repo = new TrackingRepository({ dryRun }),
    resumeIntel,
    enhanceFetchFn,
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
  const matches: ScoredJob[] = jobs.length > 0 ? rankJobs(jobs, profile, clampedTopK) : [];
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
    tracking: {
      created: trackingResult.created,
      already_present: trackingResult.already_present,
    },
    dry_run: dryRun,
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
