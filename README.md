# CareerClaw JS

CareerClaw is a free, local-first job search assistant. It finds job openings, ranks them against your profile, drafts outreach for top matches, and saves opportunities locally.

Run it as a **standalone Node.js CLI** or install the **[CareerClaw skill from ClawHub](https://clawhub.ai/orestes-garcia-martinez/skills/careerclaw)** to use it inside OpenClaw.

## What CareerClaw does

- Fetches listings from RemoteOK and Hacker News Who’s Hiring. You can optionally add Google Jobs results through SerpApi.
- Ranks openings using your skills, experience, salary preferences, and preferred work mode.
- Shows matching signals so you can decide which roles are worth a closer look.
- Drafts outreach for top matches using templates.
- Saves opportunities and briefing history on your machine.

## Quickstart: standalone CLI

**Requirements:** Node.js 20 or later and npm 10 or later.

### 1. Install CareerClaw

```sh
npm install -g careerclaw-js
careerclaw-js --version
```

### 2. Create your profile

Save the following example as `profile.json` in your working directory. Replace the values with your own.

```json
{
  "skills": ["typescript", "react", "node.js", "sql"],
  "target_roles": ["senior software engineer", "full-stack engineer"],
  "experience_years": 7,
  "work_mode": "remote",
  "resume_summary": "Software engineer building web applications and APIs.",
  "location": "Jacksonville, FL",
  "location_radius_km": null,
  "salary_min": 120000
}
```

Use `remote`, `hybrid`, or `onsite` for `work_mode`. The optional `location_radius_km` field applies to location-based searches for hybrid and onsite roles.

### 3. Preview your first briefing

From the directory containing `profile.json`, run:

```sh
careerclaw-js --profile ./profile.json --dry-run
```

A dry run fetches current listings and shows the results without writing tracking or run logs. The default sources don’t require an API key.

To include your résumé, save a plain-text copy as `resume.txt` and pass it explicitly:

```sh
careerclaw-js --profile ./profile.json --resume-txt ./resume.txt --dry-run
```

When you’re ready to save the results, run the briefing without `--dry-run`:

```sh
careerclaw-js --profile ./profile.json
```

Add `--resume-txt ./resume.txt` if you want the saved briefing to include résumé matching signals.

## Use CareerClaw inside OpenClaw

1. Open the [CareerClaw listing on ClawHub](https://clawhub.ai/orestes-garcia-martinez/skills/careerclaw).
2. Follow the installation instructions for your OpenClaw environment.
3. Ask OpenClaw to help you set up CareerClaw and run your first job search briefing.

Example request:

> Help me set up CareerClaw, then run a job search briefing for senior software engineering roles.

## CLI reference

Run `careerclaw-js --help` to see all options available in your installed version.

| Option | What it does |
| --- | --- |
| `-p`, `--profile PATH` | Reads your profile from a JSON file. |
| `--resume-txt PATH` | Includes a plain-text résumé for matching. |
| `-k`, `--top-k INT` | Sets the maximum number of matches to return. |
| `-d`, `--dry-run` | Previews results without writing tracking or run logs. |
| `-j`, `--json` | Returns machine-readable output for scripts and integrations. |
| `-v`, `--version` | Prints the installed version. |
| `-h`, `--help` | Shows CLI help. |

To preview up to five matches as JSON:

```sh
careerclaw-js --profile ./profile.json --top-k 5 --dry-run --json
```

## Optional: Google Jobs through SerpApi

CareerClaw can use SerpApi’s Google Jobs integration to expand its coverage. This integration requires a SerpApi account and API key and is subject to SerpApi’s usage limits.

Set these variables in the environment where CareerClaw runs:

```dotenv
CAREERCLAW_SERPAPI_API_KEY=your-serpapi-key
CAREERCLAW_SERPAPI_GOOGLE_JOBS_ENABLED=true
CAREERCLAW_SERPAPI_GOOGLE_JOBS_MAX_PAGES=1
```

For remote profiles, CareerClaw uses SerpApi’s remote filter. For hybrid and onsite profiles, it uses the profile location and search radius.

| Variable | What it controls |
| --- | --- |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_MAX_PAGES` | Number of results pages per run, from 1 to 5. |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_RADIUS_KM` | Maximum search radius for location-based queries. |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_GL` | Google country code for search results. |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_HL` | Language for Google results. |
| `CAREERCLAW_SERPAPI_GOOGLE_JOBS_NO_CACHE` | Requests fresh results, which can consume additional search credits. |

## Local files and privacy

Your profile and résumé are read from the file paths you provide. CareerClaw fetches listings from external job sources and writes tracking data locally. If you enable SerpApi, it sends the search parameters needed to retrieve Google Jobs results.

The runtime directory is `.careerclaw` by default. Set `CAREERCLAW_DIR` to use a different directory.

| File | Purpose |
| --- | --- |
| `tracking.json` | Saved opportunities keyed by job ID. |
| `runs.jsonl` | Append-only history of briefing runs. |

Keep résumés, profiles, tracking files, and API keys out of source control. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Development

```sh
git clone https://github.com/orestes-garcia-martinez/careerclaw-js.git
cd careerclaw-js
npm install
npm run lint
npm run build
npm test
```

Use `npm run test:watch` while developing. The automated tests are designed to run offline. The following smoke tests use live job sources:

```sh
npm run smoke:sources
npm run smoke:briefing
```

| Path | Purpose |
| --- | --- |
| [`src/cli.ts`](src/cli.ts) | CLI argument parsing and output. |
| [`src/runtime.ts`](src/runtime.ts) | Programmatic entry points. |
| [`src/briefing.ts`](src/briefing.ts) | Job briefing pipeline. |
| [`src/adapters/`](src/adapters/) | Job source integrations. |
| [`src/matching/`](src/matching/) | Job ranking and scoring. |
| [`src/tests/`](src/tests/) | Automated tests. |
| [`SKILL.md`](SKILL.md) | Agent skill instructions. |

## Project links

- [CareerClaw JS on npm](https://www.npmjs.com/package/careerclaw-js)
- [CareerClaw on ClawHub](https://clawhub.ai/orestes-garcia-martinez/skills/careerclaw)
- [Release notes](CHANGELOG.md)
- [Bug reports and feature requests](https://github.com/orestes-garcia-martinez/careerclaw-js/issues)

The npm package is published under the MIT license.
