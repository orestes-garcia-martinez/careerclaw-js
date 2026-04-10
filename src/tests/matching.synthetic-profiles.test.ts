import { describe, it, expect } from "vitest";
import { rankJobs } from "../matching/engine.js";
import { emptyProfile } from "../models.js";
import type { NormalizedJob, UserProfile } from "../models.js";

function makeJob(overrides: Partial<NormalizedJob> & { job_id: string; title: string; description: string }): NormalizedJob {
  return {
    job_id: overrides.job_id,
    title: overrides.title,
    company: "Example Co",
    location: "Remote",
    description: overrides.description,
    url: `https://example.com/${overrides.job_id}`,
    source: "remoteok",
    salary_min: 150000,
    salary_max: null,
    work_mode: "remote",
    experience_years: 5,
    posted_at: null,
    fetched_at: "2026-04-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("synthetic profile regressions", () => {
  it("keeps Elena Ruiz aligned to marketing roles over engineering and sales roles", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["Product Marketing", "Demand Generation", "Lifecycle Marketing", "HubSpot", "SQL", "Analytics"],
      target_roles: ["Director of Marketing", "Head of Product Marketing", "Growth Marketing Leader"],
      resume_summary: "Growth and product marketing leader with B2B SaaS and AI workflow experience.",
      experience_years: 11,
      work_mode: "onsite",
      location: "Florida",
      salary_min: 150000,
      location_radius_km: 40,
      target_industry: "fintech",
    };

    const results = rankJobs([
      makeJob({
        job_id: "marketing",
        title: "Director of Product Marketing",
        description: "Lead positioning, messaging, launches, analytics, lifecycle programs, and GTM planning for a fintech product.",
        work_mode: "onsite",
        location: "Miami, FL",
      }),
      makeJob({
        job_id: "engineering",
        title: "Software Engineer",
        description: "Build Python backend systems, APIs, and AI workflows for developers.",
        work_mode: "onsite",
        location: "Miami, FL",
      }),
      makeJob({
        job_id: "sales",
        title: "Senior Sales Development Representative",
        description: "Own outbound generation, prospecting, and pipeline creation with HubSpot.",
        work_mode: "remote",
      }),
    ], profile, 3, 0);

    expect(results[0]?.job.job_id).toBe("marketing");
    expect(results[0]?.breakdown.role_alignment).toBeGreaterThan(results[1]?.breakdown.role_alignment ?? 0);
  });

  it("filters Elena Ruiz fintech searches away from healthcare and gaming roles", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["Product Marketing", "Demand Generation", "Lifecycle Marketing", "HubSpot", "SQL", "Analytics"],
      target_roles: ["Director of Marketing", "Head of Product Marketing", "Growth Marketing Leader"],
      resume_summary: "Growth and product marketing leader with B2B SaaS and AI workflow experience.",
      experience_years: 11,
      work_mode: "onsite",
      location: "Florida",
      salary_min: 150000,
      location_radius_km: 40,
    };

    const results = rankJobs([
      makeJob({
        job_id: "fintech-marketing",
        title: "Director of Product Marketing",
        company: "FinBank",
        description: "Lead GTM, positioning, analytics, and lifecycle programs for payments and lending products.",
        work_mode: "onsite",
        location: "Miami, FL",
      }),
      makeJob({
        job_id: "healthcare-marketing",
        title: "Director of Product Marketing",
        company: "Medallion Health",
        description: "Own provider messaging, patient engagement, and clinical platform growth for healthcare operations.",
        work_mode: "onsite",
        location: "Miami, FL",
      }),
      makeJob({
        job_id: "gaming-marketing",
        title: "User Acquisition Specialist",
        company: "Hyperlab Games",
        description: "Run paid user acquisition and growth campaigns for a mobile gaming studio.",
        work_mode: "onsite",
        location: "Miami, FL",
      }),
    ], profile, 5, 0, { target_industry: "fintech" });

    expect(results).toHaveLength(1);
    expect(results[0]?.job.job_id).toBe("fintech-marketing");
  });

  it("keeps Marcus Chen aligned to product design roles over engineering roles", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["Product Design", "Design Systems", "Accessibility", "Figma", "Storybook"],
      target_roles: ["Senior Product Designer", "Design Systems Lead"],
      resume_summary: "Product designer for SaaS platforms and workflow tools with strong systems thinking.",
      experience_years: 9,
      work_mode: "remote",
      location: "Brooklyn, NY",
      salary_min: 170000,
      location_radius_km: 25,
    };

    const results = rankJobs([
      makeJob({
        job_id: "design",
        title: "Lead Product Designer",
        description: "Own interaction design, accessibility, Figma workflows, design systems, and product UX patterns.",
      }),
      makeJob({
        job_id: "engineering",
        title: "Frontend Engineer",
        description: "Build React components, TypeScript systems, and Storybook documentation.",
      }),
    ], profile, 2, 0);

    expect(results[0]?.job.job_id).toBe("design");
    expect(results[0]?.breakdown.role_alignment).toBe(1);
  });

  it("keeps Priya Patel aligned to operations roles over marketing roles", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["Business Operations", "Program Management", "Customer Onboarding", "Launch Readiness", "Zendesk"],
      target_roles: ["Operations Lead", "Director of Operations", "Customer Operations Leader"],
      resume_summary: "Operator focused on launch management, support workflows, onboarding, and scaling teams.",
      experience_years: 12,
      work_mode: "remote",
      location: "Raleigh, NC",
      salary_min: 140000,
      location_radius_km: 30,
    };

    const results = rankJobs([
      makeJob({
        job_id: "operations",
        title: "Director of Customer Operations",
        description: "Lead onboarding, support escalations, KPI reporting, launch readiness, and cross-functional process design.",
      }),
      makeJob({
        job_id: "marketing",
        title: "Lifecycle Marketing Manager",
        description: "Own messaging, nurture campaigns, demand generation, and growth analytics.",
      }),
    ], profile, 2, 0);

    expect(results[0]?.job.job_id).toBe("operations");
    expect(results[0]?.breakdown.role_alignment).toBeGreaterThan(results[1]?.breakdown.role_alignment ?? 0);
  });

  it("keeps Daniel Moreau aligned to finance roles over product roles", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["FP&A", "Pricing Strategy", "Scenario Modeling", "Cash Planning", "Board Reporting", "SQL", "NetSuite"],
      target_roles: ["Finance Lead", "Head of Finance", "FP&A Leader"],
      resume_summary: "Strategic finance leader for SaaS businesses with strong subscription economics and planning experience.",
      experience_years: 10,
      work_mode: "remote",
      location: "Seattle, WA",
      salary_min: 180000,
      location_radius_km: 25,
    };

    const results = rankJobs([
      makeJob({
        job_id: "finance",
        title: "Head of Finance",
        description: "Own FP&A, board reporting, pricing analysis, scenario modeling, margin planning, and SaaS metrics.",
      }),
      makeJob({
        job_id: "product",
        title: "Product Manager",
        description: "Drive roadmap prioritization, UX improvements, and engineering delivery for a SaaS workflow product.",
      }),
    ], profile, 2, 0);

    expect(results[0]?.job.job_id).toBe("finance");
    expect(results[0]?.breakdown.role_alignment).toBe(1);
  });
});
