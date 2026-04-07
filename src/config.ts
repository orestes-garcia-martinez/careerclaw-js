/**
 * config.ts — Environment and source configuration for CareerClaw.
 *
 * All tuneable values live here.  Env-vars are read once at import time so
 * that callers can treat `config` as a plain object.  No third-party dotenv
 * library is required — Node 20+ reads .env automatically when launched with
 * --env-file, and the OpenClaw gateway passes secrets as real env vars.
 */

import { join } from "node:path";

// ---------------------------------------------------------------------------
// Runtime directory
// ---------------------------------------------------------------------------

/**
 * Root directory for all CareerClaw runtime state.
 * Mirrors Python's `.careerclaw/` convention.
 * Can be overridden via CAREERCLAW_DIR for testing.
 */
const envCareerClawDir = process.env["CAREERCLAW_DIR"]?.trim();

export const CAREERCLAW_DIR: string =
	envCareerClawDir && envCareerClawDir.length > 0
		? envCareerClawDir
		: join(process.cwd(), ".careerclaw");

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
	"careerclaw-js/1.10.0 (https://github.com/orestes-garcia-martinez/careerclaw-js)";

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
	process.env["HN_WHO_IS_HIRING_ID"] ?? "47601859",
	10
);

/** HN Firebase API base URL — public, no auth required. */
export const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

/** Maximum number of HN comment IDs to fetch per briefing run. */
export const HN_MAX_COMMENTS = 200;

/** SerpApi Search API base URL. */
export const SERPAPI_API_BASE = "https://serpapi.com/search.json";

/** SerpApi private key for the Google Jobs aggregator. */
export const SERPAPI_API_KEY: string | undefined =
	process.env["CAREERCLAW_SERPAPI_API_KEY"]?.trim();

/**
 * Enables the SerpApi Google Jobs aggregator.
 *
 * Defaults to enabled when an API key is present, otherwise disabled.
 */
export const SERPAPI_GOOGLE_JOBS_ENABLED: boolean =
	(process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_ENABLED"] ??
		(SERPAPI_API_KEY ? "true" : "false")) !== "false";

/** Maximum number of SerpApi Google Jobs pages to fetch per briefing run. */
export const SERPAPI_GOOGLE_JOBS_MAX_PAGES: number = parseInt(
	process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_MAX_PAGES"] ?? "1",
	10
);

/** Allow SerpApi cached responses (cached searches are free for 1 hour). */
export const SERPAPI_GOOGLE_JOBS_NO_CACHE: boolean =
	(process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_NO_CACHE"] ?? "false") === "true";

/** Localization defaults for SerpApi Google Jobs searches. */
export const SERPAPI_GOOGLE_JOBS_GL: string =
	process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_GL"] ?? "us";

export const SERPAPI_GOOGLE_JOBS_HL: string =
	process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_HL"] ?? "en";

/**
 * Hard cap on the location search radius in kilometres.
 *
 * Acts as an operator-level ceiling: the effective radius is
 * `min(profile.location_radius_km, cap)`. When the profile does not specify
 * a radius, the cap is used as the default.
 *
 * Defaults to 161 km (~100 miles) — the natural upper bound for US commute
 * searches. Set to 0 to disable radius filtering entirely.
 *
 * Note: ClawOS stores and displays this value in miles in the UI; the worker
 * adapter converts miles → km (× 1.60934) before populating
 * `UserProfile.location_radius_km`.
 */
export const SERPAPI_GOOGLE_JOBS_RADIUS_KM: number = parseInt(
	process.env["CAREERCLAW_SERPAPI_GOOGLE_JOBS_RADIUS_KM"] ?? "161",
	10
);

// ---------------------------------------------------------------------------
// Briefing defaults
// ---------------------------------------------------------------------------

/** Default number of top matches to return (matches free tier cap). */
export const DEFAULT_TOP_K = 3;

/** Maximum topK for free tier users. */
export const FREE_TOP_K = 3;

/** Maximum topK for Pro tier users. */
export const PRO_TOP_K = 10;

// ---------------------------------------------------------------------------
// Semantic matching
// ---------------------------------------------------------------------------

export const SEMANTIC_MATCHING = {
	ENABLED: (process.env["CAREERCLAW_SEMANTIC_MATCHING"] ?? "true") !== "false",

	/**
	 * Blend of the enhanced lexical score and the taxonomy-based semantic score
	 * within the hybrid signal input.
	 *
	 *   signalInput = lexical × LEXICAL + semantic × SEMANTIC
	 *
	 * Increase SEMANTIC if taxonomy coverage is broad and you trust concept
	 * resolution; decrease it if the taxonomy is thin and lexical overlap is
	 * the more reliable signal.
	 */
	WEIGHTS: {
		LEXICAL: 0.55,
		SEMANTIC: 0.45,
	},

	/**
	 * Blend of taxonomy concept matches vs. verbatim phrase matches within
	 * the semantic score itself.
	 *
	 *   semanticScore = conceptScore × CONCEPT + phraseScore × PHRASE
	 *
	 * Concepts (taxonomy alias resolution) are high-precision but
	 * taxonomy-bounded — they only fire when both sides resolve to the same
	 * canonical key. Phrases (verbatim multi-gram matches) are the fallback
	 * for niche industry terms the taxonomy does not yet cover.
	 *
	 * Current 80/20 default is conservative: it favours the reliable concept
	 * signal while the taxonomy is still in Phase 1 (healthcare, finance,
	 * tech, trades). As taxonomy coverage grows thinner for niche domains,
	 * shifting toward 60/40 is a reasonable next step — validate against
	 * real match outcomes before changing.
	 */
	CONCEPT_PHRASE_WEIGHTS: {
		CONCEPT: 0.8,
		PHRASE: 0.2,
	},
} as const;

// ---------------------------------------------------------------------------
// LLM (Pro tier)
// ---------------------------------------------------------------------------

/**
 * Provider-specific LLM keys for draft enhancement (recommended).
 * These take precedence over the legacy CAREERCLAW_LLM_KEY.
 * Never written to disk or logged.
 */
export const LLM_ANTHROPIC_KEY: string | undefined =
	process.env["CAREERCLAW_ANTHROPIC_KEY"];

export const LLM_OPENAI_KEY: string | undefined =
	process.env["CAREERCLAW_OPENAI_KEY"];

/**
 * Legacy single-key override. Used when the provider-specific key above
 * is absent. Not recommended for mixed failover chains.
 */
export const LLM_API_KEY: string | undefined = process.env["CAREERCLAW_LLM_KEY"];

/** LLM provider: "anthropic" | "openai". Defaults to "anthropic". */
export const LLM_PROVIDER: string =
	process.env["CAREERCLAW_LLM_PROVIDER"] ?? "anthropic";

/** Model to use for draft enhancement. Default: fast, low-cost Haiku. */
export const LLM_MODEL: string =
	process.env["CAREERCLAW_LLM_MODEL"] ?? "claude-haiku-4-5-20251001";

/**
 * Comma-separated provider/model failover chain.
 * Tried left to right on failure.
 */
export const LLM_CHAIN: string =
	process.env["CAREERCLAW_LLM_CHAIN"] ??
	"anthropic/claude-haiku-4-5-20251001,openai/gpt-4o-mini";

/** Max retries per chain candidate before trying the next. */
export const LLM_MAX_RETRIES: number = parseInt(
	process.env["CAREERCLAW_LLM_MAX_RETRIES"] ?? "2",
	10
);

/** Consecutive failures before the circuit breaker opens. */
export const LLM_CIRCUIT_BREAKER_FAILS: number = parseInt(
	process.env["CAREERCLAW_LLM_CIRCUIT_BREAKER_FAILS"] ?? "2",
	10
);

// ---------------------------------------------------------------------------
// Licensing (Pro tier)
// ---------------------------------------------------------------------------

/** CareerClaw Pro license key. Never written to disk raw — only a SHA-256 hash is cached. */
export const PRO_KEY: string | undefined = process.env["CAREERCLAW_PRO_KEY"];

// ---------------------------------------------------------------------------
// Gumroad license validation (active payment processor)
// ---------------------------------------------------------------------------

/**
 * Gumroad product ID for license key verification.
 *
 * Internal constant — not configurable via environment variables.
 */
export const GUMROAD_PRODUCT_ID = "RFgXMtGajXKJfDvpZOXtfA==";

/** Gumroad license verification API base URL. */
export const GUMROAD_API_BASE = "https://api.gumroad.com";

/**
 * How long a cached license validation remains valid without re-checking
 * the Gumroad API. After this window the cache is stale and a live API
 * call is required.
 */
export const LICENSE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Polar.sh (future migration — not yet active)
// TODO: Phase 11-Polar — swap GUMROAD_* for POLAR_* once Polar is configured
// ---------------------------------------------------------------------------

/** @deprecated Polar is not yet the active processor. Use GUMROAD_* constants. */
export const POLAR_PRODUCT_SLUG =
	process.env["CAREERCLAW_POLAR_SLUG"] ?? "careerclaw-pro";

/** @deprecated Polar is not yet the active processor. Use GUMROAD_API_BASE. */
export const POLAR_API_BASE = "https://api.polar.sh";