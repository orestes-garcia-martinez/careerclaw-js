---
name: manual-test-clawos
description: >
  ClawOS integration smoke test runner for CareerClaw-JS. Use this skill ONLY
  when the user says "run clawos user". Executes the smoke_clawos.ts script
  which runs 8 user actions across 5 execution contexts, asserting 30
  behavioral invariants.
---

# Task: ClawOS User Test

**Prerequisite:** Run `npm run build` before starting.

Run the ClawOS integration smoke test script. This exercises
`runCareerClawWithContext()` directly — no CLI involved. All runs use
`dryRun: true`.

```bash
npx tsx --env-file=.env scripts/smoke_clawos.ts
```

## Execution Contexts

| Context | Tier | Features |
|---------|------|----------|
| `freeCtx` | free | `[]` |
| `proBasicCtx` | pro | `LLM_OUTREACH_DRAFT`, `RESUME_GAP_ANALYSIS` |
| `proFullCtx` | pro | All 4 features |
| `proNoTopKCtx` | pro | All except `TOPK_EXTENDED` |
| `proNoClCtx` | pro | All except `TAILORED_COVER_LETTER` |

## User Actions and Expected Outcomes

| # | User says to ClawOS | Context | Key parameters | Expected |
|---|---------------------|---------|----------------|----------|
| A | "Run my daily briefing" | `freeCtx` | `topK=3` | 3 matches, template drafts, `cover_letters: []`, `gap_analyses: []`, `verified: true` on context |
| B | "Run my daily briefing" | `proBasicCtx` | `topK=3` | 3 matches, LLM drafts; no `TAILORED_COVER_LETTER` or `TOPK_EXTENDED` |
| C | "Show me my top 5 matches" | `proFullCtx` | `topK=5` | 5 matches, all LLM drafts — discovery run for indices D/E/F |
| D | "Write a cover letter for match 1" | `proFullCtx` | `topK=5`, `coverLetterMatchIndices=[0]` | 1 LLM cover letter; `is_template: false`; `job_id` matches match #1 |
| E | "Analyze my fit for my top 2 matches" | `proFullCtx` | `topK=5`, `gapAnalysisMatchIndices=[0,1]` | 2 gap reports; `job_id` linkage correct; signals/gaps populated |
| F | "Write a cover letter and analyze fit for match 1" | `proFullCtx` | `topK=5`, both `[0]` | 1 cover letter + 1 gap report; `match_score === fit_score` (gapCache reuse) |
| G | "Show me 5 matches" | `proNoTopKCtx` | `topK=5` | Silently clamped to 3; LLM drafts still served |
| H | "Write a cover letter for match 1" | `proNoClCtx` | `topK=5`, `coverLetterMatchIndices=[0]` | `cover_letters: []`; 5 matches and LLM drafts unaffected |

## Pass Criteria

Script exits 0. All 30 assertions print `✓`. Final line reads:
`✓ All ClawOS smoke test actions passed`.

## Reporting

Report pass/fail per action with assertion counts (e.g. `A: 6/6 ✓`).
