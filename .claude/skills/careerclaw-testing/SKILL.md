---
name: careerclaw-testing
description: >
  Testing conventions, TypeScript configuration, and patterns for CareerClaw-JS.
  Use this skill when writing new tests, debugging test failures, setting up test
  infrastructure, or asking about vitest config, fixture patterns, TypeScript
  strict mode flags, ESM setup, or JSON schema compatibility with the Python
  implementation. Also trigger when touching anything in src/tests/.
---

# CareerClaw-JS Testing & Config

## Test Philosophy

All tests are **fully offline** — no live network calls. Dependencies (fetch,
repos, temp dirs) are injected. Test files live in `src/tests/`.

## Patterns

- **Fixtures:** `src/tests/fixtures/` contains mock RSS feeds, HN API responses,
  and user profiles.
- **HTTP stubbing:** Pass a stub `fetchFn` to every function that makes network
  calls. Never rely on real HTTP.
- **Filesystem isolation:** Pass temp directories to `TrackingRepository` so
  tests don't write to the real `.careerclaw/` directory.
- **Process isolation:** vitest runs with `isolate: true` — each test file gets
  its own environment. This prevents `src/config.ts` module cache from bleeding
  between test files.

## Writing a New Test

1. Create `src/tests/<module>.test.ts`.
2. Import the function under test and any fixture data.
3. Stub all external dependencies (fetch, filesystem, env vars).
4. Use `vitest`'s `describe`/`it`/`expect` — no special test utilities needed.
5. Run with `npx vitest run src/tests/<module>.test.ts`.

## TypeScript Configuration

Strict mode is fully enabled:

- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`
- `exactOptionalPropertyTypes` — `?:` means "missing", not "missing or undefined"
- `noImplicitOverride` — requires `override` keyword on subclass methods

Module system: Native ESM (`"type": "module"`, `"module": "NodeNext"`).

**Runtime requirement:** Node.js ≥ 20.

## JSON Schema Compatibility

`src/models.ts` schemas intentionally match the Python careerclaw
implementation. Profile files, tracking files, and run log entries are
interchangeable between the JS and Python runtimes. Do not rename or restructure
these schemas without coordinating with the Python side.
