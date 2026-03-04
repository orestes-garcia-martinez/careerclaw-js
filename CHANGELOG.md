# Changelog

All notable changes to careerclaw-js are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.3.0] — 2026-03-04

### Added

- `src/sources.ts` — source aggregation layer: `fetchAllJobs()` runs both
  adapters concurrently with per-source error isolation; `deduplicate()`
  removes duplicate `job_id` entries (first-seen wins); returns `FetchResult`
  with job list, per-source counts, and error map for run instrumentation
- `src/core/text-processing.ts` — shared text processing library:
  `STOPWORDS` (English function words + full PR-E recruitment boilerplate set),
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

[Unreleased]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/releases/tag/v0.1.0