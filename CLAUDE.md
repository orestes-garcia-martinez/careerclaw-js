# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CareerClaw-JS is a local-first, privacy-first job search automation tool.
Node.js ≥ 20, native ESM, strict TypeScript. Data persists under `.careerclaw/`.

## Quick Commands

```bash
npm run build          # TypeScript compilation
npm test               # All tests (vitest)
npm run lint           # Type-check (tsc --noEmit)
```

## Skills

Detailed knowledge is loaded on demand from `.claude/skills/`. Claude will
auto-trigger the right skill based on context, or you can invoke directly:

| Trigger | Skill | What it covers |
|---------|-------|----------------|
| Modifying pipeline code | `/careerclaw-architecture` | Pipeline flow, execution contexts, feature gating, key files |
| "how do I build/test" | `/careerclaw-commands` | All build, test, lint, smoke, and debug commands |
| Writing or debugging tests | `/careerclaw-testing` | Test patterns, TS config, JSON schema compatibility |
| `run cli test` | `/manual-test-cli` | 14-variant CLI test matrix |
| `run clawos user` | `/manual-test-clawos` | 8-action ClawOS smoke test (30 assertions) |
