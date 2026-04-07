# careerclaw-js

[![Security Scan (VirusTotal)](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/security-scan.yml/badge.svg)](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/security-scan.yml)

[![CI](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/ci.yml)

**Privacy-first job search automation for [ClawOS](https://clawoshq.com/) — with a standalone Node.js runtime for local/manual workflows.**

CareerClaw turns your job-search workflow into a structured daily system:
fetch listings → rank matches → draft outreach → track applications.

- **Recommended runtime:** [ClawOS](https://clawoshq.com/) handles setup, entitlement, and trusted execution for you
- **Standalone supported:** the Node.js CLI works for local/manual workflows, testing, and as a skill on any agentic platform (e.g. [OpenClaw](https://openclaw.org/)). Install from [ClawHub](https://clawhub.ai/)
- **Local-first:** your resume and results stay on your machine
- **Bring your own LLM API key (optional):** use OpenAI or Anthropic to enhance drafts

> **Why a Node.js rewrite?** It gives CareerClaw a clean direct-import runtime for ClawOS and
> a friction-light standalone CLI for manual workflows. The same engine can now run inside the
> platform shell or as a local package without a public Pro bypass flag.

---

## How It Works

1. **Fetches** job listings from RemoteOK RSS, Hacker News Who's Hiring, and optionally SerpApi's Google Jobs aggregator for broader multi-board coverage
2. **Ranks** them against your profile using keyword overlap, experience alignment, salary fit, and work-mode preference
3. **Drafts** outreach for each top match (deterministic template on Free; LLM-enhanced on Pro)
4. **Tracks** your application pipeline locally in `.careerclaw/`

One command. Everything is local.

---

## Quickstart

### 1. Use CareerClaw inside ClawOS (recommended)

This is the recommended path. [ClawOS](https://clawoshq.com/) handles the full user experience:

- account + billing
- skill installation and setup
- trusted Pro activation upstream
- direct-import execution inside the platform worker

When CareerClaw runs inside ClawOS, users should buy and activate Pro through ClawOS — not by entering a standalone license key into the skill runtime.

### 2. Optional: install the standalone CLI

The standalone package can be installed directly from npm, or downloaded as a skill from [ClawHub](https://clawhub.ai/) for use on any agentic platform (e.g. [OpenClaw](https://openclaw.org/)).

```bash
npm install -g careerclaw-js
```

Verify:

```bash
careerclaw-js --version
```

### 3. Set up manually
Create the runtime directory and profile:

```bash
mkdir -p ~/.careerclaw
careerclaw-js profile init
```

Create : `~/.careerclaw/profile.json`

```json
{
  "skills": ["typescript", "python", "react", "sql"],
  "target_roles": ["senior engineer", "staff engineer"],
  "experience_years": 7,
  "work_mode": "remote",
  "resume_summary": "Senior engineer with 7 years building distributed systems and developer tools.",
  "location": "Austin, TX",
  "location_radius_km": null,
  "salary_min": 150000
}
```

`location_radius_km` is optional. When set, it limits location-based job source searches (e.g. SerpApi) to within that radius. Only applied when `work_mode` is `"onsite"` or `"hybrid"`. Defaults to the operator cap (161 km / ~100 mi) when null. ClawOS users set this in miles through the UI — the platform converts to km automatically.

### 4. Run your first standalone briefing

```bash
# Dry run first — no files written, safe to preview
careerclaw-js --dry-run

# With your resume for better match quality (recommended)
careerclaw-js --resume-txt ~/.careerclaw/resume.txt --dry-run

# Full run when you're happy with the results
careerclaw-js --resume-txt ~/.careerclaw/resume.txt

# JSON output for agent/script consumption
careerclaw-js --resume-txt ~/.careerclaw/resume.txt --json
```

Sample Output

=== CareerClaw Daily Briefing ===
Fetched jobs: 303 | Sources: remoteok: 97 | hackernews: 196 | serpapi_google_jobs: 10
Duration: 1922ms fetch + 182ms rank

Top Matches:

1) Senior Full-Stack Engineer @ Instinct Science  [hackernews]
   score: 0.2329 | fit: 8%
   matches: react, typescript, design, aws, senior
   gaps:    elixir, postgresql, emr
   location: REMOTE (US)
   url: https://news.ycombinator.com/item?id=47233919


## Free vs Pro

CareerClaw has two ways to unlock Pro features depending on how you run it:

| Feature                                          | Free | Pro   |
|--------------------------------------------------|------|-------|
| Daily briefing                                   | ✅   | ✅    |
| Top 3 ranked matches                             | ✅   | ✅    |
| Application tracking                             | ✅   | ✅    |
| Outreach email draft (template)                  | ✅   | ✅    |
| LLM-enhanced outreach email                      | —    | ✅    |
| LLM-enhanced Resume gap analysis                 | —    | ✅    |
| LLM-enhanced Cover letter (tailored, <300 words) | —    | ✅    |

### Pro pricing

| Channel                  | Price                               | Details                                                                                                                                     |
|--------------------------|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **ClawOS (recommended)** | **$9/month**                        | Managed billing, trusted platform activation, no key management. Visit [clawoshq.com](https://clawoshq.com/)                                |
| **Standalone**           | **$39 one-time (lifetime license)** | Gumroad key validated against API, cached locally. Purchase at [ogm.gumroad.com/l/careerclaw-pro](https://ogm.gumroad.com/l/careerclaw-pro) |

Recommendation: If you're using ClawOS, purchase Pro through the platform — it handles entitlement, billing, and activation for you.
The standalone Gumroad license is intended for users running the CLI directly or integrating CareerClaw as a skill on other agentic platforms.

### Pro: Activating
#### ClawOS-managed users (recommended)
Buy and activate Pro through ClawOS. The platform resolves the user's entitlement upstream and passes a verified execution context into CareerClaw.
In ClawOS mode:
- no standalone --pro flag is used
- no raw Pro bypass is exposed through the public CLI
- CareerClaw trusts the platform execution context only after ClawOS verification

#### Standalone users
Purchase a license key on Gumroad. The key is emailed immediately after payment.
Add your standalone Pro key to .env or your process environment.
The key is validated against Gumroad on first use and cached locally as a SHA-256 hash.
Re-validation happens every 7 days (requires internet).

### Docker / self-hosted
Add to your .env:

CAREERCLAW_PRO_KEY=YOUR-KEY-HERE
CAREERCLAW_OPENAI_KEY=sk-...

### Pro: LLM-Enhanced Drafts

With a valid Pro license and an LLM API key, CareerClaw:

- Writes personalized outreach emails using your actual resume signals mapped to each job's specific requirements. Falls back to the deterministic template silently on any LLM failure.
- Enhances the algorithmic gap analysis with personalized insights and recommendations.
- Generates a tailored cover letter (<300 words) for a specific job match.

Failover chain example (tries Anthropic first, falls back to OpenAI):

```bash
CAREERCLAW_ANTHROPIC_KEY=sk-ant-...
CAREERCLAW_OPENAI_KEY=sk-...
CAREERCLAW_LLM_CHAIN=anthropic/claude-haiku-4-5-20251001,openai/gpt-4o-mini
```

Estimated cost per run: ~$0.003 at claude-haiku-4-5-20251001 pricing (3 drafts).

### Optional: SerpApi Google Jobs aggregator

For broader job coverage, you can enable SerpApi's Google Jobs engine. This surfaces listings from LinkedIn, ZipRecruiter, Lever, Greenhouse, and company career pages through one structured API — without maintaining site-specific scrapers.

```bash
CAREERCLAW_SERPAPI_API_KEY=...
CAREERCLAW_SERPAPI_GOOGLE_JOBS_ENABLED=true
CAREERCLAW_SERPAPI_GOOGLE_JOBS_MAX_PAGES=1         # pages per run (1–5)
CAREERCLAW_SERPAPI_GOOGLE_JOBS_RADIUS_KM=161       # operator hard cap (~100 mi); user radius is capped here
CAREERCLAW_SERPAPI_GOOGLE_JOBS_GL=us               # Google country domain
CAREERCLAW_SERPAPI_GOOGLE_JOBS_HL=en               # UI language
CAREERCLAW_SERPAPI_GOOGLE_JOBS_NO_CACHE=false      # true = bypass SerpApi cache (uses search credits)
```

**How location and radius work:**

- `work_mode: "remote"` — uses SerpApi's native remote filter (`ltype=1`). No geographic `location` or radius is sent.
- `work_mode: "onsite"` / `"hybrid"` — passes `profile.location` as the geographic anchor and `profile.location_radius_km` as the search radius (`lrad`), capped at `CAREERCLAW_SERPAPI_GOOGLE_JOBS_RADIUS_KM`.

**ClawOS users** set `CAREERCLAW_SERPAPI_API_KEY` (and optionally the other vars) on the **worker** service. The radius is configured in miles through the ClawOS settings UI and converted to km automatically.

**Standalone users** place these in `.env`; `location_radius_km` in `profile.json` accepts kilometres directly.

### Programmatic Integration

CareerClaw exposes a direct-import runtime for both trusted platform adapters and standalone programmatic use.

#### ClawOS (trusted platform context)
Use createClawOsExecutionContext() to build a verified context after upstream entitlement checks.
CareerClaw trusts this context and skips standalone license validation entirely.

```ts
import {
  runCareerClawWithContext,
  createClawOsExecutionContext,
  CAREERCLAW_FEATURES,
} from "careerclaw-js";

const context = createClawOsExecutionContext({
  tier: "pro",
  features: [CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT],
});

const result = await runCareerClawWithContext(
  {
    profile,
    resumeText,
    topK: 5,
    dryRun: false,
  },
  context
);
```

This API is intended for trusted platform code paths such as the ClawOS worker after assertion verification.
The public standalone CLI keeps its own standalone license flow.

### Standalone (programmatic)

Use runCareerClawStandalone() for local scripts, CI pipelines, or as a skill inside other agentic platforms (e.g. OpenClaw).
License validation runs against Gumroad when a proKey is provided.

```ts
import { runCareerClawStandalone } from "careerclaw-js";

const result = await runCareerClawStandalone(
  {
    profile,
    resumeText,
    topK: 3,
    dryRun: true,
  },
  { proKey: process.env.CAREERCLAW_PRO_KEY }
);
```

### All CLI Options

careerclaw-js [OPTIONS]

Options:
-p, --profile PATH     Path to profile.json
                       (default: .careerclaw/profile.json)
     --resume-txt PATH Plain-text resume for enhanced matching
                       (default: .careerclaw/resume.txt if present)
-k, --top-k INT        Number of top matches to return (default: 3)
-d, --dry-run          Run without writing tracking or run log
-j, --json             Machine-readable JSON output (no colour, no headers)
-v, --version          Show version number
-h, --help             Show this help message

### Application Tracking

Tracking is written automatically on each non-dry-run. Status lifecycle:
saved → applied → interviewing → offer → rejected
Runtime files — all stored under .careerclaw/:

| File             | Contents                                         |
|------------------|--------------------------------------------------|
| `profile.json`   | Career profile                                   |
| `resume.txt`     | Plain-text resume (optional)                     |
| `tracking.json`  | Saved jobs keyed by stable `job_id`              |
| `runs.jsonl`     | Append-only run log (one line per run)           |
| `.license_cache` | Pro license validation cache (SHA-256 hash only) |

File format compatibility: careerclaw-js uses the same JSON formats as the Python careerclaw package.
profile.json, tracking.json, and runs.jsonl are fully interchangeable between both implementations.

### Environment Variables

| Variable                                    | Default  | Description                                                                           |
|---------------------------------------------|----------|---------------------------------------------------------------------------------------|
| `CAREERCLAW_PRO_KEY`                        | —        | Pro license key (Gumroad)                                                             |
| `CAREERCLAW_ANTHROPIC_KEY`                  | —        | Anthropic API key for LLM draft enhancement                                           |
| `CAREERCLAW_OPENAI_KEY`                     | —        | OpenAI API key for LLM draft enhancement                                              |
| `CAREERCLAW_LLM_KEY`                        | —        | Legacy single-provider key fallback                                                   |
| `CAREERCLAW_LLM_CHAIN`                      | —        | Ordered failover chain, e.g. `anthropic/claude-haiku-4-5-20251001,openai/gpt-4o-mini` |
| `CAREERCLAW_LLM_MODEL`                      | —        | Override default LLM model                                                            |
| `CAREERCLAW_LLM_PROVIDER`                   | —        | `anthropic` or `openai` (inferred from key when not set)                              |
| `CAREERCLAW_DIR`                            | —        | Override runtime directory (default: `.careerclaw`)                                   |
| `HN_WHO_IS_HIRING_ID`                       | —        | Override HN thread ID (updated monthly)                                               |
| `CAREERCLAW_SERPAPI_API_KEY`                | —        | SerpApi key — enables Google Jobs aggregator when set                                 |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_ENABLED`    | `false`  | Explicitly enable/disable the SerpApi source (`true` auto-set when key is present)    |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_MAX_PAGES`  | `1`      | Pages per run (1–5). Each page ~10 results.                                           |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_RADIUS_KM`  | `161`    | Operator hard cap on location radius (~100 mi). User's `location_radius_km` is capped here. |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_GL`         | `us`     | Google country domain for job results                                                 |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_HL`         | `en`     | UI language for job results                                                           |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_NO_CACHE`   | `false`  | Bypass SerpApi's 1-hour cache (consumes search credits)                               |

Copy .env.example to .env and fill in your values.

### Development

#### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

#### Setup

```bash
git clone https://github.com/orestes-garcia-martinez/careerclaw-js
cd careerclaw-js
npm install
```

#### Running Tests

```bash
# All tests (offline, no network)
npm test

# Watch mode
npm run test:watch

# Type-check only
npm run lint
```

#### ### Smoke tests (live network — run before release)

```bash
npm run smoke:sources    # RemoteOK, HN, and SerpApi connectivity (SerpApi skipped when not configured)
npm run smoke:briefing   # Full pipeline end-to-end
npm run smoke:llm        # LLM keys + Pro license validation
```

### Project Structure
```
careerclaw-js/
├── src/
│   ├── adapters/       # RemoteOK RSS, HN Firebase, and SerpApi Google Jobs adapters
│   ├── core/           # Shared text processing
│   ├── matching/       # Scoring engine
│   ├── tests/          # Vitest test suite (270 tests, fully offline)
│   ├── briefing.ts     # Pipeline orchestrator (standalone + ClawOS entry points)
│   ├── cli.ts          # CLI entry point
│   ├── config.ts       # Environment and source configuration
│   ├── drafting.ts     # Deterministic draft templates (Free tier)
│   ├── execution-context.ts  # Execution context types + feature flags
│   ├── gap.ts          # Gap analysis engine
│   ├── index.ts        # Public API barrel export
│   ├── license.ts      # Pro license validation (Gumroad)
│   ├── llm-enhance.ts  # LLM draft enhancement (Pro)
│   ├── models.ts       # Canonical data schemas
│   ├── requirements.ts # Job requirements extraction
│   ├── resume-intel.ts # Resume intelligence
│   ├── runtime.ts      # Programmatic runtime wrappers (standalone + ClawOS)
│   ├── sources.ts      # Source aggregation
│   └── tracking.ts     # Tracking repository
├── scripts/            # Smoke + debug scripts (not published)
├── SKILL.md            # Agent-skill definition (standalone / legacy agent runtime)
├── CHANGELOG.md
├── SECURITY.md
├── package.json
└── tsconfig.json
```


### Security & Privacy

careerclaw-js is built on a local-first architecture.
- No backend. No telemetry. No analytics endpoint.
- API keys never stored. Keys are read from the environment at runtime only.
- License cache is hash-only. Only SHA-256 of the license key is written to disk.
- LLM privacy. Only extracted keyword signals sent to the LLM — never raw resume text.
- External calls: remoteok.com, hacker-news.firebaseio.com, api.gumroad.com, serpapi.com (only when SerpApi is enabled), and your configured LLM provider (using your own key).

See SECURITY.md for the vulnerability disclosure policy.

### Changelog

See CHANGELOG.md for the release notes.

### License
careerclaw-js is licensed under the MIT License. See LICENSE.md for details.

### Support

- GitHub Issues: bug reports and feature requests
- Response SLA: critical bugs < 48h · general questions < 72h
- Security disclosures: see SECURITY.md
- Pro support: orestes.garcia.martinez@gmail.com


