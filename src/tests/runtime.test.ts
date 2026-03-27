import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const { mockCheckLicense, mockEnhanceDraft } = vi.hoisted(() => ({
  mockCheckLicense: vi.fn(),
  mockEnhanceDraft: vi.fn(),
}));

vi.mock("../license.js", async () => {
  const actual = await vi.importActual<typeof import("../license.js")>("../license.js");
  return { ...actual, checkLicense: mockCheckLicense };
});

vi.mock("../llm-enhance.js", async () => {
  const actual = await vi.importActual<typeof import("../llm-enhance.js")>("../llm-enhance.js");
  return { ...actual, enhanceDraft: mockEnhanceDraft };
});

import { CAREERCLAW_FEATURES, createClawOsExecutionContext } from "../execution-context.js";
import { runCareerClawStandalone, runCareerClawWithContext } from "../runtime.js";
import { TrackingRepository } from "../tracking.js";
import { emptyProfile, type NormalizedJob, type OutreachDraft, type UserProfile } from "../models.js";
import type { FetchResult } from "../sources.js";

function makeTmpRepo(dryRun = false): TrackingRepository {
  const dir = mkdtempSync(join(tmpdir(), "cc-runtime-test-"));
  return new TrackingRepository({
    trackingPath: join(dir, "tracking.json"),
    runsPath: join(dir, "runs.jsonl"),
    dryRun,
  });
}

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "job-runtime-01",
    title: "Senior TypeScript Engineer",
    company: "Acme",
    location: "Remote",
    description: "TypeScript react node aws engineer role.",
    url: "https://example.com/job/runtime-01",
    source: "remoteok",
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
    ...emptyProfile(),
    skills: ["typescript", "react", "node"],
    target_roles: ["Senior Engineer"],
    experience_years: 7,
    work_mode: "remote",
    resume_summary: "Senior engineer with strong TypeScript and React experience.",
    ...overrides,
  };
}

function stubFetch(jobs: NormalizedJob[]): () => Promise<FetchResult> {
  return async () => ({
    jobs,
    counts: { remoteok: jobs.filter((j) => j.source === "remoteok").length },
    errors: {},
  });
}

function makeEnhancedDraft(overrides: Partial<OutreachDraft> = {}): OutreachDraft {
  return {
    job_id: "job-runtime-01",
    subject: "Enhanced draft",
    body: "Enhanced body",
    llm_enhanced: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockCheckLicense.mockReset();
  mockEnhanceDraft.mockReset();
  mockCheckLicense.mockResolvedValue({ valid: true, source: "api" });
  mockEnhanceDraft.mockResolvedValue(makeEnhancedDraft());
});

describe("runCareerClawStandalone", () => {
  it("uses standalone license validation before premium drafts", async () => {
    const result = await runCareerClawStandalone(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
      },
      {
        proKey: "standalone-pro-key",
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(mockCheckLicense).toHaveBeenCalledTimes(1);
    expect(mockEnhanceDraft).toHaveBeenCalledTimes(1);
    expect(result.drafts[0]?.llm_enhanced).toBe(true);
  });

  it("stays on template drafts when no standalone Pro key is provided", async () => {
    const result = await runCareerClawStandalone(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
      },
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(mockCheckLicense).not.toHaveBeenCalled();
    expect(mockEnhanceDraft).not.toHaveBeenCalled();
    expect(result.drafts[0]?.llm_enhanced).toBe(false);
  });
});

describe("runCareerClawWithContext", () => {
  it("uses the verified ClawOS context without standalone license validation", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(mockCheckLicense).not.toHaveBeenCalled();
    expect(mockEnhanceDraft).toHaveBeenCalledTimes(1);
    expect(result.drafts[0]?.llm_enhanced).toBe(true);
  });

  it("does not enable premium drafts when the ClawOS feature is absent", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(mockCheckLicense).not.toHaveBeenCalled();
    expect(mockEnhanceDraft).not.toHaveBeenCalled();
    expect(result.drafts[0]?.llm_enhanced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// topK tier clamping
// ---------------------------------------------------------------------------

function makeManyJobs(count: number): NormalizedJob[] {
  return Array.from({ length: count }, (_, i) =>
    makeJob({
      job_id: `job-topk-${i}`,
      title: `Engineer Role ${i}`,
      company: `Company ${i}`,
      url: `https://example.com/job/topk-${i}`,
    })
  );
}

describe("topK tier clamping — ClawOS context", () => {
  it("clamps topK to 3 for free-tier context even when 10 is requested", async () => {
    const context = createClawOsExecutionContext({
      tier: "free",
      features: [],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        topK: 10,
        dryRun: true,
      },
      context,
      {
        fetchFn: stubFetch(makeManyJobs(15)),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.matches.length).toBeLessThanOrEqual(3);
  });

  it("allows topK up to 10 for Pro context with TOPK_EXTENDED", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TOPK_EXTENDED,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 10,
        dryRun: true,
      },
      context,
      {
        fetchFn: stubFetch(makeManyJobs(15)),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.matches.length).toBeGreaterThan(3);
    expect(result.matches.length).toBeLessThanOrEqual(10);
  });

  it("clamps topK to 3 for Pro context WITHOUT TOPK_EXTENDED", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 10,
        dryRun: true,
      },
      context,
      {
        fetchFn: stubFetch(makeManyJobs(15)),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.matches.length).toBeLessThanOrEqual(3);
  });
});

describe("topK tier clamping — standalone", () => {
  it("clamps topK to 3 for standalone free (no Pro key)", async () => {
    const result = await runCareerClawStandalone(
      {
        profile: makeProfile(),
        topK: 10,
        dryRun: true,
      },
      {
        fetchFn: stubFetch(makeManyJobs(15)),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.matches.length).toBeLessThanOrEqual(3);
  });

  it("allows topK up to 10 for standalone Pro with valid license", async () => {
    mockCheckLicense.mockResolvedValue({ valid: true, source: "api" });

    const result = await runCareerClawStandalone(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 10,
        dryRun: true,
      },
      {
        proKey: "valid-pro-key",
        fetchFn: stubFetch(makeManyJobs(15)),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.matches.length).toBeGreaterThan(3);
    expect(result.matches.length).toBeLessThanOrEqual(10);
  });
});
