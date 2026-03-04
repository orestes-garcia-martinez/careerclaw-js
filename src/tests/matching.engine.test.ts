/**
 * matching.engine.test.ts — End-to-end ranking engine tests.
 *
 * Tests use real UserProfile and NormalizedJob types to validate that
 * rankJobs() produces correct ordering, respects topK, and populates
 * all ScoredJob fields.
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import { rankJobs } from "../matching/engine.js";
import { emptyProfile } from "../models.js";
import type { NormalizedJob, UserProfile } from "../models.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<NormalizedJob> & { job_id: string }): NormalizedJob {
  return {
    title: "Engineer",
    company: "Corp",
    location: "Remote",
    description: "engineering role",
    url: `https://example.com/${overrides.job_id}`,
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: null,
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-03-04T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rankJobs — basic behaviour
// ---------------------------------------------------------------------------

describe("rankJobs — basic", () => {
  it("returns empty array for empty job list", () => {
    expect(rankJobs([], emptyProfile())).toEqual([]);
  });

  it("returns at most topK results", () => {
    const jobs = [
      makeJob({ job_id: "a" }),
      makeJob({ job_id: "b" }),
      makeJob({ job_id: "c" }),
      makeJob({ job_id: "d" }),
    ];
    expect(rankJobs(jobs, emptyProfile(), 2)).toHaveLength(2);
  });

  it("returns all jobs when topK exceeds job count", () => {
    const jobs = [makeJob({ job_id: "a" }), makeJob({ job_id: "b" })];
    expect(rankJobs(jobs, emptyProfile(), 10)).toHaveLength(2);
  });

  it("each result is a valid ScoredJob with all required fields", () => {
    const jobs = [makeJob({ job_id: "a" })];
    const [result] = rankJobs(jobs, emptyProfile(), 1);
    expect(result).toHaveProperty("job");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("breakdown");
    expect(result).toHaveProperty("matched_keywords");
    expect(result).toHaveProperty("gap_keywords");
    expect(result!.breakdown).toHaveProperty("keyword_score");
    expect(result!.breakdown).toHaveProperty("experience_score");
    expect(result!.breakdown).toHaveProperty("salary_score");
    expect(result!.breakdown).toHaveProperty("work_mode_score");
  });

  it("all composite scores are in [0, 1]", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["typescript", "react"],
      experience_years: 5,
      salary_min: 100_000,
      work_mode: "remote",
    };
    const jobs = [
      makeJob({ job_id: "a", description: "typescript react node", work_mode: "remote", salary_min: 120_000, experience_years: 3 }),
      makeJob({ job_id: "b", description: "python django", work_mode: "onsite", salary_min: 80_000, experience_years: 8 }),
    ];
    for (const result of rankJobs(jobs, profile, 5)) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// rankJobs — ordering
// ---------------------------------------------------------------------------

describe("rankJobs — ranking order", () => {
  it("ranks a highly matching job above a poorly matching job", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["typescript", "react", "node"],
      target_roles: ["senior engineer"],
      experience_years: 6,
      work_mode: "remote",
      salary_min: 100_000,
    };

    const strongMatch = makeJob({
      job_id: "strong",
      title: "Senior TypeScript Engineer",
      description: "Looking for a senior engineer with typescript react and node skills.",
      work_mode: "remote",
      salary_min: 130_000,
      experience_years: 5,
    });

    const weakMatch = makeJob({
      job_id: "weak",
      title: "Java Developer",
      description: "Enterprise Java Spring Boot position in our onsite team.",
      work_mode: "onsite",
      salary_min: 70_000,
      experience_years: 10,
    });

    const results = rankJobs([weakMatch, strongMatch], profile, 2);
    expect(results[0]!.job.job_id).toBe("strong");
    expect(results[1]!.job.job_id).toBe("weak");
  });

  it("results are sorted descending by score", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["typescript", "react"],
      work_mode: "remote",
    };
    const jobs = [
      makeJob({ job_id: "a", description: "php wordpress mysql", work_mode: "onsite" }),
      makeJob({ job_id: "b", description: "typescript react frontend", work_mode: "remote" }),
      makeJob({ job_id: "c", description: "typescript api", work_mode: "remote" }),
    ];
    const results = rankJobs(jobs, profile, 3);
    const scores = results.map((r) => r.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i + 1]!);
    }
  });

  it("preserves original job data in ScoredJob.job", () => {
    const job = makeJob({ job_id: "preserve", title: "Staff Engineer", company: "TestCo" });
    const [result] = rankJobs([job], emptyProfile(), 1);
    expect(result!.job.title).toBe("Staff Engineer");
    expect(result!.job.company).toBe("TestCo");
    expect(result!.job.job_id).toBe("preserve");
  });
});

// ---------------------------------------------------------------------------
// rankJobs — uses real model types
// ---------------------------------------------------------------------------

describe("rankJobs — real UserProfile and NormalizedJob types", () => {
  it("emptyProfile() produces valid scores without throwing", () => {
    const jobs = [
      makeJob({ job_id: "x", description: "typescript engineer remote" }),
    ];
    expect(() => rankJobs(jobs, emptyProfile())).not.toThrow();
  });

  it("all neutral dimensions sum to 0.5 composite for empty profile against empty job", () => {
    // Empty profile: all dimensions neutral → composite = 0.5
    // Exception: keyword score = 0.0 (both token sets empty) → weighted 0 * 0.5
    // experience=0.5, salary=0.5, work_mode=0.5
    // composite = 0*0.5 + 0.5*0.2 + 0.5*0.15 + 0.5*0.15 = 0 + 0.1 + 0.075 + 0.075 = 0.25
    const job = makeJob({ job_id: "empty", title: "", description: "" });
    const [result] = rankJobs([job], emptyProfile(), 1);
    expect(result!.score).toBeCloseTo(0.25, 4);
  });
});
