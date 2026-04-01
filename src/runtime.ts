/**
 * runtime.ts — Programmatic runtime wrappers for CareerClaw.
 *
 * These helpers provide the clean boundary ClawOS needs for direct imports
 * while preserving the existing standalone CLI flow.
 */

import type { ResumeIntelligence, UserProfile, BriefingResult } from "./models.js";
import { buildResumeIntelligence } from "./resume-intel.js";
import { runBriefing, runBriefingWithContext } from "./briefing.js";
import type { FetchResult } from "./sources.js";
import { TrackingRepository } from "./tracking.js";
import type { EnhanceOptions } from "./llm-enhance.js";
import type { CheckLicenseOptions } from "./license.js";
import type { ClawOsExecutionContext } from "./execution-context.js";

export interface CareerClawRunInput {
  profile: UserProfile;
  resumeText?: string | null;
  topK?: number;
  dryRun?: boolean;
  /** 0-based indices into the matches array to generate cover letters for. */
  coverLetterMatchIndices?: number[];
  /** 0-based indices into the matches array to run gap analysis for. */
  gapAnalysisMatchIndices?: number[];
}

export interface CareerClawRunSupportOptions {
  fetchFn?: () => Promise<FetchResult>;
  repo?: TrackingRepository;
  resumeIntel?: ResumeIntelligence;
  enhanceFetchFn?: EnhanceOptions["fetchFn"];
  licenseFetchFn?: CheckLicenseOptions["fetchFn"];
  licenseCachePath?: string;
}

export interface CareerClawStandaloneRunOptions
  extends CareerClawRunSupportOptions {
  proKey?: string;
}

export async function runCareerClawStandalone(
  input: CareerClawRunInput,
  options: CareerClawStandaloneRunOptions = {}
): Promise<BriefingResult> {
  const resumeIntel = resolveResumeIntelligence(
    input.profile,
    input.resumeText,
    options.resumeIntel
  );

  return runBriefing(input.profile, {
    ...(input.topK !== undefined ? { topK: input.topK } : {}),
    ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
    ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    ...(options.repo !== undefined ? { repo: options.repo } : {}),
    resumeIntel,
    ...(typeof input.resumeText === "string" ? { resumeText: input.resumeText } : {}),
    ...(options.proKey !== undefined ? { proKey: options.proKey } : {}),
    ...(options.enhanceFetchFn !== undefined
      ? { enhanceFetchFn: options.enhanceFetchFn }
      : {}),
    ...(options.licenseFetchFn !== undefined
      ? { licenseFetchFn: options.licenseFetchFn }
      : {}),
    ...(options.licenseCachePath !== undefined
      ? { licenseCachePath: options.licenseCachePath }
      : {}),
    ...(input.coverLetterMatchIndices !== undefined
      ? { coverLetterMatchIndices: input.coverLetterMatchIndices }
      : {}),
    ...(input.gapAnalysisMatchIndices !== undefined
      ? { gapAnalysisMatchIndices: input.gapAnalysisMatchIndices }
      : {}),
  });
}

export async function runCareerClawWithContext(
  input: CareerClawRunInput,
  context: ClawOsExecutionContext,
  options: CareerClawRunSupportOptions = {}
): Promise<BriefingResult> {
  const resumeIntel = resolveResumeIntelligence(
    input.profile,
    input.resumeText,
    options.resumeIntel
  );

  return runBriefingWithContext(input.profile, context, {
    ...(input.topK !== undefined ? { topK: input.topK } : {}),
    ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
    ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    ...(options.repo !== undefined ? { repo: options.repo } : {}),
    resumeIntel,
    ...(typeof input.resumeText === "string" ? { resumeText: input.resumeText } : {}),
    ...(options.enhanceFetchFn !== undefined
      ? { enhanceFetchFn: options.enhanceFetchFn }
      : {}),
    ...(input.coverLetterMatchIndices !== undefined
      ? { coverLetterMatchIndices: input.coverLetterMatchIndices }
      : {}),
    ...(input.gapAnalysisMatchIndices !== undefined
      ? { gapAnalysisMatchIndices: input.gapAnalysisMatchIndices }
      : {}),
  });
}

export function resolveResumeIntelligence(
  profile: UserProfile,
  resumeText?: string | null,
  explicit?: ResumeIntelligence
): ResumeIntelligence {
  if (explicit) return explicit;

  const params: Parameters<typeof buildResumeIntelligence>[0] = {
    resume_summary: profile.resume_summary ?? "",
    skills: profile.skills,
    target_roles: profile.target_roles,
  };

  if (resumeText && resumeText.trim().length > 0) {
    params.resume_text = resumeText;
  }

  return buildResumeIntelligence(params);
}
