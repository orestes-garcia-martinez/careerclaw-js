/**
 * embedding.test.ts — Unit tests for the embedding scoring path.
 *
 * Tests run without a real model: a MockEmbeddingProvider returns
 * deterministic synthetic vectors so the machinery can be verified
 * without downloading any files.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { cosineSimilarity } from "../embedding/cosine.js";
import {
  buildProfileEmbeddingText,
  buildJobEmbeddingText,
} from "../embedding/text-builder.js";
import { compositeScoreWithEmbedding } from "../matching/scoring.js";
import { rankJobsWithEmbeddings } from "../matching/engine.js";
import type { EmbeddingProvider } from "../embedding/provider.js";
import type { NormalizedJob, UserProfile } from "../models.js";
import { emptyProfile } from "../models.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...emptyProfile(),
    skills: ["figma", "design systems", "ux design"],
    target_roles: ["senior product designer"],
    resume_summary: "Senior Product Designer with 9 years of UX experience.",
    work_mode: "remote",
    ...overrides,
  };
}

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "job-1",
    title: "Senior Product Designer",
    company: "Acme",
    location: "Remote",
    description: "Looking for a Senior Product Designer with Figma and design systems expertise.",
    url: "https://example.com/job-1",
    source: "remoteok",
    salary_min: null,
    salary_max: null,
    work_mode: "remote",
    experience_years: null,
    posted_at: null,
    fetched_at: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

/** Returns a vector pointing in the direction of the provided seed. */
function makeVec(dims: number, seed: number): Float32Array {
  const v = new Float32Array(dims);
  for (let i = 0; i < dims; i++) {
    v[i] = Math.sin(seed + i * 0.1);
  }
  // L2-normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += (v[i] ?? 0) ** 2;
  norm = Math.sqrt(norm);
  for (let i = 0; i < dims; i++) v[i] = (v[i] ?? 0) / norm;
  return v;
}

/**
 * MockEmbeddingProvider maps each unique text to a deterministic vector
 * based on its position in the batch. Texts that are "the same" (same seed)
 * get the same vector — tested explicitly in the similarity tests below.
 */
class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 32;
  readonly modelName = "mock/test-model";

  private readonly textToSeed: Map<string, number>;

  constructor(textToSeed: Map<string, number> = new Map()) {
    this.textToSeed = textToSeed;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((text, i) => {
      const seed = this.textToSeed.get(text) ?? i;
      return makeVec(this.dimensions, seed);
    });
  }
}

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical normalized vectors", () => {
    const v = makeVec(32, 1.0);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("returns 0.0 for two empty-ish vectors (clamped)", () => {
    const a = new Float32Array(32).fill(0);
    const b = new Float32Array(32).fill(0);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("stays in [0, 1]", () => {
    for (let seed = 0; seed < 10; seed++) {
      const a = makeVec(32, seed);
      const b = makeVec(32, seed + 5);
      const sim = cosineSimilarity(a, b);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    }
  });

  it("is symmetric", () => {
    const a = makeVec(32, 1);
    const b = makeVec(32, 3);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// ---------------------------------------------------------------------------
// buildProfileEmbeddingText
// ---------------------------------------------------------------------------

describe("buildProfileEmbeddingText", () => {
  it("joins target_roles, skills, and summary with pipe separators", () => {
    const text = buildProfileEmbeddingText(makeProfile());
    expect(text).toContain("senior product designer");
    expect(text).toContain("figma");
    expect(text).toContain("ux design");
    expect(text).toContain("Senior Product Designer with 9 years");
    expect(text).toContain(" | ");
  });

  it("appends resumeText truncated to 500 chars", () => {
    const longResume = "a".repeat(1000);
    const text = buildProfileEmbeddingText(makeProfile(), longResume);
    // resumeText should be capped at 500 chars
    const parts = text.split(" | ");
    const resumePart = parts[parts.length - 1] ?? "";
    expect(resumePart.length).toBeLessThanOrEqual(500);
  });

  it("omits empty fields gracefully", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      target_roles: [],
      skills: [],
      resume_summary: null,
    };
    const text = buildProfileEmbeddingText(profile);
    expect(text).toBe("");
  });

  it("does not include resumeText when it is whitespace", () => {
    const text = buildProfileEmbeddingText(makeProfile(), "   ");
    expect(text).not.toContain("   ");
    expect(text.split(" | ").length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// buildJobEmbeddingText
// ---------------------------------------------------------------------------

describe("buildJobEmbeddingText", () => {
  it("combines title and description with a pipe separator", () => {
    const text = buildJobEmbeddingText(makeJob());
    expect(text).toContain("Senior Product Designer");
    expect(text).toContain(" | ");
    expect(text).toContain("Figma and design systems");
  });

  it("truncates description to 1000 chars", () => {
    const job = makeJob({ description: "x".repeat(2000) });
    const text = buildJobEmbeddingText(job);
    const descPart = text.split(" | ")[1] ?? "";
    expect(descPart.length).toBeLessThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------------------
// compositeScoreWithEmbedding
// ---------------------------------------------------------------------------

describe("compositeScoreWithEmbedding", () => {
  it("produces a score in [0, 1]", () => {
    const profileVec = makeVec(32, 1);
    const jobVec = makeVec(32, 1); // identical → high similarity
    const result = compositeScoreWithEmbedding(
      makeProfile(),
      makeJob(),
      profileVec,
      jobVec,
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it("scores higher when profile and job vectors are similar", () => {
    const similarVec = makeVec(32, 1);
    const dissimilarVec = makeVec(32, 100); // very different direction

    const highScore = compositeScoreWithEmbedding(
      makeProfile(), makeJob(), similarVec, similarVec,
    );
    const lowScore = compositeScoreWithEmbedding(
      makeProfile(), makeJob(), similarVec, dissimilarVec,
    );

    expect(highScore.total).toBeGreaterThan(lowScore.total);
  });

  it("includes keyword, embedding, experience, salary, work_mode in breakdown", () => {
    const v = makeVec(32, 1);
    const result = compositeScoreWithEmbedding(makeProfile(), makeJob(), v, v);
    expect(result.breakdown).toHaveProperty("keyword");
    expect(result.breakdown).toHaveProperty("embedding");
    expect(result.breakdown).toHaveProperty("experience");
    expect(result.breakdown).toHaveProperty("salary");
    expect(result.breakdown).toHaveProperty("work_mode");
  });

  it("returns zero score for zero embedding similarity and zero keyword overlap", () => {
    const profile: UserProfile = {
      ...emptyProfile(),
      skills: ["zzz-unique-skill-xyz"],
      target_roles: [],
      resume_summary: null,
    };
    const job = makeJob({ title: "aaa-unrelated", description: "bbb-unrelated content here" });
    const profileVec = new Float32Array(32).fill(0); // zero → cosine = 0
    const jobVec = new Float32Array(32).fill(0);
    const result = compositeScoreWithEmbedding(profile, job, profileVec, jobVec);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rankJobsWithEmbeddings
// ---------------------------------------------------------------------------

describe("rankJobsWithEmbeddings", () => {
  let designJob: NormalizedJob;
  let pmJob: NormalizedJob;
  let profile: UserProfile;
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    designJob = makeJob({
      job_id: "design-1",
      title: "Senior Product Designer",
      description: "Figma, design systems, UX research.",
    });
    pmJob = makeJob({
      job_id: "pm-1",
      title: "Operations Project Manager",
      description: "Project management, PMP, stakeholder planning.",
    });
    profile = makeProfile();

    // Profile text seed = 1, design job seed = 1 (high similarity), PM job seed = 50 (low)
    const textToSeed = new Map<string, number>([
      [buildProfileEmbeddingText(profile), 1],
      [buildJobEmbeddingText(designJob), 1],
      [buildJobEmbeddingText(pmJob), 50],
    ]);
    provider = new MockEmbeddingProvider(textToSeed);
  });

  it("ranks the semantically similar job above the dissimilar one", async () => {
    const results = await rankJobsWithEmbeddings(
      [designJob, pmJob],
      profile,
      { embeddingProvider: provider },
    );

    expect(results.length).toBe(2);
    expect(results[0]!.job.job_id).toBe("design-1");
    expect(results[1]!.job.job_id).toBe("pm-1");
  });

  it("respects the limit parameter", async () => {
    const jobs = [designJob, pmJob];
    const results = await rankJobsWithEmbeddings(jobs, profile, {
      embeddingProvider: provider,
      limit: 1,
    });
    expect(results.length).toBe(1);
  });

  it("returns empty array for empty job list", async () => {
    const results = await rankJobsWithEmbeddings([], profile, {
      embeddingProvider: provider,
    });
    expect(results).toEqual([]);
  });

  it("includes matched_keywords and gap_keywords in each result", async () => {
    const results = await rankJobsWithEmbeddings([designJob], profile, {
      embeddingProvider: provider,
    });
    expect(results[0]).toHaveProperty("matched_keywords");
    expect(results[0]).toHaveProperty("gap_keywords");
  });
});
