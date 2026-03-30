---
name: careerclaw-architecture
description: >
  Deep architectural reference for CareerClaw-JS. Use this skill when modifying
  pipeline code, adding or changing adapters, changing feature gating, debugging
  execution flow, understanding standalone vs ClawOS modes, or touching any file
  in the pipeline (execution-context.ts, briefing.ts, runtime.ts, sources.ts,
  matching/, llm-enhance.ts, gap.ts, drafting.ts, models.ts). Also use when the
  user asks "how does the pipeline work", "what is the execution context", or
  about Pro vs Free tier behavior.
---

# CareerClaw-JS Architecture

Local-first, privacy-first job search automation. Raw resume never leaves the
machine — only extracted keywords are sent to the LLM. All data persists locally
under `.careerclaw/`.

## Dual Execution Context

Core design principle: one pipeline, two entry points depending on who verifies
Pro entitlement.

- **Standalone mode** (`StandaloneExecutionContext`): User provides a Gumroad
  license key; `src/license.ts` validates against Gumroad API and caches a
  SHA-256 hash locally for 7 days.
- **ClawOS mode** (`ClawOsExecutionContext`): Platform has already verified
  entitlement upstream; Pro features are passed in directly, no Gumroad calls.

Both modes feed into the same pipeline via `src/briefing.ts`. The discriminated
union in `src/execution-context.ts` defines the feature flag registry
(`CAREERCLAW_FEATURES`) and the factory functions for each context.

## Pipeline Flow

```
Entry (CLI / programmatic)
  → execution-context.ts  (build context, determine features)
  → briefing.ts           (orchestrate the full pipeline)
      → sources.ts        (fetch from all adapters concurrently, dedup by job_id)
          → adapters/remoteok.ts      (RSS via fast-xml-parser)
          → adapters/hackernews.ts    (HN Firebase API)
      → resume-intel.ts   (extract weighted keyword/phrase corpus from profile + resume)
      → matching/engine.ts (two-stage: score all jobs → filter by keyword gate → top-K)
          → matching/scoring.ts   (keyword overlap, salary, experience, work-mode)
          → requirements.ts       (tokenize job description into keywords/phrases)
      → drafting.ts       (deterministic 150–250 word template email)
      → llm-enhance.ts    (Pro: personalize draft with LLM; failover chain with circuit breaker)
      → gap.ts            (Pro: fit scores, signal/gap summaries)
      → tracking.ts       (persist to tracking.json + runs.jsonl)
  → BriefingResult        (matches, drafts, gaps, run metadata)
```

## Key Source Files

| File | Role |
|------|------|
| `src/execution-context.ts` | Dual execution mode definitions, feature flag registry, factory functions |
| `src/briefing.ts` | Pipeline orchestrator — `runBriefing()` (standalone) and `runBriefingWithContext()` (ClawOS) |
| `src/runtime.ts` | Programmatic entry points — `runCareerClawStandalone()` and `runCareerClawWithContext()` |
| `src/cli.ts` | CLI entry point |
| `src/index.ts` | Public API barrel export |
| `src/models.ts` | All canonical data schemas (`NormalizedJob`, `ScoredJob`, `UserProfile`, `BriefingResult`, etc.) |
| `src/config.ts` | Environment variables and runtime constants (reads `.env` at import time) |
| `src/core/text-processing.ts` | Tokenization, phrase extraction, stopwords (includes recruitment boilerplate), section weights |

## Feature Gating

Pro features are gated by `hasCareerClawFeature(context, FEATURE_NAME)` from
`src/execution-context.ts`.

- **Pro tier enables:** LLM outreach drafts (`LLM_OUTREACH_DRAFT`), gap analysis
  (`GAP_ANALYSIS`), tailored cover letters (`TAILORED_COVER_LETTER`), extended
  top-K (`TOPK_EXTENDED`).
- **Free tier:** deterministic template drafts from `src/drafting.ts`, top-K
  clamped to 3.

## Error Isolation

- Per-source failures are caught individually in `src/sources.ts` — one adapter
  failure never blocks the other.
- LLM enhancement in `src/llm-enhance.ts` degrades gracefully: any failure
  returns the original template draft.
- License cache works offline after first validation.

## JSON Compatibility

`src/models.ts` schemas intentionally match the Python careerclaw
implementation — profile, tracking, and run files are interchangeable between
runtimes.
