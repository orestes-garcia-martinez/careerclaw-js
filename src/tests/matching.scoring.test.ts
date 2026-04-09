/**
 * matching.scoring.test.ts — Unit tests for the multiplicative scoring model.
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import { compositeScore, compositeScoreHybrid, scoreKeyword, scoreKeywordEnhanced, scoreExperience, scoreSalary, scoreWorkMode } from "../matching/scoring.js";
import { emptyProfile } from "../models.js";
import type { UserProfile, NormalizedJob } from "../models.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...emptyProfile(),
    skills: ["typescript", "node"],
    target_roles: ["software engineer"],
    experience_years: 5,
    salary_min: 100000,
    work_mode: "remote",
    ...overrides,
  };
}

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "j1",
    title: "Senior Software Engineer",
    company: "Tech Co",
    location: "Remote",
    description: "Expert in typescript and node.",
    url: "https://example.com/job/1",
    source: "remoteok",
    salary_min: 100000,
    salary_max: null,
    work_mode: "remote",
    experience_years: 5,
    posted_at: null,
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// compositeScore — multiplicative model
// ---------------------------------------------------------------------------

describe("compositeScore — multiplicative model", () => {
  it("returns 0.0 when keyword overlap is zero (the Dentist test)", () => {
    // A job with perfect metadata match but zero keyword overlap
    const { total, breakdown } = compositeScore(
      makeProfile(),
      makeJob({
        title: "Dentist",
        description: "Looking for a qualified dentist in New York.",
        work_mode: "remote",     // exact match
        salary_min: 150000,      // exceeds minimum
        experience_years: 5,     // exact match
      })
    );
    expect(breakdown.keyword).toBe(0);
    expect(breakdown.work_mode).toBe(1);
    expect(total).toBe(0.0);
  });

  it("returns 1.0 when all dimensions score perfectly", () => {
    // Profile tokens: [typescript, node, software, engineer]
    // Job corpus exactly covers those tokens → keyword = 1.0
    // All metadata perfect → qualityBase = 1.0
    // total = sqrt(1.0) × 1.0 = 1.0
    const { total } = compositeScore(
      makeProfile(),
      makeJob({
        title: "software engineer",
        description: "typescript node",
        work_mode: "remote",
        salary_min: 100000,
        experience_years: 5,
      })
    );
    expect(total).toBe(1.0);
  });

  it("partial keyword match is boosted by sqrt — score > raw overlap", () => {
    const { total, breakdown } = compositeScore(
      makeProfile(),
      makeJob({ title: "Engineer", description: "some tech stuff" })
    );
    // sqrt softens the penalty: total > breakdown.keyword when quality is 1.0
    expect(total).toBeGreaterThan(breakdown.keyword);
  });

  it("all-neutral metadata with full keyword match scores 0.5", () => {
    // Profile tokens: [typescript, node, software, engineer]
    // Job title+desc exactly covers those tokens → keyword = 1.0
    // All metadata neutral (null) → qualityBase = 0.5*0.4 + 0.5*0.3 + 0.5*0.3 = 0.5
    // total = sqrt(1.0) × 0.5 = 0.5
    const { total } = compositeScore(
      makeProfile(),
      makeJob({
        title: "software engineer",
        description: "typescript node",
        work_mode: null,
        salary_min: null,
        experience_years: null,
      })
    );
    expect(total).toBe(0.5);
  });

  it("result shape has total, breakdown, matched, gaps", () => {
    const result = compositeScore(makeProfile(), makeJob());
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("breakdown");
    expect(result).toHaveProperty("matched");
    expect(result).toHaveProperty("gaps");
  });

  it("breakdown contains keyword, experience, salary, work_mode", () => {
    const { breakdown } = compositeScore(makeProfile(), makeJob());
    expect(breakdown).toHaveProperty("keyword");
    expect(breakdown).toHaveProperty("experience");
    expect(breakdown).toHaveProperty("salary");
    expect(breakdown).toHaveProperty("work_mode");
  });

  it("total is rounded to 4 decimal places", () => {
    const { total } = compositeScore(makeProfile(), makeJob({
      title: "Engineer",
      description: "typescript node aws kubernetes"
    }));
    expect(total).toBe(parseFloat(total.toFixed(4)));
  });
});

// ---------------------------------------------------------------------------
// scoreKeyword
// ---------------------------------------------------------------------------

describe("scoreKeyword", () => {
  it("returns 0.0 for zero overlap", () => {
    const { score } = scoreKeyword(makeProfile(), makeJob({ title: "Dentist", description: "dental care" }));
    expect(score).toBe(0.0);
  });

  it("returns matched tokens that are in both profile and job", () => {
    const { matched } = scoreKeyword(makeProfile(), makeJob());
    expect(matched).toContain("typescript");
    expect(matched).toContain("node");
  });

  it("returns gap tokens that are in job but not profile", () => {
    const { gaps } = scoreKeyword(makeProfile(), makeJob({ description: "typescript node golang" }));
    expect(gaps).toContain("golang");
    expect(gaps).not.toContain("typescript");
  });

  it("returns 0.0 when profile has no skills or summary", () => {
    const { score } = scoreKeyword(emptyProfile(), makeJob());
    expect(score).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// scoreExperience
// ---------------------------------------------------------------------------

describe("scoreExperience", () => {
  it("returns 0.5 when job has no experience requirement", () => {
    expect(scoreExperience(makeProfile(), makeJob({ experience_years: null }))).toBe(0.5);
  });

  it("returns 0.5 when profile has no experience years", () => {
    expect(scoreExperience(makeProfile({ experience_years: null }), makeJob())).toBe(0.5);
  });

  it("returns 1.0 when user meets or exceeds requirement", () => {
    expect(scoreExperience(makeProfile({ experience_years: 6 }), makeJob({ experience_years: 5 }))).toBe(1.0);
  });

  it("returns proportional score when under-qualified", () => {
    expect(scoreExperience(makeProfile({ experience_years: 3 }), makeJob({ experience_years: 6 }))).toBe(0.5);
  });

  it("returns 1.0 when job requires 0 years", () => {
    expect(scoreExperience(makeProfile(), makeJob({ experience_years: 0 }))).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// scoreSalary
// ---------------------------------------------------------------------------

describe("scoreSalary", () => {
  it("returns 0.5 when job has no salary data", () => {
    expect(scoreSalary(makeProfile(), makeJob({ salary_min: null }))).toBe(0.5);
  });

  it("returns 0.5 when profile has no salary minimum", () => {
    expect(scoreSalary(makeProfile({ salary_min: null }), makeJob())).toBe(0.5);
  });

  it("returns 1.0 when job meets or exceeds user minimum", () => {
    expect(scoreSalary(makeProfile({ salary_min: 100000 }), makeJob({ salary_min: 120000 }))).toBe(1.0);
  });

  it("returns proportional score when job pays less", () => {
    expect(scoreSalary(makeProfile({ salary_min: 100000 }), makeJob({ salary_min: 80000 }))).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// scoreWorkMode
// ---------------------------------------------------------------------------

describe("scoreWorkMode", () => {
  it("returns 1.0 on exact match", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "remote" }))).toBe(1.0);
  });

  it("returns 0.0 on hard mismatch", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "onsite" }))).toBe(0.0);
  });

  it("returns 0.5 when either side is null", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: null }), makeJob())).toBe(0.5);
    expect(scoreWorkMode(makeProfile(), makeJob({ work_mode: null }))).toBe(0.5);
  });

  it("returns 0.5 when job is hybrid (acceptable for any preference)", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "remote" }), makeJob({ work_mode: "hybrid" }))).toBe(0.5);
    expect(scoreWorkMode(makeProfile({ work_mode: "onsite" }), makeJob({ work_mode: "hybrid" }))).toBe(0.5);
  });

  it("returns 0.75 when hybrid user matches a remote job (preferred over onsite)", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "hybrid" }), makeJob({ work_mode: "remote" }))).toBe(0.75);
  });

  it("returns 0.5 when hybrid user matches an onsite job (acceptable)", () => {
    expect(scoreWorkMode(makeProfile({ work_mode: "hybrid" }), makeJob({ work_mode: "onsite" }))).toBe(0.5);
  });
});


describe("hybrid scoring", () => {
  it("matches RN against Registered Nurse through taxonomy expansion", () => {
    const profile = makeProfile({ skills: ["Registered Nurse"], target_roles: [] });
    const job = makeJob({ title: "RN", description: "RN needed for patient care and clinical work." });

    const basic = scoreKeyword(profile, job);
    const enhanced = scoreKeywordEnhanced(profile, job);

    expect(enhanced.score).toBeGreaterThan(basic.score);
    expect(enhanced.matched).toContain("nursing");
  });

  it("matches CPA credentials across aliases", () => {
    const profile = makeProfile({
      skills: ["Certified Public Accountant"],
      target_roles: ["accountant"],
      resume_summary: "CPA with audit and tax background.",
    });
    const job = makeJob({
      title: "Senior CPA",
      description: "Looking for CPA with GAAP and tax experience.",
    });

    const hybrid = compositeScoreHybrid(profile, job);
    expect(hybrid.breakdown.semantic).toBeGreaterThan(0);
    expect(hybrid.matched).toContain("certified public accountant");
  });

  it("matches PMP against project management professional", () => {
    const profile = makeProfile({
      skills: ["PMP"],
      target_roles: ["program manager"],
      resume_summary: "Project leader with stakeholder management experience.",
    });
    const job = makeJob({
      title: "Project Management Professional",
      description: "PMP certification required with strong scheduling and planning skills.",
    });

    const hybrid = compositeScoreHybrid(profile, job);
    expect(hybrid.breakdown.semantic).toBeGreaterThan(0);
    expect(hybrid.matched).toContain("pmp");
  });

  it("resume text improves hybrid scoring over skills-only when extra context exists", () => {
    const profile = makeProfile({
      skills: ["python"],
      target_roles: ["backend engineer"],
      resume_summary: "Backend engineer.",
    });
    const job = makeJob({
      title: "Clinical Data Engineer",
      description: "Need Python engineer familiar with Epic EMR and clinical documentation systems.",
    });

    const withoutResume = compositeScoreHybrid(profile, job);
    const withResume = compositeScoreHybrid(profile, job, {
      resumeText: "Built Epic EMR integrations and clinical documentation tooling in Python.",
    });

    expect(withResume.total).toBeGreaterThanOrEqual(withoutResume.total);
  });

  it("resume text significantly improves score when containing job-specific terminology", () => {
    const profile = makeProfile({
      skills: ["nursing"],
      target_roles: ["nurse"],
      resume_summary: "Healthcare professional.",
    });
    const job = makeJob({
      title: "ICU Registered Nurse",
      description: "RN needed for intensive care unit with Epic EMR experience.",
    });

    const withoutResume = compositeScoreHybrid(profile, job);
    const withResume = compositeScoreHybrid(profile, job, {
      resumeText: "5 years as RN in ICU. Expert in Epic EMR documentation and critical care protocols.",
    });

    // Resume adds "rn", "icu", "epic", "emr" — should produce measurable lift
    expect(withResume.total).toBeGreaterThan(withoutResume.total);
    expect(withResume.breakdown.semantic).toBeGreaterThan(withoutResume.breakdown.semantic);
  });

  it("keeps backward compatible composite score available", () => {
    const profile = makeProfile({ skills: ["react", "typescript"] });
    const job = makeJob({ description: "react typescript frontend engineering role" });

    const legacy = compositeScore(profile, job);
    const hybrid = compositeScoreHybrid(profile, job);

    expect(legacy.total).toBeGreaterThan(0);
    expect(hybrid.breakdown.lexical_keyword).toBeDefined();
  });
});
