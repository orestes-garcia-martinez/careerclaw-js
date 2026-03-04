# Changelog

All notable changes to careerclaw-js are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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
[0.8.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/releases/tag/v0.1.0