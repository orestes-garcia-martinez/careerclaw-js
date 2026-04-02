# Changelog

All notable changes to careerclaw-js are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.7.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.6.1...careerclaw-js-v1.7.0) (2026-04-02)


### Features

* **config:** update HN Who is Hiring thread ID to April 2026 ([#62](https://github.com/orestes-garcia-martinez/careerclaw-js/issues/62)) ([53c34d0](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/53c34d00cc3e60c0cb37a26a88a7b845ab049104))

## [1.6.1](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.6.0...careerclaw-js-v1.6.1) (2026-04-02)


### Bug Fixes

* **cover-letter:** add template quality guard and LLM observability ([#59](https://github.com/orestes-garcia-martinez/careerclaw-js/issues/59)) ([aadc5ff](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/aadc5ff7ea7b47aeeebca6d31a9c718fcf2aaa33))

## [1.6.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.5.0...careerclaw-js-v1.6.0) (2026-04-01)


### Features

* **matching:** add hybrid semantic matching via skill taxonomy ([#46](https://github.com/orestes-garcia-martinez/careerclaw-js/issues/46)) ([004283a](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/004283af86f27ad0b105cbb5fa4ee196d4f99fc2))

## [1.5.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.4.0...careerclaw-js-v1.5.0) (2026-03-30)


### Features

* **models:** expose resume_intel on BriefingResult ([18fb459](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/18fb459d6a394d47acbdda8fef4a4b470575594c))
* **models:** expose resume_intel on BriefingResult ([c475616](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/c4756162aaf63c6fd3cc42748c8aa33e51462aba))


### Documentation

* slim CLAUDE.md and move knowledge into on-demand skills ([ef4b0c8](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/ef4b0c821df7488be670181f611b6920ccbd7b89))
* slim CLAUDE.md and move knowledge into on-demand skills ([8b20f9c](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/8b20f9c6d0612ce9c1406bb97018eb0cba7e4283))

## [1.4.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.3.0...careerclaw-js-v1.4.0) (2026-03-28)


### Features

* add cover letter generation and gap analysis to briefing pipeline ([d2ca27d](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/d2ca27d8d5cf63c68fb258e1105e1fc8140577f4))
* add cover letter generation and gap analysis to briefing pipeline ([e1fb676](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/e1fb6760b1a6e5287a7f667d85dcbecf44f01e3e))


### Documentation

* add manual test tasks for CLI and ClawOS user to CLAUDE.md ([5c93a78](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/5c93a789065a0a400035a92f7f9f320f784c016d))

## [1.3.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.2.0...careerclaw-js-v1.3.0) (2026-03-27)


### Features

* **briefing:** enforce tier-aware topK ceiling ([5073061](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/50730612a323b709ccbe523651df8a5bc6c7211b))
* **briefing:** enforce tier-aware topK ceiling ([6897c4e](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/6897c4ec98275c12c533369aaa0138976df350ee))

## [1.2.0](https://github.com/orestes-garcia-martinez/careerclaw-js/compare/careerclaw-js-v1.1.0...careerclaw-js-v1.2.0) (2026-03-27)


### Features

* dual execution-context architecture for CareerClaw runtimes ([2d77418](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/2d77418a111a69fb57d51b65a4a31c9a3052680d))


### Bug Fixes

* bump fast-xml-parser version to fix CVE-2026-26278 ([5b6d197](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/5b6d1978a450b0be11b92bb44ad4465802e12cfb))
* bump fast-xml-parser version to fix CVE-2026-33349 ([80fbb08](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/80fbb0824cc9199074bef9421fcf2cdc9b9c1b21))
* grant contents:write permission to vt_scan job ([35a6a7f](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/35a6a7fdb7214904c238d6509e2e1aaf679fe4be))
* grant contents:write permission to vt_scan job ([282e425](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/282e425a7bf4e18901e668478c09489b0d191bf0))
* scoring model, signal gate, entity decoding, credentials infrastructure ([246dbf3](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/246dbf3f017e992f28e2ee75a3d0d07456791efd))
* scoring model, signal gate, entity decoding, credentials infrastructure ([9a9c6a3](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/9a9c6a3e4c38d3968423965ba0cf3a6c4ba9e67a))
* **skill:** rewrite SKILL.md as runbook to prevent hallucination and enforce profile gate ([975ae12](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/975ae12e3e3c08b6e4a8e6f13c19067ab79aa753))


### Build System

* add Release Please automation and commitlint enforcement ([e835723](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/e835723f8571a03105e786d597dde0148581005b))
* add Release Please automation and commitlint enforcement ([c15410d](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/c15410d4302ff21593f437a4360d1851a4d49e12))


### Documentation

* improve Ship Changes Workflow section in CLAUDE.md ([6ce1af7](https://github.com/orestes-garcia-martinez/careerclaw-js/commit/6ce1af7bdc69c29053b4a1478f4a05a83f5a25f7))

## [Unreleased]

---

## [1.1.0] - 2026-03-26

### Added

- `src/execution-context.ts` — dual execution-context architecture for CareerClaw
  runtimes; `ClawOsExecutionContext` (trusted platform path, `verified: true`,
  feature list passed from upstream entitlement) and `StandaloneExecutionContext`
  (local CLI / direct package use with Gumroad license validation);
  `CAREERCLAW_FEATURES` constant registry with four feature flags
  (`LLM_OUTREACH_DRAFT`, `TAILORED_COVER_LETTER`, `RESUME_GAP_ANALYSIS`,
  `TOPK_EXTENDED`); `createClawOsExecutionContext()` and
  `createStandaloneExecutionContext()` factory functions;
  `hasCareerClawFeature()` type-safe feature check helper;
  `CareerClawFeatureKey` union type derived from `CAREERCLAW_FEATURES`
- `src/runtime.ts` — programmatic runtime wrappers providing the clean
  import boundary for both ClawOS and standalone consumers;
  `runCareerClawStandalone(input, options)` delegates to `runBriefing()` with
  standalone license flow; `runCareerClawWithContext(input, context, options)`
  delegates to `runBriefingWithContext()` with trusted platform context;
  `resolveResumeIntelligence()` centralises resume-intel construction from
  profile + optional resume text, eliminating duplicate logic across callers;
  `CareerClawRunInput`, `CareerClawRunSupportOptions`, and
  `CareerClawStandaloneRunOptions` interfaces for typed consumer APIs
- `src/index.ts` — public API barrel export; re-exports `models`, `briefing`,
  `runtime`, `resume-intel`, `execution-context`, `license`, `tracking`, and
  `sources` modules; enables `import { ... } from "careerclaw-js"` for all
  public types and functions
- `src/tests/runtime.test.ts` — 4 integration tests covering the trust
  boundary security matrix: standalone with Pro key (license validated via
  Gumroad → LLM drafts active), standalone without Pro key (no license check →
  template drafts only), ClawOS with `LLM_OUTREACH_DRAFT` feature (no Gumroad
  call → LLM drafts active), ClawOS without feature (no Gumroad call → template
  drafts only); mocks `checkLicense` and `enhanceDraft` to verify call isolation

### Changed

- `src/briefing.ts` — refactored from single `runBriefing()` entry point to
  dual-mode architecture via internal strategy pattern; added
  `runBriefingWithContext(profile, context, options)` as the trusted ClawOS
  entry point; extracted `runBriefingInternal()` as the shared pipeline with
  `InternalExecutionMode` discriminated union (`"standalone"` | `"clawos"`);
  extracted `resolvePremiumDraftAccess(executionMode, resumeIntel)` to resolve
  Pro activation per mode — standalone validates via `checkLicense()`, ClawOS
  checks `tier === "pro"` + `hasCareerClawFeature(LLM_OUTREACH_DRAFT)`;
  fixed unsafe `resumeIntel!` non-null assertion to safe `isProActive && resumeIntel`
  guard; added `ContextBriefingOptions` interface (excludes `proKey`,
  `licenseFetchFn`, `licenseCachePath` — not applicable in trusted mode);
  removed inline JSDoc comments from `BriefingOptions` fields (types are
  self-documenting)
- `src/cli.ts` — added `--version` / `-v` flag using `createRequire` to read
  version from `package.json`; version check exits before any profile or config
  loading; updated `printHelp()` to document the new flag; replaced direct
  `runBriefing()` call with `runCareerClawStandalone()` from `runtime.ts`,
  delegating resume-intel construction and option wiring to the runtime layer
- `package.json` — description updated to reflect dual-runtime identity
  (ClawOS + standalone); `"clawos"` keyword added; `exports` map added with
  three subpath entries: `"."` (main library, `dist/index.js`), `"./cli"`
  (CLI entry, `dist/cli.js`), `"./package.json"` (self-reference for
  `createRequire` version reads)
- `README.md` — full rewrite aligned with dual execution-context architecture;
  added [ClawOS](https://clawoshq.com/) links throughout; added
  [ClawHub](https://clawhub.ai/) and [OpenClaw](https://openclaw.org/)
  references for standalone skill distribution; split Pro pricing into two
  channels (ClawOS $9/month recommended, Standalone $39 lifetime via Gumroad);
  added programmatic integration examples for both `runCareerClawWithContext()`
  (with `createClawOsExecutionContext()`) and `runCareerClawStandalone()`;
  added `--version` flag to CLI options; updated project structure tree with
  `execution-context.ts`, `index.ts`, and `runtime.ts`

### Security

- ClawOS execution path never touches Gumroad — entitlement is resolved
  upstream by the platform; the `ClawOsExecutionContext.verified: true`
  literal type enforces that only pre-verified contexts are accepted
- Standalone execution path always validates through `checkLicense()` when a
  `proKey` is provided — no bypass flag exists on the public CLI
- `resumeIntel!` non-null assertion removed from the draft enhancement call;
  replaced with an explicit `isProActive && resumeIntel` guard to prevent
  runtime errors if `resumeIntel` is undefined

### Notes

274 tests across 17 files, all passing. `tsc --noEmit` clean.
No new production dependencies. The `exports` map in `package.json` makes
the package a proper ESM citizen with subpath resolution for ClawOS
direct-import consumption.

---

## [1.0.6] - 2026-03-19

### Fixed

- Triggered by the fast-xml-parser 5.5.7, upgrade (CVE-2026-33349), 
  which Entity Expansion Limits Bypassed When Set to Zero Due to JavaScript 
  Falsy Evaluation in fast-xml-parser

---

## [1.0.5] - 2026-03-18

### Fixed

- Fixed hex and decimal numeric HTML entities (e.g. `&#x2F;`, `&#47;`) leaking
  undecoded into job titles, descriptions, and outreach drafts
  (`src/adapters/remoteok.ts`). Added generic catch-all decoding for both
  `&#xHH;` and `&#DD;` forms before the named-entity block in `stripHtml`.
  Triggered by the fast-xml-parser v5 upgrade (CVE-2026-26278), which stopped
  silently pre-decoding entities inside CDATA content that v4 had handled
  transparently.

---

## [1.0.4] - 2026-03-08

### Changed
- Runtime check replaced — no more auto-install, just a non-blocking update nudge
- Write-failure gate added in Step 3
- Resume write failed row added to error table

---

## [1.0.3] - 2026-03-08

### Fixed
- Agent no longer presents a multi-question setup form when profile is missing — redirects to resume upload only
- Agent no longer invents career frameworks, phases, or methodologies not defined in this file
- Agent no longer enters consultant mode during first-time setup

### Changed
- Rewrote SKILL.md from persona/behavior narrative format to numbered runbook format
- Added hard Rules section at top with six explicit prohibitions
- Added profile existence check (Step 1) as hard gate before any command runs
- Setup flow now asks one question at a time — work mode first, salary second
- Removed Agent Persona, Behavior 1, and Behavior 2 sections entirely
- Bumped runtime self-healing check expected version to 1.0.3

---

## [1.0.2] - 2026-03-07

### Fixed
- Behavior 2 (Strategic Gap Closing) no longer fires during First-Time Setup.
  The agent was entering consultant mode after resume intake and ending setup
  with open-ended targeting questions instead of proceeding to the first briefing.

### Changed
- Added explicit activation gate to Behavior 2: only applies after setup is
  complete and only when the user asks a listed trigger phrase.
- Step 2 of First-Time Setup now specifies a strict exit condition: collect
  work mode and salary floor, then proceed directly to Step 3 with no
  analysis, strategy suggestions, or targeting options.
- Added three entries to "What Not to Do" to reinforce setup boundaries.

---

## [1.0.1] - 2026-03-06

### Changed
- Hardened the public `SKILL.md` contract for ClawHub/OpenClaw deployment.
- Standardized runtime behavior to a single install/execute approach:
  - self-healing install with `npm install -g careerclaw-js@"$EXPECTED"`
  - direct execution with `careerclaw-js ...`
- Updated required runtime bins to match the Node/npm execution path.
- Scoped CareerClaw behavior more clearly as an invoked skill instead of a session-wide assistant.
- Simplified first-run onboarding around canonical `.careerclaw/resume.txt` handling.
- Reduced first-run friction by keeping setup resume-first and minimizing follow-up questions.

### Improved
- Restored Strategic Gap Closing behavior so CareerClaw can act more like a practical career consultant when the fit is imperfect.
- Improved recommendation tone and guidance for fatal, acceptable, and bridgeable gaps.
- Cleaned up Pro activation flow so premium setup is only introduced when it is actually needed.
- Restored the public Gumroad purchase link for CareerClaw Pro while keeping internal product IDs out of user-facing setup.

### Removed
- Removed internal Gumroad product ID exposure from the public skill surface.
- Removed Python compatibility messaging from `SKILL.md` to keep the public skill contract focused on the current Node-based experience.

---

## [1.0.0] — 2026-03-06

### Added

- `SKILL.md` full rewrite (Phase 12): Agent Persona section; zero-config resume
  intake; Daily Stand-up behavior (reads `tracking.json` on session start,
  surfaces still-live and undrafted jobs); Strategic Gap Closing (coach tone
  for matches with gaps > 0.6 score); Sunday Night Strategy (first weekday of
  month = HN priority, Sunday evening prompt, Monday/Friday timing context);
  Tier-1 upsell trigger (Google, Meta, Apple, Stripe, Airbnb, Netflix);
  Free vs Pro comparison table; `optionalEnv` frontmatter for all 12 env vars
- `RELEASE_CHECKLIST.md` — pre-publish gate, npm publish steps, VirusTotal
  scan instructions, OpenClaw test gate, ClawHub submission checklist

### Changed

- `src/llm-enhance.ts` — OpenAI dual-transport support: `gpt-4o` family uses
  `/v1/chat/completions` with `max_completion_tokens`; newer models (gpt-5.x+)
  use `/v1/responses` with `max_output_tokens`; transport auto-detected via
  `defaultOpenAITransport(model)` and injectable per `ChainCandidate`;
  `SYSTEM_PROMPT` rewritten with Bridge Sentence method as core doctrine,
  250/300-word hard limits, 22 banned phrases by name; `buildPrompt()` updated
  with explicit word limit and Bridge Sentence paragraph-level instruction
- `src/config.ts` — `CAREERCLAW_DIR` empty-string guard: `??` replaced with
  `.trim().length > 0` check so blank `CAREERCLAW_DIR=` in `.env` correctly
  falls back to `.careerclaw/`
- `scripts/smoke_llm.ts` — Pro key section now calls `checkLicense()` live
  against Gumroad when both keys are set; stale "not yet implemented" message
  removed; Polar.sh URL replaced with Gumroad URL
- `README.md` — Polar.sh references replaced with Gumroad; CLI commands
  corrected (no `briefing` subcommand); `--resume-pdf` removed (not
  implemented); env vars table updated; roadmap updated through Phase 13

### Notes

270 tests across 16 files, all passing. `tsc --noEmit` clean.
No new production dependencies. First ClawHub-ready release.
OpenAI transport validated against gpt-4o-mini (chat) and gpt-5.2 (responses)
in live smoke testing.

---

## [0.11.0] — 2026-03-05

### Added

- `src/license.ts` — `checkLicense(key, options?)` → `Promise<LicenseResult>`:
  Gumroad Pro license validation with 7-day offline cache; raw key never
  written to disk — only `sha256(key)` cached; `{ valid: false, source: "none" }`
  returned immediately when `CAREERCLAW_GUMROAD_PRODUCT_ID` is unset so Free
  tier users are unaffected; `fetchFn` and `cachePath` injectable for offline tests
- `src/tests/license.test.ts` — 12 offline tests covering the missing product ID
  guard, fresh/stale/missing/wrong-key cache branches, all Gumroad API response
  variants (success, refunded, chargebacked, 404, 500), never-throws invariant,
  and hash safety (raw key must not appear in cache file)

### Changed

- `src/briefing.ts` — bare `proKey` presence check replaced with
  `await checkLicense(proKey)`; `isProActive` is now driven by
  `licenseResult.valid`; `BriefingOptions` gains `licenseFetchFn` and
  `licenseCachePath` for test injection
- `src/config.ts` — added `GUMROAD_PRODUCT_ID`, `GUMROAD_API_BASE`,
  `LICENSE_CACHE_TTL_MS` (7 days in ms); `POLAR_PRODUCT_SLUG` and
  `POLAR_API_BASE` retained and marked `@deprecated` with
  `TODO: Phase 11-Polar` migration comment
- `.env.example` — Pro purchase URL updated to Gumroad;
  `CAREERCLAW_GUMROAD_PRODUCT_ID=` added with dashboard instructions

### Security

- Raw license key is never written to disk; only `sha256(key)` is persisted
- Gumroad validation uses `increment_uses_count=false` — validation calls
  do not consume customer usage quota

### Notes

270 tests across 16 files, all passing. `tsc --noEmit` clean.
No new production dependencies. Polar migration path preserved via
`@deprecated` constants and `TODO: Phase 11-Polar` comment in `config.ts`.

---

## [0.10.0] — 2026-03-05

### Added

- `src/llm-enhance.ts` — `enhanceDraft(job, profile, resumeIntel, draft, gapKeywords, options)`:
  Pro tier LLM-powered outreach draft generation; parses `LLM_CHAIN` into a left-to-right failover
  list; per-candidate retry loop up to `LLM_MAX_RETRIES`; circuit breaker opens after
  `LLM_CIRCUIT_BREAKER_FAILS` consecutive failures; `_chainOverride` for offline testing
- `src/tests/llm-enhance.test.ts` — 12 offline tests covering Anthropic path, OpenAI path,
  HTTP error fallback, unparseable response fallback, never-throws invariant, circuit breaker
  call-count bounds, privacy (raw resume text must not appear in outbound request payload),
  and empty-chain no-op

### Changed

- `src/briefing.ts` — `BriefingOptions` gains `resumeIntel?: ResumeIntelligence`,
  `proKey?: string`, `enhanceFetchFn?`; draft stage converted to `async`; calls `enhanceDraft()`
  per match when `proKey` is set — falls back to deterministic baseline on any LLM failure
- `src/cli.ts` — calls `buildResumeIntelligence()` after resume load; passes `resumeIntel` and
  `PRO_KEY` to `runBriefing()`; Pro enhancement path is now live from the CLI

### Security

- LLM prompt contains only extracted keyword signals (`impact_signals` ≤ 12 tokens,
  `gap_keywords` ≤ 6 tokens) — raw resume text and `resume_summary` are never sent to
  any external API

### Notes

258 tests across 15 files, all passing. `tsc --noEmit` clean. No new production dependencies.
License validation (`CAREERCLAW_PRO_KEY` checked against Gumroad) is deferred to Phase 11 (v0.11.0) —
`proKey` is trusted by presence only in this version.

---

## [0.8.1] — 2026-03-04

### Fixed

- **Dentist problem**: replaced additive composite score with a multiplicative model (`total = sqrt(keyword) × qualityBase`);
  zero keyword overlap now always produces a score of 0.0 regardless of metadata alignment — irrelevant jobs can no longer float to the
  top on neutral dimension scores
- Signal gate added to `rankJobs()`: jobs with keyword score below `minKeywordScore` (default: 0.01) are hard-filtered before ranking
- `matched_keywords` and `gap_keywords` were hardcoded empty in `engine.ts`; now wired from `compositeScore()` output
- HTML entity `&#x2F;` (and all `&#x[hex];` sequences) now decoded in `stripHtml()` — fixes `ML&#x2F;AI` appearing in HN job titles and
  gap tokens
- `stripHtml()` now applied to parsed HN job title and company name (previously body text only)
- Contraction tokens (`i'm`, `i've`, `don't`, etc.) added to `STOPWORDS` — eliminates noise in gap keyword output

### Changed

- `MatchBreakdown` field names renamed: `keyword_score → keyword`, `experience_score → experience`, `salary_score → salary`,
  `work_mode_score → work_mode`
- `compositeScore()` return type extended: now includes `matched` and `gaps` string arrays alongside `total` and `breakdown`
- Default LLM model updated: `claude-sonnet-4-20250514` → `claude-haiku-4-5-20251001`
- `scripts/smoke_briefing.ts` refactored to multi-profile mode; select profile via `PROFILE=0|1|2` env var

### Added

- `.env.example` — full credential reference (OpenClaw gateway, agent LLM keys, Pro license, draft enhancement keys, failover chain config)
- `SECURITY.md` — local-first security architecture, credential handling policy, external network call inventory, LLM data disclosure
- `src/config.ts`: `LLM_ANTHROPIC_KEY`, `LLM_OPENAI_KEY`, `LLM_CHAIN`, `LLM_MAX_RETRIES`, `LLM_CIRCUIT_BREAKER_FAILS`
- `scripts/smoke_llm.ts` — LLM connectivity and Pro key smoke test; `npm run smoke:llm`

### Notes

234 tests across 13 files, all passing. No new production dependencies.
`MatchBreakdown` rename is a breaking internal change — no public API consumers exist prior to the CLI (Phase 9).

---

## [0.8.0] — 2026-03-04

### Added

- `src/briefing.ts` — `runBriefing(profile, options)`: end-to-end pipeline orchestrator; four timed stages (fetch, rank, draft,
  persist); skill-first design — profile is a parameter, never loaded from disk; `fetchFn` and `repo` are injectable for testing; dry-run
  suppresses all writes while keeping counts accurate; catastrophic fetch failure returns empty result rather than throwing;
  `run_id` generated via `crypto.randomUUID()` (Node built-in); `version` read from package.json at runtime via `createRequire`
- `BriefingResult` interface added to `src/models.ts` — stable JSON output schema for OpenClaw/ClawHub agent consumption: `run`,
  `matches`, `drafts`, `tracking`, `dry_run`
- `src/tests/briefing.test.ts` — 17 integration tests; all offline via stubbed `fetchFn` and `tmpdir`-backed `TrackingRepository`

### Fixed

- `draftOutreach()` and `upsertEntries()` were being passed `ScoredJob` where `NormalizedJob` was required; `ScoredJob` wraps `NormalizedJob`
  as `.job` and does not extend it — both callsites corrected to unwrap `.job`; corresponding test assertion corrected from
  `scored.job_id` to `scored.job.job_id`

### Notes

243 tests across 13 files, all passing. No new dependencies. The pipeline is now end-to-end complete. Every module from Phase 1 through
Phase 7 is wired into a single callable function. Phase 9 (CLI entry point) will expose `runBriefing()` as an executable with `--dry-run`,
`--top-k`, and `--json` flags, matching the Python careerclaw CLI surface.

---

## [0.7.0] — 2026-03-04

### Added

- `src/tracking.ts` — `TrackingRepository` class managing two runtime files under `.careerclaw/`:
  - `tracking.json` — keyed object of `TrackingEntry` records; new jobs saved with status `"saved"`; re-encountered jobs have
    `last_seen_at` and `updated_at` refreshed, all other fields (including user-set status) preserved; one disk write per
    `upsertEntries()` call regardless of batch size
  - `runs.jsonl` — append-only newline-delimited JSON log; one `BriefingRun` per line via `appendRun()`
  - Constructor accepts `trackingPath`, `runsPath`, and `dryRun` overrides; defaults from `config.ts`
  - `load()` returns empty store on a missing or corrupt file — no crash
  - `ensureDir()` creates parent directory recursively on first writing
  - `upsertEntries()` returns accurate `{ created, already_present }` counts even in dry-run mode
  - `ScoredJob?` parameter on `upsertEntries()` reserved for Phase 8 score snapshot attachment
- `src/tests/tracking.test.ts` — 23 unit tests; per-test isolated `tmpdir` directories; covers load, upsert (new + re-encounter),
  disk writes, JSONL append, and dry-run suppression

### Notes

226 tests across 12 files, all passing. No new dependencies. The `TrackingRepository` is the last infrastructure module before the
Phase 8 briefing orchestrator wires everything into the full pipeline.
Dry-run mode is a first-class concern throughout: all writing paths are suppressed, all read and count paths remain fully functional, matching
the Python careerclaw `--dry-run` behaviour.

---

## [0.6.0] — 2026-03-04

### Added

- `src/drafting.ts` — `draftOutreach(job, profile, matchedKeywords)`:
  deterministic outreach email generator; subject line follows `Interest in {title} at {company}` format; body inserts experience
  clause (years or "extensive experience" fallback), up to 3 matched keywords formatted as natural language, and 3 fixed
  reliability/collaboration/instrumentation bullet highlights; word count 161–168 words depending on a keyword path, inside 150–250 word
  spec; `llm_enhanced: false` always; `formatList()` helper for natural-language list formatting
- `src/tests/drafting.test.ts` — 20 unit tests

### Fixed

- Deterministic template body was 127 words on the first pass — below the 150-word MVP spec floor; fixed by expanding opening and closing
  paragraphs; both keyword and fallback paths re-verified at 161 and 168 words respectively

### Notes

203 tests across 11 files, all passing. No new dependencies. `llm_enhanced` is always false in this phase — LLM enhancement
(Phase 7+) will set this flag to true when the Pro key is configured and the call succeeds. The deterministic template remains the permanent
fallback for the Free tier and for LLM failure scenarios.

---

## [0.5.0] — 2026-03-04

### Added

- `src/requirements.ts` — `extractJobRequirements(job)`: tokenizes job title and description into a deduplicated keyword and phrase corpus for
  use as the job-side input to gap analysis
- `src/resume-intel.ts` — `buildResumeIntelligence(params)`:
  section-aware keyword/phrase extraction across skills (weight 1.0), summary + target_roles (weight 0.8), and optional resume_text (weight
  0.6); per-keyword weight is the max across sections; `impact_signals` are keywords with weight >= 0.8; `source` flag indicates which inputs
  contributed; PR-E fix (skills injection) baked in from day one
- `src/gap.ts` — `gapAnalysis(intel, job)`: weighted `fit_score` (sum of matched keyword_weights / job keyword count), `fit_score_unweighted`
  (Jaccard), `signals` (resume ∩ job), `gaps` (job − resume), and top-5 `summary` for display
- `JobRequirements`, `ResumeIntelligence`, `GapAnalysisResult` interfaces added to `src/models.ts`; `ResumeIntelligence` schema is
  JSON-compatible with Python careerclaw output
- `src/tests/resume-intel.test.ts` — 19 unit tests
- `src/tests/gap.test.ts` — 16 unit tests

### Fixed

- Added `"am"` to `STOPWORDS` in `src/core/text-processing.ts` — missed from an initial set alongside `"is"`, `"are"`, `"was"`, `"were"`, `"be"`;
  caught by resume-intel stopword filter test

### Notes

183 tests across 10 files, all passing. No new dependencies. The `fit_score` weighted formula is identical to the Python careerclaw
implementation: skills listed in UserProfile. Skills receive weight 1.0 and will never appear as gaps. The practical fit_score ceiling against
real job postings is ~50% due to company names and location tokens in the denominator.

### Future Work

- CorpusCache: Entropy-based token filtering (IDF) to suppress tokens that appear in >80% of fetched jobs. Gated behind corpus_size >= 50.
  Planned for a future release after job tracking accumulates sufficient data.

---

## [0.4.0] — 2026-03-04

### Added

- `src/matching/scoring.ts` — four pure scoring functions:
  `scoreKeyword()` (Jaccard token overlap, returns matched and gap keyword lists), `scoreExperience()` (clamped linear user/job years ratio),
  `scoreSalary()` (proportional against a user minimum),
  `scoreWorkMode()` (exact=1.0, hybrid=0.5 partial, mismatch=0.0);
  `compositeScore()` with `WEIGHTS` (keyword=0.50, experience=0.20, salary=0.15, work_mode=0.15)
- `src/matching/engine.ts` — `rankJobs(jobs, profile, topK)` scores all jobs, sorts descending by composite score, returns top-K `ScoredJob[]`
  with full breakdown and keyword lists; scores rounded to 4 d.p.
- `src/matching/index.ts` — barrel export for matching public API
- `src/tests/matching.scoring.test.ts` — 36 unit tests
- `src/tests/matching.engine.test.ts` — 10 end-to-end tests using real model types

### Notes

148 tests across 8 files, all passing. No new dependencies. Neutral score (0.5) is used for all null data cases, so missing job fields
neither reward nor penalize the composite — consistent with Python careerclaw behavior. Gap keywords from `scoreKeyword()` feed directly
into Phase 5 gap analysis.

---

## [0.3.0] — 2026-03-04

### Added

- `src/sources.ts` — source aggregation layer: `fetchAllJobs()` runs both
  adapters concurrently with per-source error isolation; `deduplicate()`
  removes duplicate `job_id` entries (first-seen wins); returns `FetchResult`
  with job list, per-source counts, and error map for run instrumentation
- `src/core/text-processing.ts` — shared text processing library:
  `STOPWORDS` (English function words and full PR-E recruitment boilerplate set),
  `SECTION_WEIGHTS` (skills=1.0, summary=0.8, experience=0.6, education=0.4),
  `tokenize()`, `tokenizeUnique()`, `extractPhrases()`,
  `extractPhrasesFromText()`, `tokenOverlap()`, `matchedTokens()`,
  `gapTokens()`
- `src/tests/text-processing.test.ts` — 34 unit tests
- `src/tests/sources.test.ts` — 10 unit tests (ESM-safe adapter stubs via
  `vi.doMock()` + `vi.resetModules()`; no network)

### Notes

102 tests across 6 files, all passing. No new production dependencies.
`SECTION_WEIGHTS` is defined here and will be consumed by resume intelligence
in Phase 5. The `FetchResult.errors` map feeds into `BriefingRun.sources`
instrumentation in Phase 8.

---

## [0.2.0] — 2026-03-03

### Added

- `src/adapters/remoteok.ts` — RemoteOK RSS adapter; parses RSS XML into
  `NormalizedJob[]`; `parseRss()` exported separately from `fetchRemoteOkJobs()`
  so contract tests call pure parsing functions without network mocking
- `src/adapters/hackernews.ts` — HN Firebase adapter; fetches "Who is Hiring?"
  thread comments in parallel; `parseComment()` exported for offline testing;
  handles deleted/dead items gracefully
- `src/adapters/index.ts` — barrel export for all adapter public API
- `src/tests/fixtures/remoteok.xml` — RSS fixture covering full fields, no-salary,
  and k-suffix salary variants
- `src/tests/fixtures/hn-thread.json` — HN thread fixture with `kids` array
- `src/tests/fixtures/hn-comment-job.json` — HN job comment fixture (pipe-separated
  header, HTML body, salary, experience years)
- `src/tests/fixtures/hn-comment-deleted.json` — deleted comment fixture (adapter
  must skip)
- `src/tests/adapters.remoteok.test.ts` — 25 offline contract tests (title/company
  splitting, salary parsing, work-mode inference, HTML stripping, `stableId`)
- `src/tests/adapters.hackernews.test.ts` — 18 offline contract tests (header
  parsing, timestamp conversion, HTML decoding, skip logic for deleted items)
- `scripts/smoke_sources.ts` — live smoke test hitting real RemoteOK RSS and HN
  Firebase APIs; run manually before releases with `npm run smoke`
- `fast-xml-parser` added as a production dependency (RSS parsing)
- `tsx` added as a dev dependency (runs a smoke script without a compiler step)

### Changed

- `stripHtml()` fixed: opening `<p>` tags now convert to `\n` (was `""`) so HN
  comment header and body lines split correctly after HTML stripping
- `README.md` — roadmap updated; Phase 2 marked complete; note updated to
  reference v0.2.0
- **Payment processor:** Pro license switched from Gumroad to **Polar.sh**
  (`https://polar.sh/orestes-garcia-martinez/careerclaw-pro`); `CAREERCLAW_PRO_KEY`
  env var name and SHA-256 cache behavior unchanged

### Notes

58 tests across 4 test files, all passing. No network calls in CI — all adapter
tests use offline fixtures. Run `npm run smoke` manually before each release to
validate live sources.


## [0.1.0] — 2026-03-03

### Added

- Initial repository scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/models.ts` — canonical data schemas (`NormalizedJob`, `UserProfile`,
  `TrackingEntry`, `BriefingRun`, `ScoredJob`, `OutreachDraft`); identical
  JSON serialization format to Python careerclaw for cross-implementation
  file compatibility
- `src/config.ts` — centralised environment and source configuration
  (runtime paths, HTTP defaults, RemoteOK RSS URL, HN thread ID, LLM and
  license env vars)
- `SKILL.md` — OpenClaw skill definition with Node-native self-healing
  install check (`npm install -g careerclaw-js`)
- `CHANGELOG.md`
- Unit tests for `models.ts` and `config.ts` (Vitest)

### Notes

This release establishes the Phase 1 foundation types. No adapters,
matching, or CLI are included yet — those follow in Phases 2–8 per the
Node Migration Decision (ADR, March 2026).

[Unreleased]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.8.0...HEAD
[0.8.1]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/releases/tag/v0.1.0
