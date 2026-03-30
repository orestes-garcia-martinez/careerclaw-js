---
name: careerclaw-commands
description: >
  Quick reference for all CareerClaw-JS build, test, lint, smoke test, and debug
  commands. Use this skill when the user asks "how do I build", "how do I test",
  "how do I run tests", "run smoke tests", "what debug scripts exist", "what
  commands are available", or any variation. Also use when you need to run a
  command and aren't sure of the exact invocation.
---

# CareerClaw-JS Commands

## Build

```bash
npm run build          # TypeScript compilation (tsc)
npm run dev            # Watch mode
```

## Test

```bash
npm test               # Run all tests (vitest run)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

Single test file:

```bash
npx vitest run src/tests/briefing.test.ts
```

## Lint

```bash
npm run lint           # tsc --noEmit (type-check only)
```

## Smoke Tests

Require live network. All require `.env` with API keys unless noted.

```bash
npm run smoke:sources    # source adapters (no API keys needed)
npm run smoke:briefing   # full briefing pipeline
npm run smoke:llm        # LLM integration (requires API keys)
```

### ClawOS Integration Smoke Test

Runs 8 user actions × 30 assertions via `runCareerClawWithContext()`:

```bash
npx tsx --env-file=.env scripts/smoke_clawos.ts
```

## Debug Scripts

All require `.env`:

```bash
npm run debugging:license
npm run debugging:pro
npm run debugging:llm-response
```
