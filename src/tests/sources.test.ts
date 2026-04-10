/**
 * sources.test.ts — Unit tests for source aggregation and deduplication.
 *
 * Uses vi.mock() to stub both adapters so no network calls are made.
 * Run: npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deduplicate } from "../sources.js";
import { emptyProfile } from "../models.js";
import type { NormalizedJob, UserProfile } from "../models.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<NormalizedJob> & { job_id: string }): NormalizedJob {
  return {
    title: `Engineer ${overrides.job_id}`,
    company: `Acme ${overrides.job_id}`,
    location: "Remote",
    description: `A job ${overrides.job_id}.`,
    url: `https://example.com/${overrides.job_id}`,
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-03-03T10:00:00.000Z",
    ...overrides,
  };
}


function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...emptyProfile(),
    target_roles: ["Software Engineer"],
    work_mode: "remote",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deduplicate
// ---------------------------------------------------------------------------

describe("deduplicate", () => {
  it("passes through a list with no duplicates", () => {
    const jobs = [makeJob({ job_id: "aaa" }), makeJob({ job_id: "bbb" })];
    expect(deduplicate(jobs)).toHaveLength(2);
  });

  it("removes duplicate job_ids, first-seen wins", () => {
    const first = makeJob({ job_id: "aaa", title: "First" });
    const dupe = makeJob({ job_id: "aaa", title: "Duplicate" });
    const result = deduplicate([first, dupe]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("First");
  });

  it("returns empty array for empty input", () => {
    expect(deduplicate([])).toEqual([]);
  });

  it("preserves original order for unique jobs", () => {
    const jobs = [
      makeJob({ job_id: "c" }),
      makeJob({ job_id: "a" }),
      makeJob({ job_id: "b" }),
    ];
    expect(deduplicate(jobs).map((j) => j.job_id)).toEqual(["c", "a", "b"]);
  });

  it("handles multiple duplicates across sources", () => {
    const jobs = [
      makeJob({ job_id: "x", source: "remoteok" }),
      makeJob({ job_id: "y", source: "hackernews" }),
      makeJob({ job_id: "x", source: "hackernews" }), // duplicate of first
      makeJob({ job_id: "z", source: "remoteok" }),
    ];
    const result = deduplicate(jobs);
    expect(result).toHaveLength(3);
    expect(result.find((j) => j.job_id === "x")!.source).toBe("remoteok");
  });

  it("collapses syndicated duplicates with different urls when title, company, and description match", () => {
    const result = deduplicate([
      makeJob({
        job_id: "board-a",
        title: "Director, Marketing - Deposits",
        company: "Santander Holdings USA Inc",
        location: "Hialeah, FL",
        description: "Lead deposits product marketing, positioning, messaging, and GTM plans.",
        url: "https://jobs.womenforhire.com/santander-deposits",
        source: "serpapi_google_jobs",
      }),
      makeJob({
        job_id: "board-b",
        title: "Director, Marketing - Deposits",
        company: "Santander",
        location: "Miami, FL",
        description: "Lead deposits product marketing, positioning, messaging, and GTM plans.",
        url: "https://www.santandercareers.com/deposits-role",
        source: "serpapi_google_jobs",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.santandercareers.com/deposits-role");
  });
});

// ---------------------------------------------------------------------------
// fetchAllJobs — stubbed adapter tests
// ---------------------------------------------------------------------------

describe("fetchAllJobs — adapter stubs", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("merges results from both sources", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => [makeJob({ job_id: "r1", source: "remoteok" })],
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => [makeJob({ job_id: "h1", source: "hackernews" })],
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [],
    }));

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toHaveLength(2);
    expect(result.counts["remoteok"]).toBe(1);
    expect(result.counts["hackernews"]).toBe(1);
    expect(result.errors).toEqual({});
  });

  it("degrades gracefully when RemoteOK fails", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => { throw new Error("network error"); },
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => [makeJob({ job_id: "h1", source: "hackernews" })],
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [],
    }));

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toHaveLength(1);
    expect(result.counts["remoteok"]).toBe(0);
    expect(result.errors["remoteok"]).toContain("network error");
  });

  it("degrades gracefully when HN fails", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => [makeJob({ job_id: "r1", source: "remoteok" })],
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => { throw new Error("timeout"); },
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [],
    }));

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toHaveLength(1);
    expect(result.counts["hackernews"]).toBe(0);
    expect(result.errors["hackernews"]).toContain("timeout");
  });

  it("returns empty jobs and error entries when both sources fail", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => { throw new Error("rss down"); },
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => { throw new Error("firebase down"); },
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [],
    }));

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toEqual([]);
    expect(Object.keys(result.errors)).toHaveLength(2);
  });

  it("includes SerpApi Google Jobs results when the adapter returns jobs", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => [],
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => [],
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [makeJob({ job_id: "s1", source: "serpapi_google_jobs" })],
    }));
    vi.doMock("../config.js", async () => {
      const actual = await vi.importActual<typeof import("../config.js")>("../config.js");
      return {
        ...actual,
        SERPAPI_GOOGLE_JOBS_ENABLED: true,
        SERPAPI_API_KEY: "test-key",
      };
    });

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]!.source).toBe("serpapi_google_jobs");
    expect(result.counts["serpapi_google_jobs"]).toBe(1);
  });

  it("deduplicates cross-source duplicates", async () => {
    vi.doMock("../adapters/remoteok.js", () => ({
      fetchRemoteOkJobs: async () => [makeJob({ job_id: "shared", source: "remoteok" })],
    }));
    vi.doMock("../adapters/hackernews.js", () => ({
      fetchHnJobs: async () => [makeJob({ job_id: "shared", source: "hackernews" })],
    }));
    vi.doMock("../adapters/serpapi-google-jobs.js", () => ({
      fetchSerpApiGoogleJobs: async () => [],
    }));

    const { fetchAllJobs } = await import("../sources.js");
    const result = await fetchAllJobs(makeProfile());

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]!.source).toBe("remoteok"); // first-seen wins
  });
});
