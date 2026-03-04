# careerclaw-js

[![CI](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/orestes-garcia-martinez/careerclaw-js/actions/workflows/ci.yml)

**Privacy-first job search automation for OpenClaw — Node.js / TypeScript.**

CareerClaw turns your AI agent into a structured daily workflow:
fetch listings → rank matches → draft outreach → track applications.

- **Local-first:** your resume and results stay on your machine
- **No subscription:** one-time purchase for Pro
- **Bring your own LLM API key (optional):** use OpenAI or Anthropic to enhance drafts
- **Works everywhere:** Node.js is natively available in every OpenClaw deployment

> **Why a Node.js rewrite?** The OpenClaw gateway ships Node.js v22 and npm natively,
> but has no Python package manager — making the original Python package's self-healing
> installation impossible in Docker-based deployments. careerclaw-js resolve this permanently.


---

## How It Works

1. **Fetches** job listings from supported sources (RemoteOK RSS + Hacker News Who's Hiring baseline; more sources added over time)
2. **Ranks** them against your profile using keyword overlap, experience alignment, salary fit, and work-mode preference
3. **Drafts** outreach for each top match (deterministic template in Free; optional LLM enhancement in Pro)
4. **Tracks** your application pipeline locally (JSON files under `~/.careerclaw/`)

One command. Everything is local.

---

## Quickstart

### 1. Install

```bash
npm install -g careerclaw-js
```

Verify:

```bash
careerclaw-js --version
```

### 2. Set up via OpenClaw (recommended)

If you are running CareerClaw through OpenClaw/ClawHub, the agent will guide you through
setup automatically. Provide your resume and it will create your profile, ask a couple of
preference questions (work mode + salary), and run your first briefing.

### 3. Set up manually

Create the runtime directory:

```bash
mkdir -p ~/.careerclaw
```

Create `~/.careerclaw/profile.json`:

```json
{
  "skills": ["typescript", "python", "react", "sql"],
  "target_roles": ["senior engineer", "staff engineer"],
  "experience_years": 7,
  "work_mode": "remote",
  "resume_summary": "Senior engineer with 7 years building distributed systems and developer tools.",
  "location": "Austin, TX",
  "salary_min": 150000
}
```

### 4. Run your first briefing

```bash
# Dry run first — no files written, safe to preview
careerclaw-js briefing --dry-run

# With your resume for better match quality (recommended)
careerclaw-js briefing --resume-pdf ~/.careerclaw/resume.pdf --dry-run

# Full run when you're happy with the results
careerclaw-js briefing --resume-pdf ~/.careerclaw/resume.pdf
```

> **Note:** The `briefing` command ships in v0.8.0. careerclaw-js v0.1.0 is the
> Phase 1 foundation release (models + config), and v0.2.0 adds the source adapters.
> See the [roadmap](#roadmap) below.

---

## Sample Output

```
=== CareerClaw Daily Briefing ===
Fetched jobs: 244 | After dedupe: 244
Duration: 4812ms

Top Matches:
...
```

---

## Free vs Pro

| Feature                                       | Free | Pro             |
|-----------------------------------------------|------|-----------------|
| Job ingestion (baseline sources)              | ✅    | ✅               |
| Additional job sources / integrations         | ❌    | ✅ (as released) |
| Top matches with score breakdown              | ✅    | ✅               |
| Outreach email draft (deterministic template) | ✅    | ✅               |
| Application tracking (local JSON)             | ✅    | ✅               |
| Manual briefing trigger                       | ✅    | ✅               |
| JSON output for agent integration             | ✅    | ✅               |
| Gap analysis (ATS keyword shadowing)          | ❌    | ✅               |
| LLM-enhanced outreach (your LLM API key)      | ❌    | ✅               |
| Resume intelligence (section-aware weighting) | ❌    | ✅               |
| Scheduled / automated daily briefings         | ❌    | ✅ (roadmap)     |
| CSV / Sheets export                           | ❌    | ✅ (roadmap)     |

**Pro tier: $39 one-time (lifetime license).**

Purchase on Polar.sh:
https://polar.sh/orestes-garcia-martinez/careerclaw-pro

---

## Optional: Pro + Setup & Configuration (1:1)

Gumroad also offers **"Pro + Setup & Configuration (1:1)"** (limited slots). It includes:

- Install careerclaw-js into your OpenClaw workspace
- Configure env vars + optional LLM API keys
- Get your first daily briefing running successfully
- Async troubleshooting included

Available at checkout on Polar.sh.

---

## Pro: Upgrading

Purchase a license key on Polar.sh. Polar delivers the key by email immediately after payment.

### Activating — Docker / self-hosted users

```bash
docker compose run --rm openclaw-cli \
  config set agents.defaults.sandbox.docker.env.CAREERCLAW_PRO_KEY "YOUR-KEY-HERE"
```

Or add it to your `.env` file:

```
CAREERCLAW_PRO_KEY=YOUR-KEY-HERE
```

The key is activated on first use and cached locally as a SHA-256 hash.
Re-validation happens every 7 days (requires internet access).

### Activating — MyClaw managed users

Tell your OpenClaw agent:

> "Set my CAREERCLAW_PRO_KEY to YOUR-KEY-HERE"

The agent stores the key in your OpenClaw config and activates it on the next CareerClaw run.

---

## Pro: LLM-Enhanced Drafts

With a valid Pro license, supply your own LLM API key to receive personalized outreach
emails referencing your specific resume signals and each job's requirements. Falls back
to the deterministic template silently on any failure.

```bash
# Anthropic (default — uses claude-sonnet-4-20250514)
export CAREERCLAW_PRO_KEY=YOUR-KEY-HERE
export CAREERCLAW_LLM_KEY=sk-ant-...
careerclaw-js briefing --resume-pdf ~/.careerclaw/resume.pdf

# OpenAI
export CAREERCLAW_LLM_KEY=sk-...
export CAREERCLAW_LLM_PROVIDER=openai
careerclaw-js briefing --resume-pdf ~/.careerclaw/resume.pdf

# Override the model
export CAREERCLAW_LLM_MODEL=claude-haiku-4-5-20251001
```

Estimated cost per run: ~$0.018 at claude-sonnet-4-20250514 pricing with your own key.

---

## All CLI Options

> Available in v0.8.0.

```bash
careerclaw-js briefing [OPTIONS]

Options:
  --profile PATH        Path to profile.json (default: ~/.careerclaw/profile.json)
  --resume-text PATH    Plain text resume file (.txt)
  --resume-pdf PATH     PDF resume file (.pdf)
  --top-k INT           Number of top matches to return (default: 3)
  --dry-run             Run without writing tracking or run log
  --json                Print JSON output only (machine-readable)
  --analysis MODE       Gap analysis verbosity: off | summary | full (default: summary)
  --no-enhance          Force deterministic drafts even when LLM key is set
```

---

## Application Tracking

Tracking is written automatically on each non-dry-run. Status lifecycle:

`saved` → `applied` → `interviewing` → `rejected`

Runtime files — all stored under `~/.careerclaw/` (gitignored by default):

| File                        | Contents                                              |
|-----------------------------|-------------------------------------------------------|
| `profile.json`              | Your career profile                                   |
| `resume.txt` / `resume.pdf` | Your resume (optional)                                |
| `tracking.json`             | Saved jobs keyed by stable `job_id`                   |
| `runs.jsonl`                | Append-only run log (one line per run)                |
| `resume_intel.json`         | Cached resume intelligence (Pro)                      |
| `.license_cache`            | Pro license validation cache (SHA-256 hash only)      |

> **File format compatibility:** careerclaw-js uses the same JSON formats as the Python
> `careerclaw` package. `profile.json`, `tracking.json`, and `runs.jsonl` are fully
> interchangeable between both implementations.

---

## Environment Variables

| Variable                    | Description                                                      |
|-----------------------------|------------------------------------------------------------------|
| `CAREERCLAW_PRO_KEY`        | Pro license key (Polar.sh)                                       |
| `CAREERCLAW_LLM_KEY`        | API key for LLM draft enhancement (Pro)                          |
| `CAREERCLAW_LLM_PROVIDER`   | `anthropic` (default) or `openai`                                |
| `CAREERCLAW_LLM_MODEL`      | Model override (default: `claude-sonnet-4-20250514`)             |
| `CAREERCLAW_DIR`            | Override runtime directory (default: `~/.careerclaw`)            |
| `HN_WHO_IS_HIRING_ID`       | Override HN thread ID (updated monthly)                          |

---

## Roadmap

careerclaw-js is being built phase by phase, porting the full Python careerclaw feature
set to Node.js/TypeScript. The Python repository remains active in parallel — no deprecation.

| Phase | Scope                                             | Status     |
|-------|---------------------------------------------------|------------|
| 1     | Models + config                                   | ✅ v0.1.0  |
| 2     | RemoteOK + HN adapters                            | ✅ v0.2.0  |
| 3     | Source aggregation + text processing              | ✅ v0.3.0  |
| 4     | Matching engine + scoring                         | 🔜         |
| 5     | Requirements + resume intelligence + gap analysis | 🔜         |
| 6     | Drafting + LLM enhancement                        | 🔜         |
| 7     | Tracking + license validation                     | 🔜         |
| 8     | Briefing CLI + npm publish + SKILL.md update      | 🔜         |

---

## Development

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Setup

```bash
git clone https://github.com/orestes-garcia-martinez/careerclaw-js
cd careerclaw-js
npm install
```

### Running tests

```bash
# All tests (offline, no network)
npm test

# Watch mode
npm run test:watch

# Type-check only
npm run lint
```

### Project structure

```
careerclaw-js/
├── src/
│   ├── adapters/          # RemoteOK RSS + HN Firebase adapters
│   ├── core/              # Shared text processing
│   ├── io/                # Resume loaders (txt + PDF)
│   ├── llm/               # LLM draft enhancer (Pro)
│   ├── matching/          # Scoring engine
│   ├── tests/             # Vitest test suite
│   ├── briefing.ts        # Pipeline orchestrator + CLI entry point
│   ├── config.ts          # Environment and source configuration
│   ├── drafting.ts        # Deterministic draft templates
│   ├── gap.ts             # Gap analysis engine
│   ├── license.ts         # Pro license activation and validation
│   ├── models.ts          # Canonical data schemas
│   ├── requirements.ts    # Job requirements extraction
│   ├── resume_intel.ts    # Resume intelligence
│   ├── sources.ts         # Source aggregation
│   └── tracking.ts        # Tracking repository
├── SKILL.md
├── CHANGELOG.md
├── package.json
└── tsconfig.json
```

---

## Security & Privacy

careerclaw-js is built on a local-first architecture. Your data never leaves your machine
unless you configure an LLM API key.

- **No backend.** No telemetry. No analytics endpoint.
- **API keys never stored.** LLM keys are read from the environment at runtime and never written to disk or logs.
- **License cache is hash-only.** Only a SHA-256 hash of the license key is written locally — the raw key is never stored.
- **No PII transmission.** Your resume, profile, and application history are stored only in `~/.careerclaw/` on your local machine.
- **External calls:** `remoteok.com` (RSS, no auth), `hacker-news.firebaseio.com` (public API, no auth), `api.polar.sh` (license validation only), and your configured LLM provider (using your own key).
- **VirusTotal clean** on every release.

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## License

- **Free tier:** MIT License — see [LICENSE](LICENSE)
- **Pro tier:** Commercial license — see [POLAR-LICENSE](POLAR-LICENSE)

---

## Support

- **GitHub Issues:** bug reports and feature requests
- **Response SLA:** critical bugs < 48h · general questions < 72h
- **Security disclosures:** see [SECURITY.md](SECURITY.md)
- **Pro inquiries:** orestes.garcia.martinez@gmail.com