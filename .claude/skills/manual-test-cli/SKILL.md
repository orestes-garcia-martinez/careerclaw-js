---
name: manual-test-cli
description: >
  Manual CLI test matrix for CareerClaw-JS. Use this skill ONLY when the user
  says "run cli test". Executes 14 CLI variants across Free and Pro tiers with
  --dry-run, verifying help, version, match counts, LLM enhancement, cover
  letters, gap analysis, JSON output, clamping, and out-of-bounds handling.
---

# Task: CLI Test

**Prerequisite:** Run `npm run build` before starting.

Run the full CLI variant matrix below. All runs use `--dry-run`.

- **Free tier:** `node dist/cli.js` (no env file — no Pro key in scope).
- **Pro tier:** `node --env-file=.env dist/cli.js`.

Tests 10–14 require knowing match indices. Run test 7 first, observe how many
matches are returned, then use index `1` (and `1,2` for multi-index variants).

## Test Matrix

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

## Pass Criteria

All 14 variants exit 0. Results match the "What to verify" column.

## Reporting

Report results in a table with columns: `#`, `Command`, `Result` (✅/❌), `Notes`.
