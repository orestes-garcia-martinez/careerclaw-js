---
name: CareerClaw
version: 0.11.0
description: AI-powered job search automation. Fetches listings, ranks matches against your profile, drafts outreach, and tracks applications — all locally.
author: Orestes Garcia Martinez
install:
  - kind: node
    package: careerclaw-js
---

# CareerClaw

CareerClaw turns your AI agent into a structured job search workflow:
**fetch listings → rank matches → draft outreach → track applications.**

All data stays on your machine. No job board account required.

---

## Setup

### Step 1 — Ensure careerclaw-js is installed

Run this once to install or upgrade careerclaw-js:

```bash
careerclaw-js --help >/dev/null 2>&1 || npm install -g careerclaw-js
```

Verify the install:

```bash
careerclaw-js --version
```

Expected output: `careerclaw-js 0.11.0`

### Step 2 — Create your runtime directory

```bash
mkdir -p ~/.careerclaw
```

### Step 3 — Create your profile

Create `~/.careerclaw/profile.json` with your details:

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

**Fields:**

| Field              | Type                                        | Description                                  |
|--------------------|---------------------------------------------|----------------------------------------------|
| `skills`           | `string[]`                                  | Your technical skills (lowercase)            |
| `target_roles`     | `string[]`                                  | Job titles you are targeting                 |
| `experience_years` | `number`                                    | Total years of professional experience       |
| `work_mode`        | `"remote" \| "hybrid" \| "onsite" \| "any"` | Work mode preference                         |
| `resume_summary`   | `string`                                    | 1–3 sentence resume summary                  |
| `location`         | `string`                                    | Your city/region (used for location scoring) |
| `salary_min`       | `number`                                    | Minimum annual salary in USD                 |

---

## Data Files

All runtime state lives in `~/.careerclaw/`:

| File            | Description                                     |
|-----------------|-------------------------------------------------|
| `profile.json`  | Your career profile                             |
| `tracking.json` | Saved jobs and application status               |
| `runs.jsonl`    | Append-only run log                             |
| `resume.txt`    | Plain-text resume (optional, improves matching) |
| `resume.pdf`    | PDF resume (optional, improves matching)        |

---

## Environment Variables

| Variable                  | Description                                                   |
|---------------------------|---------------------------------------------------------------|
| `CAREERCLAW_PRO_KEY`      | Pro license key (Gumroad)                                     |
| `CAREERCLAW_LLM_KEY`      | API key for LLM draft enhancement (Pro)                       |
| `CAREERCLAW_LLM_PROVIDER` | `anthropic` (default) or `openai`                             |
| `CAREERCLAW_LLM_MODEL`    | Model override (default: `claude-sonnet-4-20250514`)          |
| `CAREERCLAW_DIR`          | Override runtime directory (default: `~/.careerclaw`)         |
| `HN_WHO_IS_HIRING_ID`     | Override HN thread ID (updated monthly — current: `47219668`) |

---

## Privacy & Security

- **No backend.** No telemetry. No analytics endpoint.
- **API keys never stored.** `CAREERCLAW_LLM_KEY` is read from the environment at runtime only.
- **License cache is hash-only.** The raw Pro key is never written to disk.
- **No PII transmission.** Your resume, profile, and application history stay in `~/.careerclaw/` only.
- **External calls (when active):** `remoteok.com` (RSS), `hacker-news.firebaseio.com` (public API), `api.gumroad.com` (license validation), and your configured LLM provider (using your own key).

---

## Compatibility

careerclaw-js uses the same JSON file formats as the Python careerclaw package.
`profile.json`, `tracking.json`, and `runs.jsonl` are interchangeable between
both implementations.

---

*CareerClaw is an independent OpenClaw skill. Not affiliated with RemoteOK or Hacker News.*