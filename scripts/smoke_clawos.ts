/**
 * smoke_clawos.ts — ClawOS integration smoke test.
 *
 * Simulates ClawOS acting as the trusted platform host, invoking CareerClaw
 * via runCareerClawWithContext() after upstream entitlement verification.
 *
 * KEY DIFFERENCE FROM STANDALONE:
 *   - No Gumroad license validation — ClawOS has already verified upstream.
 *   - Features are granted explicitly per user subscription (flat Pro bundle).
 *   - TOPK_EXTENDED and TAILORED_COVER_LETTER are ClawOS-exclusive features.
 *
 * LLM KEY INJECTION NOTE:
 *   In production, ClawOS injects its own LLM keys before the process loads
 *   (e.g. via subprocess env setup). The CAREERCLAW_ANTHROPIC_KEY /
 *   CAREERCLAW_OPENAI_KEY values here come from .env as a test stand-in.
 *   Marked with [CLAWOS INJECT] below.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/smoke_clawos.ts
 */

import { readFileSync } from "fs";
import {
  runCareerClawWithContext,
} from "../src/runtime.js";
import {
  createClawOsExecutionContext,
  CAREERCLAW_FEATURES,
} from "../src/execution-context.js";
import type {
  UserProfile,
  BriefingResult,
  CoverLetter,
  GapAnalysisReport,
} from "../src/models.js";

// ---------------------------------------------------------------------------
// Load user data (ClawOS owns the profile store)
// ---------------------------------------------------------------------------

const profile = JSON.parse(
  readFileSync(".careerclaw/profile.json", "utf8")
) as UserProfile;

const resumeText = readFileSync(".careerclaw/resume.txt", "utf8");

// ---------------------------------------------------------------------------
// Execution contexts
// ClawOS constructs these after upstream billing/entitlement verification.
// [CLAWOS INJECT] — LLM keys would be injected into the process env here.
// ---------------------------------------------------------------------------

const freeCtx = createClawOsExecutionContext({
  tier: "free",
  features: [],
});

const proBasicCtx = createClawOsExecutionContext({
  tier: "pro",
  features: [
    CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
    CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
  ],
});

const proFullCtx = createClawOsExecutionContext({
  tier: "pro",
  features: [
    CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
    CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
    CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
    CAREERCLAW_FEATURES.TOPK_EXTENDED,
  ],
});

const proNoTopKCtx = createClawOsExecutionContext({
  tier: "pro",
  features: [
    CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
    CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
    CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
  ],
});

const proNoClCtx = createClawOsExecutionContext({
  tier: "pro",
  features: [
    CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
    CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
    CAREERCLAW_FEATURES.TOPK_EXTENDED,
  ],
});

// ---------------------------------------------------------------------------
// Rendering helpers (simulate what ClawOS renders to the user's channel)
// ---------------------------------------------------------------------------

function renderHeader(action: string, userSays: string, contextLabel: string): void {
  console.log(`\n${"═".repeat(72)}`);
  console.log(`Action ${action} | Context: ${contextLabel}`);
  console.log(`User: "${userSays}"`);
  console.log(`${"─".repeat(72)}`);
}

function renderResult(result: BriefingResult): void {
  const { run, matches, drafts, cover_letters, gap_analyses } = result;

  console.log(
    `Fetched ${run.jobs_fetched} jobs in ${run.timings.fetch_ms}ms ` +
    `| Ranked in ${run.timings.rank_ms}ms ` +
    `| ${matches.length} match(es) returned`
  );
  console.log(`Sources: ${Object.entries(run.sources).map(([s, n]) => `${s}: ${n}`).join(" | ")}`);
  if (result.dry_run) console.log(`(dry-run — tracking not written)`);

  if (matches.length === 0) {
    console.log(`\nNo matches found.`);
    return;
  }

  console.log(`\nMatches:`);
  matches.forEach((m, i) => {
    const fitPct = Math.round((m.breakdown.keyword ?? 0) * 100);
    console.log(
      `  ${i + 1}. ${m.job.title} @ ${m.job.company}  [${m.job.source}]`
    );
    console.log(
      `     score: ${m.score} | keyword overlap: ${fitPct}% | ` +
      `salary_min: ${m.job.salary_min ?? "—"} | mode: ${m.job.work_mode ?? "—"}`
    );
    console.log(`     signals: ${m.matched_keywords.slice(0, 5).join(", ")}`);
    console.log(`     gaps:    ${m.gap_keywords.slice(0, 5).join(", ")}`);
  });

  if (drafts.length > 0) {
    console.log(`\nOutreach Drafts:`);
    drafts.forEach((d, i) => {
      const tag = d.llm_enhanced ? "[LLM]" : "[template]";
      const preview = d.body.slice(0, 120).replace(/\n/g, " ");
      console.log(`  ${i + 1}. ${tag} Subject: ${d.subject}`);
      console.log(`     Preview: ${preview}…`);
    });
  }

  if (cover_letters.length > 0) {
    console.log(`\nCover Letters:`);
    cover_letters.forEach((cl: CoverLetter) => {
      const match = matches.find((m) => m.job.job_id === cl.job_id);
      const label = match ? `${match.job.title} @ ${match.job.company}` : cl.job_id;
      const tag = cl.is_template ? "[template fallback]" : "[LLM]";
      const scorePct = Math.round(cl.match_score * 100);
      const preview = cl.body.slice(0, 120).replace(/\n/g, " ");
      console.log(`  ${tag} ${label} | fit: ${scorePct}%`);
      console.log(`  Signals: ${cl.keyword_coverage.top_signals.slice(0, 4).join(", ")}`);
      console.log(`  Gaps:    ${cl.keyword_coverage.top_gaps.slice(0, 4).join(", ")}`);
      console.log(`  Preview: ${preview}…`);
    });
  }

  if (gap_analyses.length > 0) {
    console.log(`\nGap Analyses:`);
    gap_analyses.forEach((ga: GapAnalysisReport) => {
      const fitPct = Math.round(ga.analysis.fit_score * 100);
      const fitRawPct = Math.round(ga.analysis.fit_score_unweighted * 100);
      console.log(`  ${ga.title} @ ${ga.company}`);
      console.log(`  Fit: ${fitPct}% weighted | ${fitRawPct}% unweighted`);
      console.log(`  Signals: ${ga.analysis.summary.top_signals.keywords.slice(0, 4).join(", ")}`);
      console.log(`  Gaps:    ${ga.analysis.summary.top_gaps.keywords.slice(0, 4).join(", ")}`);
    });
  }
}

function renderAssertions(label: string, checks: Array<{ desc: string; pass: boolean }>): void {
  console.log(`\nAssertions [${label}]:`);
  let allPass = true;
  for (const { desc, pass } of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${desc}`);
    if (!pass) allPass = false;
  }
  if (!allPass) {
    console.error(`\n  ❌ One or more assertions failed for ${label}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Action runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`ClawOS × CareerClaw — Integration Smoke Test`);
  console.log(`Profile: ${profile.target_roles?.[0] ?? "Professional"} | Resume: loaded`);

  // ── Action A: Free tier daily briefing ────────────────────────────────────
  renderHeader("A", "Run my daily briefing", "free");
  const resultA = await runCareerClawWithContext(
    { profile, resumeText, topK: 3, dryRun: true },
    freeCtx
  );
  renderResult(resultA);
  renderAssertions("A — free briefing", [
    { desc: "returns exactly 3 matches (free cap)", pass: resultA.matches.length === 3 },
    { desc: "all drafts are template (no LLM)", pass: resultA.drafts.every((d) => !d.llm_enhanced) },
    { desc: "cover_letters is empty", pass: resultA.cover_letters.length === 0 },
    { desc: "gap_analyses is empty", pass: resultA.gap_analyses.length === 0 },
    { desc: "context source is clawos", pass: freeCtx.source === "clawos" },
    { desc: "context verified flag is true", pass: freeCtx.verified === true },
  ]);

  // ── Action B: Pro Basic daily briefing ────────────────────────────────────
  renderHeader("B", "Run my daily briefing", "pro — LLM_OUTREACH_DRAFT + RESUME_GAP_ANALYSIS");
  const resultB = await runCareerClawWithContext(
    { profile, resumeText, topK: 3, dryRun: true },
    proBasicCtx
  );
  renderResult(resultB);
  renderAssertions("B — pro basic briefing", [
    { desc: "returns exactly 3 matches (no TOPK_EXTENDED)", pass: resultB.matches.length === 3 },
    { desc: "at least one draft is LLM-enhanced", pass: resultB.drafts.some((d) => d.llm_enhanced) },
    { desc: "cover_letters is empty (TAILORED_COVER_LETTER not granted)", pass: resultB.cover_letters.length === 0 },
    { desc: "gap_analyses is empty (none requested)", pass: resultB.gap_analyses.length === 0 },
  ]);

  // ── Action C: Pro Full — top 5 matches (discovery run) ───────────────────
  renderHeader("C", "Show me my top 5 matches", "pro full (all 4 features)");
  const resultC = await runCareerClawWithContext(
    { profile, resumeText, topK: 5, dryRun: true },
    proFullCtx
  );
  renderResult(resultC);
  renderAssertions("C — pro full, topK=5", [
    { desc: "returns 5 matches (TOPK_EXTENDED granted)", pass: resultC.matches.length === 5 },
    { desc: "all drafts are LLM-enhanced", pass: resultC.drafts.every((d) => d.llm_enhanced) },
    { desc: "cover_letters is empty (none requested)", pass: resultC.cover_letters.length === 0 },
    { desc: "gap_analyses is empty (none requested)", pass: resultC.gap_analyses.length === 0 },
  ]);

  // ── Action D: Pro Full — cover letter for match 1 ─────────────────────────
  renderHeader("D", "Write a cover letter for match 1", "pro full (all 4 features)");
  const resultD = await runCareerClawWithContext(
    { profile, resumeText, topK: 5, dryRun: true, coverLetterMatchIndices: [0] },
    proFullCtx
  );
  renderResult(resultD);
  renderAssertions("D — cover letter for match 1", [
    { desc: "exactly 1 cover letter returned", pass: resultD.cover_letters.length === 1 },
    { desc: "cover letter is LLM-generated (not template)", pass: resultD.cover_letters[0]?.is_template === false },
    { desc: "cover letter job_id matches match #1", pass: resultD.cover_letters[0]?.job_id === resultD.matches[0]?.job.job_id },
    { desc: "cover letter tone is professional", pass: resultD.cover_letters[0]?.tone === "professional" },
    { desc: "match_score is a number between 0 and 1", pass: typeof resultD.cover_letters[0]?.match_score === "number" && resultD.cover_letters[0].match_score >= 0 && resultD.cover_letters[0].match_score <= 1 },
    { desc: "gap_analyses is empty (none requested)", pass: resultD.gap_analyses.length === 0 },
  ]);

  // ── Action E: Pro Full — gap analysis for matches 1 and 2 ────────────────
  renderHeader("E", "Analyze my fit for my top 2 matches", "pro full (all 4 features)");
  const resultE = await runCareerClawWithContext(
    { profile, resumeText, topK: 5, dryRun: true, gapAnalysisMatchIndices: [0, 1] },
    proFullCtx
  );
  renderResult(resultE);
  renderAssertions("E — gap analysis for matches 1+2", [
    { desc: "exactly 2 gap analyses returned", pass: resultE.gap_analyses.length === 2 },
    { desc: "GA[0] job_id matches match #1", pass: resultE.gap_analyses[0]?.job_id === resultE.matches[0]?.job.job_id },
    { desc: "GA[1] job_id matches match #2", pass: resultE.gap_analyses[1]?.job_id === resultE.matches[1]?.job.job_id },
    { desc: "GA[0] fit_score is a valid number", pass: typeof resultE.gap_analyses[0]?.analysis.fit_score === "number" },
    { desc: "GA[0] has top_signals and top_gaps", pass: Array.isArray(resultE.gap_analyses[0]?.analysis.summary.top_signals.keywords) },
    { desc: "cover_letters is empty (none requested)", pass: resultE.cover_letters.length === 0 },
  ]);

  // ── Action F: Pro Full — cover letter + gap analysis for match 1 ──────────
  renderHeader("F", "Write a cover letter and analyze fit for match 1", "pro full (all 4 features)");
  const resultF = await runCareerClawWithContext(
    {
      profile,
      resumeText,
      topK: 5,
      dryRun: true,
      coverLetterMatchIndices: [0],
      gapAnalysisMatchIndices: [0],
    },
    proFullCtx
  );
  renderResult(resultF);
  const clF = resultF.cover_letters[0];
  const gaF = resultF.gap_analyses[0];
  renderAssertions("F — cover letter + gap analysis, same index", [
    { desc: "exactly 1 cover letter", pass: resultF.cover_letters.length === 1 },
    { desc: "exactly 1 gap analysis", pass: resultF.gap_analyses.length === 1 },
    { desc: "cover letter and gap analysis are for the same job", pass: clF?.job_id === gaF?.job_id },
    {
      desc: "gapCache reused: cover letter match_score === gap fit_score",
      pass: clF !== undefined && gaF !== undefined && clF.match_score === gaF.analysis.fit_score,
    },
  ]);

  // ── Action G: Boundary — TOPK_EXTENDED absent, topK=5 silently clamped ───
  renderHeader("G", "Show me 5 matches", "pro — missing TOPK_EXTENDED");
  const resultG = await runCareerClawWithContext(
    { profile, resumeText, topK: 5, dryRun: true },
    proNoTopKCtx
  );
  renderResult(resultG);
  renderAssertions("G — topK clamp (no TOPK_EXTENDED)", [
    { desc: "silently clamped to 3 matches despite topK=5 request", pass: resultG.matches.length === 3 },
    { desc: "drafts are LLM-enhanced (LLM_OUTREACH_DRAFT still granted)", pass: resultG.drafts.some((d) => d.llm_enhanced) },
  ]);

  // ── Action H: Boundary — TAILORED_COVER_LETTER absent ────────────────────
  renderHeader("H", "Write a cover letter for match 1", "pro — missing TAILORED_COVER_LETTER");
  const resultH = await runCareerClawWithContext(
    { profile, resumeText, topK: 5, dryRun: true, coverLetterMatchIndices: [0] },
    proNoClCtx
  );
  renderResult(resultH);
  renderAssertions("H — cover letter gate (no TAILORED_COVER_LETTER)", [
    { desc: "cover_letters silently empty (feature not granted)", pass: resultH.cover_letters.length === 0 },
    { desc: "matches still returned (other features unaffected)", pass: resultH.matches.length === 5 },
    { desc: "drafts are LLM-enhanced (LLM_OUTREACH_DRAFT still granted)", pass: resultH.drafts.every((d) => d.llm_enhanced) },
    { desc: "gap_analyses is empty (none requested)", pass: resultH.gap_analyses.length === 0 },
  ]);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(72)}`);
  if (process.exitCode === 1) {
    console.error(`❌ ClawOS smoke test completed with failures`);
  } else {
    console.log(`✓ All ClawOS smoke test actions passed`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
