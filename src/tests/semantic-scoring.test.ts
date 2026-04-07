import { describe, expect, it } from "vitest";
import type { NormalizedJob, UserProfile } from "../models.js";
import { emptyProfile } from "../models.js";
import {
  buildJobSemanticView,
  buildProfileSemanticView,
  computeSemanticScore,
  weightedOverlapScore,
} from "../matching/semantic-scoring.js";

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "job-1",
    title: "Registered Nurse",
    company: "General Hospital",
    location: "Remote",
    description: "Need RN with patient care and clinical documentation experience.",
    url: "https://example.com/job-1",
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...emptyProfile(),
    skills: ["rn"],
    target_roles: ["registered nurse"],
    resume_summary: "Registered Nurse with strong patient care background.",
    work_mode: "remote",
    ...overrides,
  };
}

describe("semantic scoring", () => {
  it("matches canonical concepts across aliases", () => {
    const profileView = buildProfileSemanticView(makeProfile());
    const jobView = buildJobSemanticView(makeJob());
    const result = computeSemanticScore(profileView, jobView);

    expect(result.available).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.matched_concepts).toContain("registered nurse");
  });

  it("returns zero score when no semantic concepts are shared", () => {
    const profileView = buildProfileSemanticView(
      makeProfile({
        skills: ["typescript"],
        target_roles: ["frontend engineer"],
        resume_summary: "Frontend engineer specializing in React.",
      })
    );
    const jobView = buildJobSemanticView(
      makeJob({
        title: "Certified Public Accountant",
        description: "CPA needed for tax and audit work.",
      })
    );
    const result = computeSemanticScore(profileView, jobView);

    expect(result.available).toBe(true);
    expect(result.score).toBe(0);
    expect(result.gap_concepts).toContain("certified public accountant");
  });

  it("weighted overlap stays in [0,1]", () => {
    const result = weightedOverlapScore(
      new Map([
        ["react", 1],
        ["typescript", 0.8],
      ]),
      new Map([
        ["react", 1],
        ["nodejs", 0.8],
      ])
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.matched).toContain("react");
    expect(result.gaps).toContain("nodejs");
  });

  it("resume text adds extra lexical tokens and phrases", () => {
    const baseView = buildProfileSemanticView(makeProfile());
    const richerView = buildProfileSemanticView(makeProfile(), {
      resumeText:
        "Built Epic EMR workflows and clinical documentation tools for nursing staff.",
    });

    expect(richerView.semanticPhrases.size).toBeGreaterThanOrEqual(
      baseView.semanticPhrases.size
    );
    // Raw lexical tokens from resume text are still indexed
    expect(richerView.lexicalWeights.has("clinical")).toBe(true);
    expect(richerView.lexicalWeights.has("documentation")).toBe(true);
  });

  it("resume text does NOT inject phantom taxonomy concepts", () => {
    // A designer's resume may say "Worked closely with PM and engineering..."
    // The word "PM" must not expand the profile into the project-management
    // concept cluster — that skill belongs to someone else, not the user.
    const designerProfile = makeProfile({
      skills: ["figma", "design systems"],
      target_roles: ["product designer"],
      resume_summary: "Product designer with 9 years of UX experience.",
    });
    const view = buildProfileSemanticView(designerProfile, {
      resumeText:
        "Worked closely with PM and engineering to ship complex workflows in smaller, testable increments.",
    });

    expect(view.semanticConcepts.has("project management")).toBe(false);
    // The designer's own taxonomy concepts should still be present
    expect(view.semanticConcepts.has("product design")).toBe(true);
    expect(view.semanticConcepts.has("design systems")).toBe(true);
  });
});
