#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { runCareerClawStandalone } from "./runtime.js";
import {
  PROFILE_PATH,
  RESUME_TXT_PATH,
  DEFAULT_TOP_K,
  PRO_KEY,
} from "./config.js";
import type { UserProfile, BriefingResult, ScoredJob, OutreachDraft, CoverLetter, GapAnalysisReport } from "./models.js";


const { values: args } = parseArgs({
  options: {
    profile: { type: "string", short: "p" },
    "resume-txt": { type: "string" },
    "top-k": { type: "string", short: "k" },
    "cover-letter": { type: "string", short: "c" },
    "gap-analysis": { type: "string", short: "g" },
    "dry-run": { type: "boolean", short: "d", default: false },
    json: { type: "boolean", short: "j", default: false },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.version) {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version: string };
    console.log(pkg.version);
  } catch {
    console.log("unknown");
  }
  process.exit(0);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

const profilePath = args["profile"] ?? PROFILE_PATH;
const resumeTxtPath = args["resume-txt"] ?? null;
const topK = parseInt(args["top-k"] ?? String(DEFAULT_TOP_K), 10);
const dryRun = args["dry-run"] as boolean;
const jsonMode = args["json"] as boolean;

if (isNaN(topK) || topK < 1) {
  fatal(`--top-k must be a positive integer, got: ${args["top-k"]}`);
}

// Parse --cover-letter flag: comma-separated 1-based indices → 0-based array
const coverLetterRaw = args["cover-letter"] ?? null;
let coverLetterMatchIndices: number[] = [];
if (coverLetterRaw) {
  coverLetterMatchIndices = coverLetterRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = parseInt(s, 10);
      if (isNaN(n) || n < 1) {
        fatal(`--cover-letter indices must be positive integers (1-based), got: "${s}"`);
      }
      return n - 1; // Convert 1-based (human) to 0-based (internal)
    });
}

// Parse --gap-analysis flag: same pattern as --cover-letter
const gapAnalysisRaw = args["gap-analysis"] ?? null;
let gapAnalysisMatchIndices: number[] = [];
if (gapAnalysisRaw) {
  gapAnalysisMatchIndices = gapAnalysisRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = parseInt(s, 10);
      if (isNaN(n) || n < 1) {
        fatal(`--gap-analysis indices must be positive integers (1-based), got: "${s}"`);
      }
      return n - 1;
    });
}

function loadProfile(path: string): UserProfile {
  if (!existsSync(path)) {
    fatal(
      `Profile not found: ${path}\n` +
        `  Create one at ${path} or pass --profile PATH.\n` +
        `  See README for the profile schema.`
    );
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    fatal(`Could not read profile: ${path}\n  ${String(err)}`);
  }
  try {
    return JSON.parse(raw!) as UserProfile;
  } catch (err) {
    fatal(`Profile is not valid JSON: ${path}\n  ${String(err)}`);
  }
}

function loadResumeTxt(path: string): string | null {
  if (!existsSync(path)) {
    warn(`Resume file not found: ${path} — running without resume intelligence`);
    return null;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    warn(`Could not read resume: ${path} — running without resume intelligence`);
    return null;
  }
}

function printBriefing(result: BriefingResult): void {
  const { run, matches, drafts, cover_letters, gap_analyses, tracking, dry_run } = result;
  const sources = Object.entries(run.sources)
    .map(([s, n]) => `${s}: ${n}`)
    .join(" | ");

  console.log(`\n=== CareerClaw Daily Briefing ===`);
  console.log(`Fetched jobs: ${run.jobs_fetched} | Sources: ${sources}`);
  console.log(`Duration: ${run.timings.fetch_ms ?? 0}ms fetch + ${run.timings.rank_ms ?? 0}ms rank`);
  if (dry_run) console.log(`(dry-run — no files written)`);
  console.log();

  if (matches.length === 0) {
    console.log(`No matches found for your profile.`);
    console.log(`Try broadening your skills list or checking source health with:`);
    console.log(`  npm run smoke\n`);
  } else {
    console.log(`Top Matches:\n`);
  }
  for (let i = 0; i < matches.length; i++) {
    const m: ScoredJob = matches[i]!;
    const fitPct = Math.round(m.breakdown.keyword * 100);
    const matchStr = m.matched_keywords.slice(0, 5).join(", ") || "(none)";
    const gapStr = m.gap_keywords.slice(0, 5).join(", ") || "(none)";

    console.log(`${i + 1}) ${m.job.title} @ ${m.job.company}  [${m.job.source}]`);
    console.log(`   score: ${m.score.toFixed(4)} | fit: ${fitPct}%`);
    console.log(`   matches: ${matchStr}`);
    console.log(`   gaps:    ${gapStr}`);
    console.log(`   location: ${m.job.location || "(not specified)"}`);
    console.log(`   url: ${m.job.url}`);
    console.log();
  }

  console.log(`Drafts:\n`);
  for (let i = 0; i < drafts.length; i++) {
    const d: OutreachDraft = drafts[i]!;
    console.log(`--- Draft #${i + 1} ---`);
    console.log(`Subject: ${d.subject}`);
    console.log();
    console.log(d.body);
    console.log();
  }

  if (cover_letters.length > 0) {
    console.log(`Cover Letters:\n`);
    for (let i = 0; i < cover_letters.length; i++) {
      const cl: CoverLetter = cover_letters[i]!;
      // Find the match index for display (1-based)
      const matchIdx = matches.findIndex((m) => m.job.job_id === cl.job_id);
      const matchLabel = matchIdx >= 0
        ? `Match #${matchIdx + 1} — ${matches[matchIdx]!.job.title} @ ${matches[matchIdx]!.job.company}`
        : cl.job_id;
      const templateTag = cl.is_template ? " [template fallback]" : "";
      const scorePct = Math.round(cl.match_score * 100);

      console.log(`--- Cover Letter: ${matchLabel}${templateTag} ---`);
      console.log(`Match score: ${scorePct}% | Tone: ${cl.tone}`);
      console.log(`Signals: ${cl.keyword_coverage.top_signals.join(", ") || "(none)"}`);
      console.log(`Gaps: ${cl.keyword_coverage.top_gaps.join(", ") || "(none)"}`);
      console.log();
      console.log(cl.body);
      console.log();
    }
  }

  if (gap_analyses.length > 0) {
    console.log(`Gap Analyses:\n`);
    for (let i = 0; i < gap_analyses.length; i++) {
      const ga: GapAnalysisReport = gap_analyses[i]!;
      const fitPct = Math.round(ga.analysis.fit_score * 100);
      const fitRawPct = Math.round(ga.analysis.fit_score_unweighted * 100);

      console.log(`--- Gap Analysis: ${ga.title} @ ${ga.company} ---`);
      console.log(`Fit score: ${fitPct}% (weighted) | ${fitRawPct}% (unweighted)`);
      console.log();
      console.log(`  Signals (your resume matches):`);
      console.log(`    Keywords: ${ga.analysis.summary.top_signals.keywords.join(", ") || "(none)"}`);
      console.log(`    Phrases:  ${ga.analysis.summary.top_signals.phrases.join(", ") || "(none)"}`);
      console.log();
      console.log(`  Gaps (missing from your resume):`);
      console.log(`    Keywords: ${ga.analysis.summary.top_gaps.keywords.join(", ") || "(none)"}`);
      console.log(`    Phrases:  ${ga.analysis.summary.top_gaps.phrases.join(", ") || "(none)"}`);
      console.log();
    }
  }

  console.log(`Tracking:`);
  console.log(`  ${tracking.created} new job(s) saved`);
  if (tracking.already_present > 0) {
    console.log(`  ${tracking.already_present} already in your tracker (last_seen_at updated)`);
  }
  console.log();
}

async function main(): Promise<void> {
  const profile = loadProfile(profilePath);

  const resumePath = resumeTxtPath ?? (existsSync(RESUME_TXT_PATH) ? RESUME_TXT_PATH : null);
  let resumeText: string | null = null;
  if (resumePath) {
    resumeText = loadResumeTxt(resumePath);
    if (resumeText && !jsonMode) {
      console.log(`Resume loaded: ${resumePath} (ready for Pro enhancement)`);
    }
  }

  const result = await runCareerClawStandalone(
    {
      profile,
      resumeText,
      topK,
      dryRun,
      ...(coverLetterMatchIndices.length > 0
        ? { coverLetterMatchIndices }
        : {}),
      ...(gapAnalysisMatchIndices.length > 0
        ? { gapAnalysisMatchIndices }
        : {}),
    },
    PRO_KEY ? { proKey: PRO_KEY } : {}
  );

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(0);
  }

  printBriefing(result);
  process.exit(0);
}

function fatal(message: string): never {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

function warn(message: string): void {
  console.warn(`Warning: ${message}`);
}

function printHelp(): void {
  console.log(`
careerclaw-js — AI-powered job search briefing

Usage:
  careerclaw-js [options]
  node --env-file=.env dist/cli.js [options]

Options:
  -p, --profile PATH     Path to profile.json
                         (default: ~/.careerclaw/profile.json)
      --resume-txt PATH  Plain-text resume to enhance keyword matching
                         (default: ~/.careerclaw/resume.txt if present)
  -k, --top-k INT        Number of top matches to return (default: 3)
  -c, --cover-letter N   Generate cover letter(s) for match N (1-based).
                         Comma-separated for multiple: --cover-letter 1,3
                         Requires Pro tier and a resume.
  -g, --gap-analysis N   Run detailed gap analysis for match N (1-based).
                         Comma-separated for multiple: --gap-analysis 1,2
                         Requires Pro tier and a resume.
  -d, --dry-run          Run without writing tracking or run log
  -j, --json             Machine-readable JSON output (no colour, no headers)
  -v, --version          Show version number
  -h, --help             Show this help message

Examples:
  careerclaw-js --dry-run
  careerclaw-js --resume-txt ~/.careerclaw/resume.txt --dry-run
  careerclaw-js --json --dry-run
  careerclaw-js --profile ./my-profile.json --top-k 5
  careerclaw-js --top-k 5 --cover-letter 1 --dry-run
  careerclaw-js --top-k 5 --cover-letter 1,3 --gap-analysis 1,2 --dry-run --json
`);
}

main().catch((err) => {
  fatal(String(err));
});
