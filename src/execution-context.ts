/**
 * execution-context.ts — Trusted execution context for CareerClaw runtimes.
 *
 * CareerClaw runs in two distinct modes:
 *   1. standalone  — local CLI / direct package use with standalone licensing
 *   2. clawos      — trusted platform execution after upstream entitlement verification
 *
 * Important security boundary:
 *   - The public CLI NEVER accepts a Pro bypass flag.
 *   - ClawOS Pro activation is expected to be validated upstream by ClawOS
 *     before this package receives a verified execution context.
 */

export const CAREERCLAW_FEATURES = {
  LLM_OUTREACH_DRAFT: "careerclaw.llm_outreach_draft",
  LLM_GAP_ANALYSIS: "careerclaw.llm_gap_analysis",
  TAILORED_COVER_LETTER: "careerclaw.tailored_cover_letter",
  RESUME_GAP_ANALYSIS: "careerclaw.resume_gap_analysis",
  TOPK_EXTENDED: "careerclaw.topk_extended",
} as const;

export type CareerClawFeatureKey =
  (typeof CAREERCLAW_FEATURES)[keyof typeof CAREERCLAW_FEATURES];

export interface StandaloneExecutionContext {
  source: "standalone";
  tier: "free" | "pro";
  features: readonly string[];
  licenseMode: "standalone";
}

export interface ClawOsExecutionContext {
  source: "clawos";
  verified: true;
  tier: "free" | "pro";
  features: readonly string[];
}

export type CareerClawExecutionContext =
  | StandaloneExecutionContext
  | ClawOsExecutionContext;

export const STANDALONE_PRO_FEATURES: readonly CareerClawFeatureKey[] = [
  CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
  CAREERCLAW_FEATURES.LLM_GAP_ANALYSIS,
  CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
];

export function createStandaloneExecutionContext(
  tier: "free" | "pro" = "free"
): StandaloneExecutionContext {
  return {
    source: "standalone",
    tier,
    features: tier === "pro" ? [...STANDALONE_PRO_FEATURES] : [],
    licenseMode: "standalone",
  };
}

export function createClawOsExecutionContext(params: {
  tier: "free" | "pro";
  features?: readonly string[];
}): ClawOsExecutionContext {
  return {
    source: "clawos",
    verified: true,
    tier: params.tier,
    features: params.features ?? [],
  };
}

export function hasCareerClawFeature(
  context: Pick<CareerClawExecutionContext, "features">,
  feature: CareerClawFeatureKey
): boolean {
  return context.features.includes(feature);
}
