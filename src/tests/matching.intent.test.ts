import { describe, it, expect } from "vitest";
import type { NormalizedJob } from "../models.js";
import { inferIndustriesFromJob, normalizeRequestedIndustry } from "../matching/intent.js";

function makeJob(
  overrides: Partial<NormalizedJob> & { job_id: string; title: string; description: string },
): NormalizedJob {
  return {
    job_id: overrides.job_id,
    title: overrides.title,
    company: "Example Co",
    location: "Remote",
    description: overrides.description,
    url: `https://example.com/${overrides.job_id}`,
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-04-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeRequestedIndustry", () => {
  it("maps fintech aliases to the fintech family", () => {
    expect(normalizeRequestedIndustry("finserv")).toBe("fintech");
    expect(normalizeRequestedIndustry("payments")).toBe("fintech");
  });

  it("maps healthcare aliases to the healthcare family", () => {
    expect(normalizeRequestedIndustry("health tech")).toBe("healthcare");
    expect(normalizeRequestedIndustry("medtech")).toBe("healthcare");
  });

  it("maps new industry families directly", () => {
    expect(normalizeRequestedIndustry("cybersecurity")).toBe("cybersecurity");
    expect(normalizeRequestedIndustry("edtech")).toBe("edtech");
    expect(normalizeRequestedIndustry("proptech")).toBe("proptech");
  });

  it("maps AI aliases to artificial_intelligence", () => {
    expect(normalizeRequestedIndustry("AI")).toBe("artificial_intelligence");
    expect(normalizeRequestedIndustry("machine learning")).toBe("artificial_intelligence");
  });
});

describe("inferIndustriesFromJob", () => {
  it("classifies cybersecurity jobs", () => {
    const job = makeJob({
      job_id: "cyber-1",
      title: "Security Product Marketing Manager",
      description: "Own messaging for a cybersecurity platform focused on zero trust and identity security.",
    });

    expect(inferIndustriesFromJob(job)).toContain("cybersecurity");
  });

  it("classifies edtech jobs", () => {
    const job = makeJob({
      job_id: "edtech-1",
      title: "Lifecycle Marketing Manager",
      description: "Drive growth for an edtech learning platform used by students and teachers.",
    });

    expect(inferIndustriesFromJob(job)).toContain("edtech");
  });

  it("classifies proptech jobs", () => {
    const job = makeJob({
      job_id: "proptech-1",
      title: "Director of Product Marketing",
      description: "Lead GTM for a proptech platform serving real estate and property management teams.",
    });

    expect(inferIndustriesFromJob(job)).toContain("proptech");
  });

  it("preserves developer tools and AI classifications with expanded aliases", () => {
    const job = makeJob({
      job_id: "ai-devtools-1",
      title: "Product Marketing Lead",
      description: "Own positioning for an AI developer tools platform with observability and model inference workflows.",
    });

    const industries = inferIndustriesFromJob(job);
    expect(industries).toContain("artificial_intelligence");
    expect(industries).toContain("developer_tools");
  });

  it("does not classify healthcare dx shorthand as developer tools", () => {
    const job = makeJob({
      job_id: "healthcare-dx-1",
      title: "Clinical Operations Manager",
      description: "Improve patient intake, care management, and faster dx workflows for providers.",
    });

    const industries = inferIndustriesFromJob(job);
    expect(industries).toContain("healthcare");
    expect(industries).not.toContain("developer_tools");
  });
});
