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

# ClawOS integration smoke test (requires .env with API keys)
# Runs 8 user actions × 30 assertions via runCareerClawWithContext()
npx tsx --env-file=.env scripts/smoke_clawos.ts

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

## Manual Test Tasks

These tasks are run manually when implementing new features to verify the full
user-facing behaviour end-to-end. Always run `npm run build` before either task.

---

### Task 1 — CLI Test

**Trigger command:** `run cli test`

Run the full CLI variant matrix below. All runs use `--dry-run`.
Free tier: `node dist/cli.js` (no env file — no Pro key in scope).
Pro tier: `node --env-file=.env dist/cli.js`.

Tests 10–14 require knowing match indices. Run test 7 first, observe how many
matches are returned, then use index `1` (and `1,2` for multi-index variants).

| # | Command | Tier | What to verify |
|---|---------|------|----------------|
| 1 | `node dist/cli.js --help` | — | All flags documented, including `-c`/`--cover-letter` and `-g`/`--gap-analysis` |
| 2 | `node dist/cli.js --version` | — | Prints current package version |
| 3 | `node dist/cli.js --dry-run` | Free | 3 matches, template drafts (`llm_enhanced: false`), `cover_letters: []`, `gap_analyses: []` |
| 4 | `node dist/cli.js --resume-txt .careerclaw/resume.txt --dry-run` | Free | Explicit resume path works; same output as #3 |
| 5 | `node dist/cli.js --top-k 5 --dry-run` | Free | Returns 3 matches — silently clamped from 5 (no `TOPK_EXTENDED`) |
| 6 | `node dist/cli.js --dry-run --json` | Free | Valid JSON; `cover_letters` and `gap_analyses` are empty arrays |
| 7 | `node --env-file=.env dist/cli.js --top-k 5 --dry-run` | Pro | 5 matches, all LLM-enhanced drafts (`llm_enhanced: true`) |
| 8 | `node --env-file=.env dist/cli.js --resume-txt .careerclaw/resume.txt --dry-run` | Pro | Explicit resume path works; LLM drafts generated |
| 9 | _(covered by #7)_ | Pro | — |
| 10 | `node --env-file=.env dist/cli.js --top-k 5 --cover-letter 1 --dry-run` | Pro | `cover_letters.length === 1`, `is_template: false` |
| 11 | `node --env-file=.env dist/cli.js --top-k 5 --gap-analysis 1 --dry-run` | Pro | Gap analysis section printed with weighted/unweighted scores, signals, gaps |
| 12 | `node --env-file=.env dist/cli.js --top-k 5 --cover-letter 1 --gap-analysis 1 --dry-run` | Pro | Both sections rendered; `match_score` in cover letter equals `fit_score` in gap analysis (gapCache reuse) |
| 13 | `node --env-file=.env dist/cli.js --top-k 5 --cover-letter 1,2 --gap-analysis 1,2 --dry-run --json` | Pro | `cover_letters.length === 2`, `gap_analyses.length === 2`; `is_template: false`; `match_score === fit_score` on both |
| 14 | `node --env-file=.env dist/cli.js --top-k 5 --cover-letter 99 --dry-run` | Pro | Out-of-bounds index silently skipped — `cover_letters: []`, no crash, no error output |

**Pass criteria:** All 14 variants exit 0. Results match the "What to verify" column.
Report results in a table with columns: `#`, `Command`, `Result` (✅/❌), `Notes`.

---

### Task 2 — ClawOS User Test

**Trigger command:** `run clawos user`

Run the ClawOS integration smoke test script. This exercises `runCareerClawWithContext()`
directly — no CLI involved. All runs use `dryRun: true`.

```bash
npx tsx --env-file=.env scripts/smoke_clawos.ts
```

The script runs 8 user actions (A–H) across 5 execution contexts and asserts
30 behavioural invariants. It exits 0 on full pass, 1 on any assertion failure.

**Contexts:**

| Context | Tier | Features |
|---------|------|----------|
| `freeCtx` | free | `[]` |
| `proBasicCtx` | pro | `LLM_OUTREACH_DRAFT`, `RESUME_GAP_ANALYSIS` |
| `proFullCtx` | pro | All 4 features |
| `proNoTopKCtx` | pro | All except `TOPK_EXTENDED` |
| `proNoClCtx` | pro | All except `TAILORED_COVER_LETTER` |

**User actions and expected outcomes:**

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

**Pass criteria:** Script exits 0. All 30 assertions print `✓`. Final line reads
`✓ All ClawOS smoke test actions passed`.
Report pass/fail per action with assertion counts (e.g. `A: 6/6 ✓`).

---

## Ship Changes Workflow

When asked to "ship changes", follow these steps in order:

**1. Detect changes**
Run `git status` and `git diff HEAD` to understand what has changed and which workspace(s) are affected.

**2. Create a branch**
Ensure the branch creation step is idempotent: if a branch with the generated name already exists,
switch to it instead of trying to create a new one

Name the branch `<type>/<short-description>` using the same types enforced by commitlint
and the branch policy:

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `revert`, `style`

Example: `feat/hackernews-adapter-update`

**3. Commit**
Stage only the relevant files (never `git add -A` blindly). Write a conventional commit message:

```
<type>(<scope>): <short imperative summary>

<body explaining what changed and why — omit if obvious>
```

Valid scopes: `adapters`, `matching`, `llm`, `cli`, `tracking`, `resume-intel`, `gap`,
`drafting`, `sources`, `config`, `models`, `execution-context`, `license`. Scope is optional
but recommended when the change is confined to one module.

Version bump rules (release-please):
- `feat` → minor bump
- `fix`, `perf` → patch bump
- `feat!`, `fix!`, or `BREAKING CHANGE:` footer → major bump
- `chore`, `docs`, `ci`, `build`, `refactor`, `style`, `test`, `revert` → no bump

**4. Run unit tests and linting**

```bash
npm run lint
npm run test
```

If either fails, **stop**. Explain what is failing and the approach to fix it — do not apply the fix code until I approve it.

**5. Push and run smoke tests**

```bash
git push -u origin <branch>
```

Smoke tests require a populated `.env` with API keys. Skip `smoke:llm` if the change does
not touch LLM, licensing, or Pro-gated paths. Run `smoke_clawos` if the change touches
cover letters, gap analysis, feature gating, or the ClawOS execution path.

```bash
npm run smoke:sources
npm run smoke:briefing
npm run smoke:llm
npx tsx --env-file=.env scripts/smoke_clawos.ts
```

If smoke tests fail, **stop**. Explain what is failing and the approach to fix it — do not apply the fix code until I approve it.

**6. Open a PR**

```bash
gh pr create \
  --title "<same as commit subject>" \
  --body "..."
```

PR body must include: **Summary** (bullet list of changes), **Test plan** (checklist), and
**Release impact** (`feat` → minor bump, `fix`/`perf` → patch bump, `chore`/`docs`/`ci` → no bump).