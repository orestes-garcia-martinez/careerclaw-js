/**
 * config.ts — Environment and source configuration for CareerClaw.
 *
 * All tuneable values live here.  Env-vars are read once at import time so
 * that callers can treat `config` as a plain object.  No third-party dotenv
 * library is required — Node 20+ reads .env automatically when launched with
 * --env-file, and the OpenClaw gateway passes secrets as real env vars.
 */

import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Runtime directory
// ---------------------------------------------------------------------------

/**
 * Root directory for all CareerClaw runtime state.
 * Mirrors Python's `.careerclaw/` convention.
 * Can be overridden via CAREERCLAW_DIR for testing.
 */
export const CAREERCLAW_DIR: string =
	process.env["CAREERCLAW_DIR"] ??
	join(process.env["HOME"] ?? homedir(), ".careerclaw");

export const PROFILE_PATH: string = join(CAREERCLAW_DIR, "profile.json");
export const TRACKING_PATH: string = join(CAREERCLAW_DIR, "tracking.json");
export const RUNS_PATH: string = join(CAREERCLAW_DIR, "runs.jsonl");
export const RESUME_TXT_PATH: string = join(CAREERCLAW_DIR, "resume.txt");
export const RESUME_PDF_PATH: string = join(CAREERCLAW_DIR, "resume.pdf");
export const LICENSE_CACHE_PATH: string = join(
	CAREERCLAW_DIR,
	".license_cache"
);

// ---------------------------------------------------------------------------
// HTTP client defaults
// ---------------------------------------------------------------------------

/** Milliseconds before an outbound HTTP request is aborted. */
export const HTTP_TIMEOUT_MS = 15_000;

/**
 * User-Agent sent with all outbound requests.
 * Identifies the tool and provides a contact point per robots.txt convention.
 */
export const USER_AGENT =
	"careerclaw-js/0.1.0 (https://github.com/orestes-garcia-martinez/careerclaw-js)";

// ---------------------------------------------------------------------------
// Job sources
// ---------------------------------------------------------------------------

/** RemoteOK RSS feed — public, no auth required. */
export const REMOTEOK_RSS_URL = "https://remoteok.com/remote-jobs.rss";

/**
 * Hacker News "Who is Hiring?" thread ID.
 *
 * HN posts a new thread on the first weekday of each month.  This value
 * must be updated manually each month.  The adapter degrades gracefully
 * (returns []) when the thread cannot be fetched.
 *
 * Override via env var HN_WHO_IS_HIRING_ID for one-off testing.
 *
 * To find the current thread ID: search HN for "Ask HN: Who is hiring?"
 * and copy the numeric ID from the URL (e.g. https://news.ycombinator.com/item?id=43354977).
 */
export const HN_WHO_IS_HIRING_ID: number = parseInt(
	process.env["HN_WHO_IS_HIRING_ID"] ?? "43354977",
	10
);

/** HN Firebase API base URL — public, no auth required. */
export const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

/** Maximum number of HN comment IDs to fetch per briefing run. */
export const HN_MAX_COMMENTS = 200;

// ---------------------------------------------------------------------------
// Briefing defaults
// ---------------------------------------------------------------------------

/** Default number of top matches to return. */
export const DEFAULT_TOP_K = 3;

// ---------------------------------------------------------------------------
// LLM (Pro tier)
// ---------------------------------------------------------------------------

/**
 * Anthropic API key for LLM draft enhancement.
 * Only read when the Pro tier is active.  Never written to disk.
 */
export const LLM_API_KEY: string | undefined = process.env["CAREERCLAW_LLM_KEY"];

/** LLM provider: "anthropic" | "openai". Defaults to "anthropic". */
export const LLM_PROVIDER: string =
	process.env["CAREERCLAW_LLM_PROVIDER"] ?? "anthropic";

/** Model to use for draft enhancement. */
export const LLM_MODEL: string =
	process.env["CAREERCLAW_LLM_MODEL"] ?? "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Licensing (Pro tier)
// ---------------------------------------------------------------------------

/** Polar.sh Pro license key. Never written to disk raw — only a hash is cached. */
export const PRO_KEY: string | undefined = process.env["CAREERCLAW_PRO_KEY"];

/**
 * Polar.sh product slug for license validation.
 * Purchase URL: https://polar.sh/orestes-garcia-martinez/careerclaw-pro
 */
export const POLAR_PRODUCT_SLUG =
	process.env["CAREERCLAW_POLAR_SLUG"] ?? "careerclaw-pro";

/** Polar.sh API base URL for license validation (Phase 7). */
export const POLAR_API_BASE = "https://api.polar.sh";