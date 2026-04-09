/**
 * adapters/serpapi-google-jobs.ts — SerpApi Google Jobs aggregator adapter.
 *
 * Purpose:
 *   - Expand CareerClaw coverage without maintaining dozens of custom scrapers.
 *   - Query Google Jobs via SerpApi and map results into CareerClaw's
 *     NormalizedJob shape.
 *
 * Design notes:
 *   - Opt-in via CAREERCLAW_SERPAPI_API_KEY (and optional enabled flag).
 *   - Profile-aware query generation so the source is relevant to the user.
 *   - Fail-soft by throwing typed, descriptive errors that the source
 *     orchestration layer can capture without breaking the full briefing.
 */

import type { NormalizedJob, UserProfile, WorkMode, SearchOverrides } from "../models.js";
import { utcNow } from "../models.js";
import {
  HTTP_TIMEOUT_MS,
  SERPAPI_API_BASE,
  SERPAPI_API_KEY,
  SERPAPI_GOOGLE_JOBS_GL,
  SERPAPI_GOOGLE_JOBS_HL,
  SERPAPI_GOOGLE_JOBS_MAX_PAGES,
  SERPAPI_GOOGLE_JOBS_NO_CACHE,
  SERPAPI_GOOGLE_JOBS_RADIUS_KM,
  USER_AGENT,
} from "../config.js";
import { stableId } from "./remoteok.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SerpApiGoogleJobsFetchOptions {
  apiKey?: string;
  maxPages?: number;
  noCache?: boolean;
  fetchFn?: typeof fetch;
  /** Runtime search overrides — take precedence over profile fields for this run. */
  overrides?: SearchOverrides;
}

export interface SerpApiGoogleJobsRequest {
  q: string;
  location?: string;
  /** SerpApi remote-job filter. Pass "1" to activate Google's native remote filter. */
  ltype?: string;
  /**
   * Effective search radius in km, already capped at the operator limit.
   * Only set when `location` is also present.
   */
  radiusKm?: number;
  nextPageToken?: string;
}

interface SerpApiSearchMetadata {
  status?: string;
}

interface SerpApiPagination {
  next_page_token?: string;
}

interface SerpApiDetectedExtensions {
  posted_at?: string;
  schedule_type?: string;
}

interface SerpApiJobHighlight {
  title?: string;
  items?: string[];
}

interface SerpApiApplyOption {
  title?: string;
  link?: string;
}

interface SerpApiJobResult {
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  share_link?: string;
  description?: string;
  extensions?: string[];
  detected_extensions?: SerpApiDetectedExtensions;
  job_highlights?: SerpApiJobHighlight[];
  apply_options?: SerpApiApplyOption[];
  job_id?: string;
}

interface SerpApiGoogleJobsResponse {
  search_metadata?: SerpApiSearchMetadata;
  serpapi_pagination?: SerpApiPagination;
  jobs_results?: SerpApiJobResult[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

class SerpApiGoogleJobsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "SerpApiGoogleJobsError";
  }
}

export class SerpApiInvalidApiKeyError extends SerpApiGoogleJobsError {
  constructor(message = "SerpApi rejected the API key (HTTP 401).") {
    super(message, "invalid_api_key", 401);
    this.name = "SerpApiInvalidApiKeyError";
  }
}

export class SerpApiRateLimitError extends SerpApiGoogleJobsError {
  constructor(message = "SerpApi rate limit exceeded or account has no searches remaining (HTTP 429).") {
    super(message, "rate_limit", 429);
    this.name = "SerpApiRateLimitError";
  }
}

export class SerpApiConfigurationError extends SerpApiGoogleJobsError {
  constructor(message: string) {
    super(message, "configuration_error", null);
    this.name = "SerpApiConfigurationError";
  }
}

export class SerpApiRequestError extends SerpApiGoogleJobsError {
  constructor(message: string, status: number | null = null) {
    super(message, "request_error", status);
    this.name = "SerpApiRequestError";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchSerpApiGoogleJobs(
  profile: UserProfile,
  options: SerpApiGoogleJobsFetchOptions = {},
): Promise<NormalizedJob[]> {
  const apiKey = (options.apiKey ?? SERPAPI_API_KEY)?.trim();
  if (!apiKey) {
    throw new SerpApiConfigurationError(
      "SerpApi Google Jobs is enabled but CAREERCLAW_SERPAPI_API_KEY is not set.",
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const maxPages = clampMaxPages(options.maxPages ?? SERPAPI_GOOGLE_JOBS_MAX_PAGES);
  const noCache = options.noCache ?? SERPAPI_GOOGLE_JOBS_NO_CACHE;
  const request = buildSerpApiGoogleJobsRequest(profile, options.overrides);
  const fetchedAt = utcNow();

  const allJobs: NormalizedJob[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    try {
      const response = await searchGoogleJobs(
        {
          ...request,
          ...(nextPageToken ? { nextPageToken } : {}),
        },
        {
          apiKey,
          fetchFn,
          noCache,
        },
      );

      const jobs = (response.jobs_results ?? []).map((job) =>
        mapSerpApiJobToNormalizedJob(job, {
          query: request.q,
          fetchedAt,
        }),
      );

      allJobs.push(...jobs);

      nextPageToken = response.serpapi_pagination?.next_page_token;
      if (!nextPageToken) break;
    } catch (err) {
      if (page === 0) throw err; // no results yet — surface the error
      break; // keep jobs from earlier pages, stop pagination
    }
  }

  return allJobs;
}

export function buildSerpApiGoogleJobsRequest(
  profile: UserProfile,
  overrides?: SearchOverrides,
): SerpApiGoogleJobsRequest {
  const primaryRole = firstNonEmpty(profile.target_roles) ?? inferFallbackRole(profile);
  const isRemote = profile.work_mode === "remote";
  // Only apply geographic filters for explicitly location-based modes.
  // "any" and null are intentionally open — no location constraint applied.
  const isLocationBased = profile.work_mode === "onsite" || profile.work_mode === "hybrid";

  // For remote mode use ltype=1 (Google's native remote filter) — don't append
  // the word "remote" to q or pass a geographic location.
  // For onsite/hybrid, include the location in q and as the location param.
  // For "any"/null, query on role alone — broadest possible result set.
  const queryParts = [primaryRole];

  // Industry: overrides take precedence over profile.target_industry, but only
  // when they carry a non-empty value after trimming. An empty-string override
  // (e.g. from form serialisation) must not suppress a populated profile field.
  // Future: target_companies and target_skills from overrides will be wired here.
  const industry =
    overrides?.target_industry?.trim() || profile.target_industry?.trim() || null;
  if (industry) {
    queryParts.push(industry);
  }

  if (isLocationBased && profile.location) {
    queryParts.push(profile.location.trim());
  }

  const q = queryParts.join(" ").trim();
  if (!q) {
    throw new SerpApiConfigurationError(
      "Unable to build a SerpApi query from the current profile. Add a target role or resume summary.",
    );
  }

  const geoLocation = isLocationBased && profile.location ? profile.location.trim() : undefined;

  return {
    q,
    ...(isRemote ? { ltype: "1" } : {}),
    ...(geoLocation
      ? { location: geoLocation, radiusKm: resolveRadiusKm(profile.location_radius_km) }
      : {}),
  };
}

export function mapSerpApiJobToNormalizedJob(
  job: SerpApiJobResult,
  context: { query: string; fetchedAt: string },
): NormalizedJob {
  const title = cleanText(job.title);
  const company = cleanText(job.company_name);
  const location = cleanText(job.location);
  const description = buildDescription(job);
  const url = pickCanonicalUrl(job);
  const salarySource = [
    description,
    ...(job.extensions ?? []),
    ...flattenHighlights(job.job_highlights),
  ].join("\n");
  const { salary_min, salary_max } = parseSalaryRange(salarySource);

  return {
    job_id: buildStableSerpApiJobId(job, context.query),
    title: title || "Unknown title",
    company: company || "Unknown company",
    location,
    description,
    url,
    source: "serpapi_google_jobs",
    salary_min,
    salary_max,
    work_mode: inferWorkMode(job, description, location),
    experience_years: inferExperienceYears(description),
    posted_at: parsePostedAt(job.detected_extensions?.posted_at, context.fetchedAt),
    fetched_at: context.fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// HTTP / request handling
// ---------------------------------------------------------------------------

async function searchGoogleJobs(
  request: SerpApiGoogleJobsRequest,
  options: {
    apiKey: string;
    fetchFn: typeof fetch;
    noCache: boolean;
  },
): Promise<SerpApiGoogleJobsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const url = new URL(SERPAPI_API_BASE);
    url.searchParams.set("engine", "google_jobs");
    url.searchParams.set("api_key", options.apiKey);
    url.searchParams.set("q", request.q);
    url.searchParams.set("output", "json");
    url.searchParams.set("google_domain", "google.com");
    url.searchParams.set("gl", SERPAPI_GOOGLE_JOBS_GL);
    url.searchParams.set("hl", SERPAPI_GOOGLE_JOBS_HL);
    url.searchParams.set("no_cache", options.noCache ? "true" : "false");

    if (request.ltype) {
      url.searchParams.set("ltype", request.ltype);
    }
    if (request.location) {
      url.searchParams.set("location", request.location);
    }
    if (request.nextPageToken) {
      url.searchParams.set("next_page_token", request.nextPageToken);
    }
    if (request.radiusKm && request.radiusKm > 0) {
      url.searchParams.set("lrad", String(request.radiusKm));
    }

    const res = await options.fetchFn(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    const bodyText = await res.text();
    const body = tryParseJson(bodyText) as SerpApiGoogleJobsResponse | null;
    const errorMessage = body?.error?.trim();

    if (res.status === 401) {
      throw new SerpApiInvalidApiKeyError(
        errorMessage || "Invalid SerpApi API key. Check CAREERCLAW_SERPAPI_API_KEY.",
      );
    }

    if (res.status === 429) {
      throw new SerpApiRateLimitError(
        errorMessage ||
          "SerpApi hourly throughput limit exceeded or account has no searches remaining.",
      );
    }

    if (!res.ok) {
      throw new SerpApiRequestError(
        errorMessage || `SerpApi Google Jobs returned HTTP ${res.status}.`,
        res.status,
      );
    }

    if (!body) {
      throw new SerpApiRequestError("SerpApi returned a non-JSON response.", res.status);
    }

    if (body.search_metadata?.status === "Error" || body.error) {
      throw new SerpApiRequestError(
        body.error || "SerpApi reported an error status for Google Jobs.",
        res.status,
      );
    }

    return body;
  } catch (error) {
    if (error instanceof SerpApiGoogleJobsError) throw error;
    if (isAbortError(error)) {
      throw new SerpApiRequestError(
        `SerpApi Google Jobs request timed out after ${HTTP_TIMEOUT_MS}ms.`,
      );
    }
    throw new SerpApiRequestError(
      `SerpApi Google Jobs request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function buildStableSerpApiJobId(job: SerpApiJobResult, query: string): string {
  if (job.job_id) return stableId(`serpapi-job:${job.job_id}`);
  const canonical = pickCanonicalUrl(job);
  if (canonical) return stableId(`serpapi-url:${canonical}`);
  return stableId(
    `serpapi-fallback:${query}:${cleanText(job.company_name)}:${cleanText(job.title)}:${cleanText(job.location)}`,
  );
}

function pickCanonicalUrl(job: SerpApiJobResult): string {
  const primaryApplyUrl = firstNonEmpty((job.apply_options ?? []).map((option) => option.link));
  return primaryApplyUrl ?? cleanText(job.share_link);
}

function buildDescription(job: SerpApiJobResult): string {
  const parts: string[] = [];

  const description = cleanText(job.description);
  if (description) parts.push(description);

  const highlights = flattenHighlights(job.job_highlights);
  if (highlights.length > 0) {
    parts.push(highlights.join("\n"));
  }

  const via = cleanText(job.via);
  if (via) {
    parts.push(`Source platform: ${via}`);
  }

  return parts.join("\n\n").trim();
}

function flattenHighlights(highlights: SerpApiJobHighlight[] | undefined): string[] {
  if (!highlights) return [];
  const result: string[] = [];

  for (const section of highlights) {
    const title = cleanText(section.title);
    const items = (section.items ?? []).map(cleanText).filter(Boolean);
    if (!title && items.length === 0) continue;

    if (title && items.length > 0) {
      result.push(`${title}: ${items.join("; ")}`);
      continue;
    }

    if (title) {
      result.push(title);
      continue;
    }

    result.push(...items);
  }

  return result;
}

function parseSalaryRange(text: string): { salary_min: number | null; salary_max: number | null } {
  if (!text) return { salary_min: null, salary_max: null };

  const annualRange = text.match(/\$\s*([\d,]+)\s*(k|K)?\s*[-–to]+\s*\$\s*([\d,]+)\s*(k|K)?/);
  if (annualRange) {
    return {
      salary_min: parseSalaryNumber(annualRange[1] ?? "", Boolean(annualRange[2])),
      salary_max: parseSalaryNumber(annualRange[3] ?? "", Boolean(annualRange[4])),
    };
  }

  const annualSingle = text.match(/\$\s*([\d,]+)\s*(k|K)\b/);
  if (annualSingle) {
    return {
      salary_min: parseSalaryNumber(annualSingle[1] ?? "", true),
      salary_max: null,
    };
  }

  const annualCommaRange = text.match(/\$\s*([\d]{2,3},[\d]{3})\s*[-–to]+\s*\$\s*([\d]{2,3},[\d]{3})/);
  if (annualCommaRange) {
    return {
      salary_min: parseSalaryNumber(annualCommaRange[1] ?? "", false),
      salary_max: parseSalaryNumber(annualCommaRange[2] ?? "", false),
    };
  }

  return { salary_min: null, salary_max: null };
}

function parseSalaryNumber(raw: string, isThousands: boolean): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(value)) return null;
  return isThousands ? value * 1_000 : value;
}

function inferWorkMode(job: SerpApiJobResult, description: string, location: string): WorkMode | null {
  const combined = [
    cleanText(job.title),
    location,
    description,
    ...(job.extensions ?? []),
    cleanText(job.detected_extensions?.schedule_type),
  ]
    .join(" ")
    .toLowerCase();

  if (/\bhybrid\b/.test(combined)) return "hybrid";
  if (/\bremote\b|work from home|wfh/.test(combined)) return "remote";
  if (/\bon-?site\b|\bin-?office\b|on site/.test(combined)) return "onsite";
  return null;
}

function inferExperienceYears(text: string): number | null {
  const match = text.match(/(\d+)\+?\s*(?:or more\s+)?years?\s+(?:of\s+)?experience/i);
  if (!match?.[1]) return null;
  return Number.parseInt(match[1], 10);
}

function parsePostedAt(value: string | undefined, fallbackNowIso: string): string | null {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return null;

  if (raw === "today" || raw === "just posted") {
    return fallbackNowIso;
  }

  if (raw === "yesterday") {
    const date = new Date(fallbackNowIso);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString();
  }

  const relative = raw.match(/(\d+)\+?\s+(hour|hours|day|days|week|weeks|month|months)\s+ago/);
  if (relative?.[1] && relative[2]) {
    const amount = Number.parseInt(relative[1], 10);
    if (Number.isFinite(amount)) {
      const date = new Date(fallbackNowIso);
      switch (relative[2]) {
        case "hour":
        case "hours":
          date.setUTCHours(date.getUTCHours() - amount);
          return date.toISOString();
        case "day":
        case "days":
          date.setUTCDate(date.getUTCDate() - amount);
          return date.toISOString();
        case "week":
        case "weeks":
          date.setUTCDate(date.getUTCDate() - amount * 7);
          return date.toISOString();
        case "month":
        case "months":
          date.setUTCMonth(date.getUTCMonth() - amount);
          return date.toISOString();
      }
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function inferFallbackRole(profile: UserProfile): string {
  const summary = cleanText(profile.resume_summary);
  if (summary) {
    const firstSentence = summary.split(/[.!?]/)[0]?.trim();
    if (firstSentence) return firstSentence;
  }

  const primarySkill = firstNonEmpty(profile.skills);
  if (primarySkill) return `${primarySkill} engineer`;

  return "software engineer";
}

function clampMaxPages(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.trunc(value), 5);
}

/**
 * Resolve the effective search radius in km.
 *
 * `SERPAPI_GOOGLE_JOBS_RADIUS_KM` is the operator-level hard cap — the profile
 * value is used when present, but never exceeds the cap. When the profile does
 * not specify a radius, the cap is used as the default. When the cap is 0,
 * no radius filter is applied.
 */
function resolveRadiusKm(profileRadiusKm: number | null | undefined): number {
  const cap = SERPAPI_GOOGLE_JOBS_RADIUS_KM;
  if (cap <= 0) return 0;
  const requested = profileRadiusKm != null && Number.isFinite(profileRadiusKm) && profileRadiusKm > 0
    ? profileRadiusKm
    : cap;
  return Math.min(Math.trunc(requested), cap);
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstNonEmpty(values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const normalized = cleanText(value);
    if (normalized) return normalized;
  }
  return null;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError";
}
