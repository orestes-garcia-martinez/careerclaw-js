/**
 * scripts/smoke_sources.ts — Live smoke test for job source adapters.
 *
 * Hits real network endpoints. Run MANUALLY before releases, not in CI.
 *
 *   npm run smoke:sources
 *
 * Exit codes:
 *   0 — always-on sources are healthy, and SerpApi passes when configured
 *   1 — one or more required checks failed
 */

import { fetchRemoteOkJobs } from "../src/adapters/remoteok.js";
import { fetchHnJobs } from "../src/adapters/hackernews.js";
import { fetchSerpApiGoogleJobs } from "../src/adapters/serpapi-google-jobs.js";
import { emptyProfile } from "../src/models.js";
import {
  HN_WHO_IS_HIRING_ID,
  SERPAPI_API_KEY,
  SERPAPI_GOOGLE_JOBS_ENABLED,
} from "../src/config.js";

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const SKIP = "\x1b[33m-\x1b[0m";

async function run(): Promise<void> {
  console.log("=== CareerClaw Source Smoke Test ===\n");
  let allPassed = true;

  // ---- RemoteOK ----
  console.log("RemoteOK RSS …");
  try {
    const jobs = await fetchRemoteOkJobs();
    if (jobs.length === 0) {
      console.log(`  ${FAIL} Returned 0 jobs`);
      allPassed = false;
    } else {
      const first = jobs[0]!;
      console.log(`  ${PASS} Fetched ${jobs.length} jobs`);
      console.log(`  ${PASS} First job_id: ${first.job_id}`);
      console.log(`  ${PASS} First title:  "${first.title}" @ ${first.company}`);
    }
  } catch (err) {
    console.log(`  ${FAIL} Fetch error: ${String(err)}`);
    allPassed = false;
  }

  console.log();

  // ---- Hacker News ----
  console.log(`Hacker News "Who is Hiring?" (thread ${HN_WHO_IS_HIRING_ID}) …`);
  try {
    const jobs = await fetchHnJobs(HN_WHO_IS_HIRING_ID);
    if (jobs.length === 0) {
      console.log(`  ${FAIL} Returned 0 jobs — check HN_WHO_IS_HIRING_ID is current`);
      allPassed = false;
    } else {
      const first = jobs[0]!;
      console.log(`  ${PASS} Fetched ${jobs.length} jobs`);
      console.log(`  ${PASS} First job_id: ${first.job_id}`);
      console.log(`  ${PASS} First title:  "${first.title}" @ ${first.company}`);
    }
  } catch (err) {
    console.log(`  ${FAIL} Fetch error: ${String(err)}`);
    allPassed = false;
  }

  console.log();

  // ---- SerpApi Google Jobs (optional) ----
  console.log("SerpApi Google Jobs …");
  if (!SERPAPI_GOOGLE_JOBS_ENABLED) {
    console.log(`  ${SKIP} Skipped — CAREERCLAW_SERPAPI_GOOGLE_JOBS_ENABLED is false`);
  } else if (!SERPAPI_API_KEY) {
    console.log(`  ${SKIP} Skipped — CAREERCLAW_SERPAPI_API_KEY is not set`);
  } else {
    try {
      const jobs = await fetchSerpApiGoogleJobs({
        ...emptyProfile(),
        target_roles: ["Software Engineer"],
        work_mode: "remote",
      });
      if (jobs.length === 0) {
        console.log(`  ${FAIL} Returned 0 jobs`);
        allPassed = false;
      } else {
        const first = jobs[0]!;
        console.log(`  ${PASS} Fetched ${jobs.length} jobs`);
        console.log(`  ${PASS} First source: ${first.source}`);
        console.log(`  ${PASS} First title:  "${first.title}" @ ${first.company}`);
      }
    } catch (err) {
      console.log(`  ${FAIL} Fetch error: ${String(err)}`);
      allPassed = false;
    }
  }

  console.log();

  if (allPassed) {
    console.log(`${PASS} Source smoke checks passed\n`);
    process.exit(0);
  }

  console.log(`${FAIL} One or more source checks failed — see above\n`);
  process.exit(1);
}

run();
