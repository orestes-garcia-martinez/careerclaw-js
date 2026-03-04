/**
 * matching.scoring.test.ts — Unit tests for individual scoring functions.
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import {
  scoreKeyword,
  scoreExperience,
  scoreSalary,
  scoreWorkMode,
  compositeScore,
  WEIGHTS,
} from "../matching/scoring.js";
import type { NormalizedJob, UserProfile } from "../models.js";
import { emptyProfile } from "../models.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "test0000000000001",
    title: "Senior TypeScript Engineer",
    company: "Acme",
    location: "Remote",
    description: "We need a senior typescript engineer with react and node experience.",
    url: "https://example.com/job/1",
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-03-04T10:00:00.000Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...emptyProfile(),
    skills: ["typescript", "react", "node"],
    target_roles: ["engineer", "senior engineer"],
    experience_years: 6,
    work_mode: "remote",
    salary_min: 120_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WEIGHTS
// ---------------------------------------------------------------------------

describe("WEIGHTS", () => {
  it("sums to 1.0", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it("keyword has the highest weight", () => {
    expect(WEIGHTS.keyword).toBeGreaterThan(WEIGHTS.experience);
    expect(WEIGHTS.keyword).toBeGreaterThan(WEIGHTS.salary);
    expect(WEIGHTS.keyword).toBeGreaterThan(WEIGHTS.work_mode);
  });
});

// ---------------------------------------------------------------------------
// scoreKeyword
// ---------------------------------------------------------------------------

describe("scoreKeyword", () => {
  it("returns score > 0 when profile skills overlap with job description", () => {
    const { score } = scoreKeyword(makeProfile(), makeJob());
    expect(score).toBeGreaterThan(0);
  });

  it("returns matched keywords present in both profile and job", () => {
    const { matched } = scoreKeyword(makeProfile(), makeJob());
    expect(matched).toContain("typescript");
    expect(matched).toContain("react");
  });

  it("returns gap keywords present in job but not in profile", () => {
    const profile = makeProfile({ skills: ["python"], target_roles: [] });
    const { gaps } = scoreKeyword(profile, makeJob());
    expect(gaps).toContain("typescript");
  });

  it("returns 0.0 when profile has no skills or summary", () => {
    const profile = emptyProfile();
    const { score } = scoreKeyword(profile, makeJob());
    expect(score).toBe(0.0);
  });

  it("returns 0.0 when job has empty title and description", () => {
    const job = makeJob({ title: "", description: "" });
    const { score } = scoreKeyword(makeProfile(), job);
    expect(score).toBe(0.0);
  });

  it("score is in [0, 1]", () => {
    const { score } = scoreKeyword(makeProfile(), makeJob());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("includes resume_summary tokens in profile corpus", () => {
    const profile = makeProfile({
      skills: [],
      target_roles: [],
      resume_summary: "Experienced typescript and graphql developer",
    });
    const { matched } = scoreKeyword(profile, makeJob());
    expect(matched).toContain("typescript");
  });
});

// ---------------------------------------------------------------------------
// scoreExperience
// ---------------------------------------------------------------------------

describe("scoreExperience", () => {
  it("returns 0.5 (neutral) when job has no experience requirement", () => {
    expect(scoreExperience(makeProfile({ experience_years: 5 }), makeJob({ experience_years: null }))).toBe(0.5);
  });

  it("returns 0.5 (neutral) when user has no experience years", () => {
    expect(scoreExperience(makeProfile({ experience_years: null }), makeJob({ experience_years: 5 }))).toBe(0.5);
  });

  it("returns 1.0 when user meets or exceeds requirement exactly", () => {
    expect(scoreExperience(makeProfile({ experience_years: 5 }), makeJob({ experience_years: 5 }))).toBe(1.0);
  });

  it("clamps to 1.0 when user is over-qualified", () => {
    expect(scoreExperience(makeProfile({ experience_years: 10 }), makeJob({ experience_years: 3 }))).toBe(1.0);
  });

  it("returns proportional score when under-qualified", () => {
    // 3 / 6 = 0.5
    expect(scoreExperience(makeProfile({ experience_years: 3 }), makeJob({ experience_years: 6 }))).toBeCloseTo(0.5, 5);
  });

  it("returns 1.0 when job requires 0 years", () => {
    expect(scoreExperience(makeProfile({ experience_years: 0 }), makeJob({ experience_years: 0 }))).toBe(1.0);
  });

  it("score is in [0, 1]", () => {
    const score = scoreExperience(makeProfile({ experience_years: 1 }), makeJob({ experience_years: 10 }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// scoreSalary
// ---------------------------------------------------------------------------

describe("scoreSalary", () => {
  it("returns 0.5 (neutral) when job has no salary data", () => {
    expect(scoreSalary(makeProfile({ salary_min: 120_000 }), makeJob({ salary_min: null }))).toBe(0.5);
  });

  it("returns 0.5 (neutral) when user has no salary minimum", () => {
    expect(scoreSalary(makeProfile({ salary_min: null }), makeJob({ salary_min: 100_000 }))).toBe(0.5);
  });

  it("returns 1.0 when job salary meets user minimum exactly", () => {
    expect(scoreSalary(makeProfile({ salary_min: 120_000 }), makeJob({ salary_min: 120_000 }))).toBe(1.0);
  });

  it("returns 1.0 when job salary exceeds user minimum", () => {
    expect(scoreSalary(makeProfile({ salary_min: 100_000 }), makeJob({ salary_min: 150_000 }))).toBe(1.0);
  });

  it("returns proportional score when job pays less than user minimum", () => {
    // 90_000 / 120_000 = 0.75
    expect(scoreSalary(makeProfile({ salary_min: 120_000 }), makeJob({ salary_min: 90_000 }))).toBeCloseTo(0.75, 5);
  });

  it("returns 1.0 when user salary_min is 0", () => {
    expect(scoreSalary(makeProfile({ salary_min: 0 }), makeJob({ salary_min: 50_000 }))).toBe(1.0);
  });

  it("score is in [0, 1]", () => {
    const score = scoreSalary(makeProfile({ salary_min: 200_000 }), makeJob({ salary_min: 50_000 }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// scoreWorkMode
// ---------------------------------------------------------------------------

describe("scoreWorkMode", () => {
  it("returns 1.0 on exact match: remote ↔ remote", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "remote" }))).toBe(1.0);
  });

  it("returns 1.0 on exact match: onsite ↔ onsite", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "onsite" }), makeJob({ work_mode: "onsite" }))).toBe(1.0);
  });

  it("returns 1.0 on exact match: hybrid ↔ hybrid", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "hybrid" }), makeJob({ work_mode: "hybrid" }))).toBe(1.0);
  });

  it("returns 0.5 (neutral) when job has no work_mode", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: null }))).toBe(0.5);
  });

  it("returns 0.5 (neutral) when user has no work_mode preference", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: null }), makeJob({ work_mode: "remote" }))).toBe(0.5);
  });

  it("returns 0.5 when user prefers hybrid and job is remote", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "hybrid" }), makeJob({ work_mode: "remote" }))).toBe(0.5);
  });

  it("returns 0.5 when user prefers remote and job is hybrid", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "hybrid" }))).toBe(0.5);
  });

  it("returns 0.0 on hard mismatch: remote ↔ onsite", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "onsite" }))).toBe(0.0);
  });

  it("returns 0.0 on hard mismatch: onsite ↔ remote", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "onsite" }), makeJob({ work_mode: "remote" }))).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// compositeScore
// ---------------------------------------------------------------------------

describe("compositeScore", () => {
  it("returns 1.0 when all dimensions are perfect", () => {
    expect(compositeScore({ keyword: 1.0, experience: 1.0, salary: 1.0, work_mode: 1.0 })).toBeCloseTo(1.0, 10);
  });

  it("returns 0.0 when all dimensions are zero", () => {
    expect(compositeScore({ keyword: 0.0, experience: 0.0, salary: 0.0, work_mode: 0.0 })).toBe(0.0);
  });

  it("weights keyword at 50%", () => {
    const score = compositeScore({ keyword: 1.0, experience: 0.0, salary: 0.0, work_mode: 0.0 });
    expect(score).toBeCloseTo(0.5, 10);
  });

  it("neutral dimensions (0.5 each) produce 0.5 composite", () => {
    expect(compositeScore({ keyword: 0.5, experience: 0.5, salary: 0.5, work_mode: 0.5 })).toBeCloseTo(0.5, 10);
  });
});
