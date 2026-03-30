import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const { mockCheckLicense, mockEnhanceDraft, mockGenerateCoverLetter, mockGapAnalysis, gapAnalysisRef } = vi.hoisted(() => ({
  mockCheckLicense: vi.fn(),
  mockEnhanceDraft: vi.fn(),
  mockGenerateCoverLetter: vi.fn(),
  mockGapAnalysis: vi.fn(),
  gapAnalysisRef: { fn: null as null | typeof import("../gap.js").gapAnalysis },
}));

vi.mock("../license.js", async () => {
  const actual = await vi.importActual<typeof import("../license.js")>("../license.js");
  return { ...actual, checkLicense: mockCheckLicense };
});

vi.mock("../llm-enhance.js", async () => {
  const actual = await vi.importActual<typeof import("../llm-enhance.js")>("../llm-enhance.js");
  return { ...actual, enhanceDraft: mockEnhanceDraft, generateCoverLetter: mockGenerateCoverLetter };
});

vi.mock("../gap.js", async () => {
  const actual = await vi.importActual<typeof import("../gap.js")>("../gap.js");
  gapAnalysisRef.fn = actual.gapAnalysis;
  mockGapAnalysis.mockImplementation(actual.gapAnalysis);
  return { ...actual, gapAnalysis: mockGapAnalysis };
});

import { CAREERCLAW_FEATURES, createClawOsExecutionContext } from "../execution-context.js";
import { runCareerClawStandalone, runCareerClawWithContext } from "../runtime.js";
import { TrackingRepository } from "../tracking.js";
import { emptyProfile, type NormalizedJob, type OutreachDraft, type ResumeIntelligence, type UserProfile } from "../models.js";
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
  mockGenerateCoverLetter.mockReset();
  mockGapAnalysis.mockReset();
  mockCheckLicense.mockResolvedValue({ valid: true, source: "api" });
  mockEnhanceDraft.mockResolvedValue(makeEnhancedDraft());
  mockGenerateCoverLetter.mockResolvedValue(null);
  mockGapAnalysis.mockImplementation(
    (resumeIntel: ResumeIntelligence, job: NormalizedJob) => gapAnalysisRef.fn!(resumeIntel, job)
  );
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

// ---------------------------------------------------------------------------
// Cover letter generation — ClawOS context (index-based)
// ---------------------------------------------------------------------------

const MOCK_COVER_LETTER_BODY = "I am writing to apply for the Senior TypeScript Engineer position at Acme. My experience aligns well with your needs.";

describe("cover letter — index-based selection", () => {
  it("generates a cover letter for the requested match index (LLM success)", async () => {
    mockGenerateCoverLetter.mockResolvedValue(MOCK_COVER_LETTER_BODY);

    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
        CAREERCLAW_FEATURES.TOPK_EXTENDED,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(1);
    expect(result.cover_letters[0]!.is_template).toBe(false);
    expect(result.cover_letters[0]!.body).toBe(MOCK_COVER_LETTER_BODY);
    expect(result.cover_letters[0]!.tone).toBe("professional");
    expect(result.cover_letters[0]!.job_id).toBe(result.matches[0]!.job.job_id);
    expect(typeof result.cover_letters[0]!.match_score).toBe("number");
    expect(result.cover_letters[0]!.keyword_coverage).toHaveProperty("top_signals");
    expect(result.cover_letters[0]!.keyword_coverage).toHaveProperty("top_gaps");
  });

  it("falls back to template cover letter when LLM fails", async () => {
    mockGenerateCoverLetter.mockResolvedValue(null);

    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(1);
    expect(result.cover_letters[0]!.is_template).toBe(true);
    expect(result.cover_letters[0]!.body).toContain("Sincerely,");
    expect(result.cover_letters[0]!.body).toContain("[Your Name]");
    expect(typeof result.cover_letters[0]!.match_score).toBe("number");
  });

  it("generates cover letters for multiple requested indices", async () => {
    mockGenerateCoverLetter.mockResolvedValue(MOCK_COVER_LETTER_BODY);

    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
        CAREERCLAW_FEATURES.TOPK_EXTENDED,
      ],
    });

    const jobs = makeManyJobs(5);
    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 5,
        dryRun: true,
        coverLetterMatchIndices: [0, 2],
      },
      context,
      {
        fetchFn: stubFetch(jobs),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(2);
    expect(result.cover_letters[0]!.job_id).toBe(result.matches[0]!.job.job_id);
    expect(result.cover_letters[1]!.job_id).toBe(result.matches[2]!.job.job_id);
  });

  it("returns empty cover_letters when no indices are requested", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        // No coverLetterMatchIndices — defaults to []
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(0);
    expect(mockGenerateCoverLetter).not.toHaveBeenCalled();
  });

  it("silently skips out-of-bounds indices", async () => {
    mockGenerateCoverLetter.mockResolvedValue(MOCK_COVER_LETTER_BODY);

    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        coverLetterMatchIndices: [0, 5, 99],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    // Only index 0 is valid — 5 and 99 are silently skipped
    expect(result.cover_letters).toHaveLength(1);
  });

  it("returns empty cover_letters for free tier even with indices", async () => {
    const context = createClawOsExecutionContext({
      tier: "free",
      features: [],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(0);
    expect(mockGenerateCoverLetter).not.toHaveBeenCalled();
  });

  it("returns empty cover_letters when there are no matches", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.TAILORED_COVER_LETTER],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.cover_letters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Gap analysis — index-based selection
// ---------------------------------------------------------------------------

describe("gap analysis — index-based selection", () => {
  it("generates a gap analysis report for the requested match index", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        gapAnalysisMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.gap_analyses).toHaveLength(1);
    expect(result.gap_analyses[0]!.job_id).toBe(result.matches[0]!.job.job_id);
    expect(result.gap_analyses[0]!.title).toBe(result.matches[0]!.job.title);
    expect(result.gap_analyses[0]!.company).toBe(result.matches[0]!.job.company);
    expect(typeof result.gap_analyses[0]!.analysis.fit_score).toBe("number");
    expect(result.gap_analyses[0]!.analysis.summary).toHaveProperty("top_signals");
    expect(result.gap_analyses[0]!.analysis.summary).toHaveProperty("top_gaps");
  });

  it("generates gap analyses for multiple requested indices", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
        CAREERCLAW_FEATURES.TOPK_EXTENDED,
      ],
    });

    const jobs = makeManyJobs(5);
    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 5,
        dryRun: true,
        gapAnalysisMatchIndices: [0, 2, 4],
      },
      context,
      {
        fetchFn: stubFetch(jobs),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.gap_analyses).toHaveLength(3);
    expect(result.gap_analyses[0]!.job_id).toBe(result.matches[0]!.job.job_id);
    expect(result.gap_analyses[1]!.job_id).toBe(result.matches[2]!.job.job_id);
    expect(result.gap_analyses[2]!.job_id).toBe(result.matches[4]!.job.job_id);
  });

  it("silently skips out-of-bounds indices", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        gapAnalysisMatchIndices: [0, 5, 99],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.gap_analyses).toHaveLength(1);
  });

  it("returns empty gap_analyses when no indices are requested", async () => {
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS],
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

    expect(result.gap_analyses).toHaveLength(0);
  });

  it("returns empty gap_analyses for free tier even with indices", async () => {
    const context = createClawOsExecutionContext({
      tier: "free",
      features: [],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        gapAnalysisMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.gap_analyses).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Gap cache sharing — cover letter uses precomputed gap when both requested
// ---------------------------------------------------------------------------

describe("gap cache sharing", () => {
  it("cover letter uses precomputed gap from gap analysis when same index requested", async () => {
    mockGenerateCoverLetter.mockResolvedValue(null); // Force template fallback so we can inspect match_score

    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    const result = await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        gapAnalysisMatchIndices: [0],
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.gap_analyses).toHaveLength(1);
    expect(result.cover_letters).toHaveLength(1);

    // Both should have the same fit score — proving the cover letter
    // used the precomputed gap rather than running a separate analysis
    expect(result.cover_letters[0]!.match_score).toBe(
      result.gap_analyses[0]!.analysis.fit_score
    );
  });

  it("gapAnalysis is called exactly once when same index appears in both lists", async () => {
    // Baseline: cover letter alone calls gapAnalysis once (no cache, no pre-computation).
    // With gap analysis pre-computation for the same index, the cover letter must
    // consume the cached result — so the total should still be exactly one call.
    const context = createClawOsExecutionContext({
      tier: "pro",
      features: [
        CAREERCLAW_FEATURES.TAILORED_COVER_LETTER,
        CAREERCLAW_FEATURES.RESUME_GAP_ANALYSIS,
        CAREERCLAW_FEATURES.LLM_OUTREACH_DRAFT,
      ],
    });

    await runCareerClawWithContext(
      {
        profile: makeProfile(),
        resumeText: "TypeScript React Node AWS",
        topK: 1,
        dryRun: true,
        gapAnalysisMatchIndices: [0],
        coverLetterMatchIndices: [0],
      },
      context,
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    // If gapCache were bypassed, generateCoverLetterForMatch would call
    // gapAnalysis a second time internally → count would be 2.
    expect(mockGapAnalysis).toHaveBeenCalledTimes(1);
  });
});

describe("resume intelligence propagation", () => {
  it("returns the engine-computed resume_intel from the standalone runtime", async () => {
    const result = await runCareerClawStandalone(
      {
        profile: makeProfile({ skills: [], target_roles: [] }),
        resumeText: "TypeScript React Node AWS architecture leadership",
        topK: 1,
        dryRun: true,
      },
      {
        fetchFn: stubFetch([makeJob()]),
        repo: makeTmpRepo(true),
      }
    );

    expect(result.resume_intel).not.toBeNull();
    expect(result.resume_intel?.extracted_keywords).toContain("typescript");
    expect(result.resume_intel?.source).toBe("resume_text");
  });

  it("preserves an explicit resumeIntel override instead of recomputing it", async () => {
    const explicitResumeIntel = {
      extracted_keywords: ["graphql"],
      extracted_phrases: ["platform engineer"],
      keyword_stream: ["graphql"],
      phrase_stream: ["platform engineer"],
      impact_signals: ["graphql"],
      keyword_weights: { graphql: 1 },
      phrase_weights: { "platform engineer": 0.8 },
      source: "skills_injected" as const,
    };

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
        resumeIntel: explicitResumeIntel,
      }
    );

    expect(result.resume_intel).toEqual(explicitResumeIntel);
  });
});
