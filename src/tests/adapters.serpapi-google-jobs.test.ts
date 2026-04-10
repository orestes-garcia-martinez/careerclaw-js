import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  buildSerpApiGoogleJobsRequest,
  fetchSerpApiGoogleJobs,
  mapSerpApiJobToNormalizedJob,
  SerpApiInvalidApiKeyError,
  SerpApiRateLimitError,
} from "../adapters/serpapi-google-jobs.js";
import { emptyProfile } from "../models.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/serpapi-google-jobs.json"), "utf8"),
) as { jobs_results: Array<Record<string, unknown>> };

describe("buildSerpApiGoogleJobsRequest", () => {
  it("builds a profile-aware remote query using ltype=1, not a geographic location", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Senior Frontend Engineer"],
      work_mode: "remote",
      location: "Florida",
    });

    expect(request.q).toBe("Senior Frontend Engineer");
    expect(request.ltype).toBe("1");
    expect(request.location).toBeUndefined();
  });

  it("passes geographic location and radiusKm for non-remote work mode", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Senior Frontend Engineer"],
      work_mode: "onsite",
      location: "Austin, TX",
    });

    expect(request.q).toBe("Senior Frontend Engineer Austin, TX");
    expect(request.location).toBe("Austin, TX");
    expect(request.ltype).toBeUndefined();
    expect(request.radiusKm).toBeGreaterThan(0);
  });

  it("caps radiusKm at the operator limit when profile requests more", () => {
    // SERPAPI_GOOGLE_JOBS_RADIUS_KM defaults to 50 in test env
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Nurse Practitioner"],
      work_mode: "onsite",
      location: "Miami, FL",
      location_radius_km: 9999,
    });

    // Should be capped at the operator default (161 km = ~100 miles), not 9999
    expect(request.radiusKm).toBeLessThanOrEqual(161);
  });

  it("uses profile radiusKm when within the operator cap", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Nurse Practitioner"],
      work_mode: "onsite",
      location: "Miami, FL",
      location_radius_km: 25,
    });

    expect(request.radiusKm).toBe(25);
  });

  it("does not set radiusKm for remote mode even when profile specifies one", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Senior Frontend Engineer"],
      work_mode: "remote",
      location_radius_km: 30,
    });

    expect(request.ltype).toBe("1");
    expect(request.radiusKm).toBeUndefined();
  });

  it("does not apply location or ltype for work_mode 'any' — broadest open search", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Software Engineer"],
      work_mode: "any",
      location: "Austin, TX",
    });

    expect(request.q).toBe("Software Engineer");
    expect(request.location).toBeUndefined();
    expect(request.ltype).toBeUndefined();
    expect(request.radiusKm).toBeUndefined();
  });

  it("does not apply location or ltype when work_mode is null", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Software Engineer"],
      work_mode: null,
      location: "Austin, TX",
    });

    expect(request.q).toBe("Software Engineer");
    expect(request.location).toBeUndefined();
    expect(request.ltype).toBeUndefined();
  });

  it("falls back to the resume summary when no target role exists", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      resume_summary: "Staff platform engineer focused on APIs and reliability.",
    });

    expect(request.q).toContain("Staff platform engineer focused on APIs and reliability");
  });

  it("includes a second distinct target role when the profile has a broader role set", () => {
    const request = buildSerpApiGoogleJobsRequest({
      ...emptyProfile(),
      target_roles: ["Director of Marketing", "Head of Product Marketing", "B2B Marketing Director"],
      target_industry: "fintech",
      work_mode: "onsite",
      location: "Florida",
    });

    expect(request.q).toContain("Director of Marketing");
    expect(request.q).toContain("Head of Product Marketing");
    expect(request.q).toContain("fintech");
    expect(request.q).toContain("Florida");
  });
});

describe("mapSerpApiJobToNormalizedJob", () => {
  it("maps the fixture into CareerClaw's NormalizedJob shape", () => {
    const mapped = mapSerpApiJobToNormalizedJob(FIXTURE.jobs_results[0] as never, {
      query: "Senior Frontend Engineer remote",
      fetchedAt: "2026-04-06T12:00:00.000Z",
    });

    expect(mapped.source).toBe("serpapi_google_jobs");
    expect(mapped.title).toBe("Senior Frontend Engineer");
    expect(mapped.company).toBe("Acme Corp");
    expect(mapped.url).toBe("https://www.linkedin.com/jobs/view/123456");
    expect(mapped.salary_min).toBe(170000);
    expect(mapped.salary_max).toBe(190000);
    expect(mapped.work_mode).toBe("remote");
    expect(mapped.experience_years).toBe(5);
    expect(mapped.posted_at).toBe("2026-04-03T12:00:00.000Z");
    expect(mapped.description).toContain("Qualifications:");
  });
});

describe("fetchSerpApiGoogleJobs", () => {
  it("returns mapped jobs from a successful SerpApi response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(FIXTURE),
    });

    const jobs = await fetchSerpApiGoogleJobs(
      {
        ...emptyProfile(),
        target_roles: ["Senior Frontend Engineer"],
        work_mode: "remote",
      },
      { apiKey: "test-key", fetchFn: fetchFn as unknown as typeof fetch },
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.source).toBe("serpapi_google_jobs");
  });

  it("throws a typed invalid-key error for HTTP 401", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({
        error: "Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key",
      }),
    });

    await expect(
      fetchSerpApiGoogleJobs(
        {
          ...emptyProfile(),
          target_roles: ["Software Engineer"],
        },
        { apiKey: "bad-key", fetchFn: fetchFn as unknown as typeof fetch },
      ),
    ).rejects.toBeInstanceOf(SerpApiInvalidApiKeyError);
  });

  it("throws a typed rate-limit error for HTTP 429", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: "Your account has run out of searches." }),
    });

    await expect(
      fetchSerpApiGoogleJobs(
        {
          ...emptyProfile(),
          target_roles: ["Software Engineer"],
        },
        { apiKey: "limited-key", fetchFn: fetchFn as unknown as typeof fetch },
      ),
    ).rejects.toBeInstanceOf(SerpApiRateLimitError);
  });

  it("returns page-1 jobs when a subsequent page errors, rather than failing the whole source", async () => {
    const page1 = {
      ...FIXTURE,
      serpapi_pagination: { next_page_token: "tok2" },
    };
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(page1) })
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => JSON.stringify({ error: "rate limit" }) });

    const jobs = await fetchSerpApiGoogleJobs(
      {
        ...emptyProfile(),
        target_roles: ["Software Engineer"],
        work_mode: "remote",
      },
      { apiKey: "test-key", maxPages: 2, fetchFn: fetchFn as unknown as typeof fetch },
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(1); // page 1 preserved
    expect(jobs[0]?.source).toBe("serpapi_google_jobs");
  });

  it("throws when the first page itself errors — no results to salvage", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: "rate limit" }),
    });

    await expect(
      fetchSerpApiGoogleJobs(
        { ...emptyProfile(), target_roles: ["Software Engineer"] },
        { apiKey: "test-key", fetchFn: fetchFn as unknown as typeof fetch },
      ),
    ).rejects.toBeInstanceOf(SerpApiRateLimitError);
  });
});
