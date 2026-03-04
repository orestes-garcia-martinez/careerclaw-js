# Changelog

All notable changes to careerclaw-js are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- `README.md` — full project documentation adapted from Python careerclaw,
  covering installation, quickstart, Free vs. Pro feature table, CLI reference,
  tracking file layout, environment variables, roadmap, and security model

### Changed

- **Payment processor:** Pro license key delivery and validation switched from
  Gumroad to **Polar.sh** (`https://polar.sh/orestes-garcia-martinez/careerclaw-pro`).
  Polar.sh was approved for use after LemonSqueezy merchant rejection.
  The `CAREERCLAW_PRO_KEY` env var name and local SHA-256 license cache behavior
  are unchanged. Only the purchase URL and validation endpoint change (reflected
  in `src/config.ts` when license validation is implemented in Phase 7).

---

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

[Unreleased]: https://github.com/orestes-garcia-martinez/careerclaw-js/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/orestes-garcia-martinez/careerclaw-js/releases/tag/v0.1.0