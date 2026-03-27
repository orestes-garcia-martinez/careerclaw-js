# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build          # TypeScript compilation (tsc)
npm run dev            # Watch mode

# Test
npm test               # Run all tests (vitest run)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Single test file
npx vitest run src/tests/briefing.test.ts

# Lint (type-check only)
npm run lint           # tsc --noEmit

# Smoke tests (require live network)
npm run smoke:sources
npm run smoke:briefing
npm run smoke:llm      # requires .env with API keys

# Debug scripts (require .env)
npm run debugging:license
npm run debugging:pro
npm run debugging:llm-response
```

## Architecture

CareerClaw-JS is a local-first, privacy-first job search automation tool. Raw resume never leaves the machine — only extracted keywords are sent to the LLM. All data persists locally under `.careerclaw/`.

### Dual Execution Context

The core design principle: one pipeline, two entry points depending on who verifies Pro entitlement.

- **Standalone mode** (`StandaloneExecutionContext`): User provides a Gumroad license key; `src/license.ts` validates against Gumroad API and caches a SHA-256 hash locally for 7 days.
- **ClawOS mode** (`ClawOsExecutionContext`): Platform has already verified entitlement upstream; Pro features are passed in directly, no Gumroad calls.

Both modes feed into the same pipeline via `src/briefing.ts`. The discriminated union in `src/execution-context.ts` defines the feature flag registry (`CAREERCLAW_FEATURES`) and the factory functions for each context.

### Pipeline Flow

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

### Key Source Files

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

### Feature Gating

Pro features are gated by `hasCareerClawFeature(context, FEATURE_NAME)` from `src/execution-context.ts`. Pro tier enables: LLM outreach drafts (`LLM_OUTREACH_DRAFT`) and gap analysis (`GAP_ANALYSIS`). Free tier always gets deterministic template drafts from `src/drafting.ts`.

### Error Isolation

Per-source failures are caught individually in `src/sources.ts` — one adapter failure never blocks the other. LLM enhancement in `src/llm-enhance.ts` degrades gracefully: any failure returns the original template draft. The license cache works offline after first validation.

## Tests

All tests are fully offline — no live network calls. Dependencies (fetch, repos, temp dirs) are injected. Test files live in `src/tests/`.

**Patterns:**
- Fixtures in `src/tests/fixtures/` (mock RSS, HN responses, profiles)
- Stub `fetchFn` for all HTTP calls
- Pass temp directories to `TrackingRepository` for isolation
- `vitest` with `isolate: true` — each test file runs in its own environment, preventing config module cache bleed between tests

## TypeScript Config

Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` enabled. Native ESM (`"type": "module"`, `"module": "NodeNext"`). Node.js ≥ 20 required.

## JSON Compatibility

`src/models.ts` schemas intentionally match the Python careerclaw implementation — profile, tracking, and run files are interchangeable between runtimes.
