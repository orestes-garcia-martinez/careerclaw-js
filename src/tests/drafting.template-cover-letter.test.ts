/**
 * drafting.template-cover-letter.test.ts — Unit tests for buildTemplateCoverLetter
 * gap keyword filtering (P1b fix).
 *
 * Tests the filterGapKeywordsForProse logic through the public
 * buildTemplateCoverLetter API. Verifies the exact bug from the
 * original incident: gap keywords "level" (company name) and "builds"
 * (generic verb) no longer appear in template prose.
 *
 * Run: npm test (from careerclaw-js root)
 */

import { describe, it, expect } from "vitest";
import { buildTemplateCoverLetter } from "../drafting.js";
import type { NormalizedJob, UserProfile, GapAnalysisResult } from "../models.js";

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "level-frontend-001",
    title: "Senior Frontend Engineer",
    company: "Level",
    location: "Remote",
    description: "Build modern monitoring tools.",
    url: "https://level.io/jobs/1",
    source: "hackernews",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    skills: ["typescript", "react"],
    target_roles: ["Senior Engineer"],
    experience_years: 8,
    work_mode: "remote",
    resume_summary: null,
    location: null,
    salary_min: null,
    ...overrides,
  };
}

function makeGapResult(topGapKeywords: string[]): GapAnalysisResult {
  return {
    fit_score: 0.32,
    fit_score_unweighted: 0.21,
    signals: { keywords: ["typescript", "react"], phrases: [] },
    // gaps.keywords is the FULL list — intentionally different from
    // summary.top_gaps.keywords (the top-5 slice). If production code
    // accidentally reads gaps instead of summary.top_gaps, the test
    // will fail because the values diverge.
    gaps: { keywords: [...topGapKeywords, "extra_full_gap_keyword"], phrases: [] },
    summary: {
      top_signals: { keywords: ["typescript", "react"], phrases: [] },
      top_gaps: { keywords: topGapKeywords, phrases: [] },
    },
  };
}

describe("buildTemplateCoverLetter — gap keyword filtering (P1b)", () => {
  it("filters out company name from gap acknowledgement", () => {
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Level" }),
      makeProfile(),
      ["typescript", "react"],
      makeGapResult(["level", "graphql", "webrtc"]),
    );

    expect(result.body).not.toContain("level");
    // graphql and webrtc should survive
    expect(result.body).toContain("graphql");
  });

  it("filters out blocklisted generic words", () => {
    const result = buildTemplateCoverLetter(
      makeJob(),
      makeProfile(),
      ["typescript"],
      makeGapResult(["builds", "team", "experience", "kubernetes"]),
    );

    expect(result.body).not.toContain("builds");
    expect(result.body).not.toContain("team");
    expect(result.body).not.toContain("experience");
    // kubernetes should survive
    expect(result.body).toContain("kubernetes");
  });

  it("reproduces the original bug scenario: 'level' + 'builds' → omitted", () => {
    // This is the EXACT scenario from the bug report:
    // Gap keywords were ["level", "builds"] for a job at company "Level"
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Level" }),
      makeProfile(),
      ["react", "typescript", "next.js", "graphql"],
      makeGapResult(["level", "builds"]),
    );

    // "level" is the company name → filtered
    // "builds" is in the blocklist → filtered
    // No usable gap keywords remain → gap acknowledgement clause omitted
    expect(result.body).not.toContain("level");
    expect(result.body).not.toContain("builds");
    expect(result.body).not.toContain("does not yet include");
  });

  it("preserves 2-char skill tokens like 'go'", () => {
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Acme" }),
      makeProfile(),
      ["typescript"],
      makeGapResult(["go", "kubernetes"]),
    );

    expect(result.body).toContain("go");
    expect(result.body).toContain("kubernetes");
  });

  it("filters single-char tokens", () => {
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Acme" }),
      makeProfile(),
      ["typescript"],
      makeGapResult(["r", "kubernetes"]),
    );

    // "r" is 1 char → filtered
    expect(result.body).not.toMatch(/\br\b/);
    expect(result.body).toContain("kubernetes");
  });

  it("omits gap clause entirely when all keywords are filtered", () => {
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Level" }),
      makeProfile(),
      ["typescript"],
      makeGapResult(["level", "team", "builds"]),
    );

    // All filtered → no gap acknowledgement clause
    expect(result.body).not.toContain("does not yet include");
    expect(result.body).not.toContain("motivated to grow");
  });

  it("includes gap clause when usable keywords exist", () => {
    const result = buildTemplateCoverLetter(
      makeJob({ company: "Acme" }),
      makeProfile(),
      ["typescript"],
      makeGapResult(["kubernetes", "terraform"]),
    );

    expect(result.body).toContain("does not yet include");
    expect(result.body).toContain("kubernetes");
  });

  it("always sets is_template: true", () => {
    const result = buildTemplateCoverLetter(
      makeJob(),
      makeProfile(),
      ["typescript"],
      makeGapResult(["kubernetes"]),
    );

    expect(result.is_template).toBe(true);
  });
});
