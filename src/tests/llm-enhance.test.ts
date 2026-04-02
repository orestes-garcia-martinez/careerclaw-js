/**
 * llm-enhance.test.ts — Offline unit tests for enhanceDraft().
 *
 * All tests inject a stubbed fetchFn — no live network calls are made.
 * Tests verify the contract: success path, graceful fallback, circuit
 * breaker, and that raw resume text never appears in outbound requests.
 */

import { describe, it, expect, vi } from "vitest";
import { enhanceDraft, generateCoverLetter } from "../llm-enhance.js";
import type { ChainCandidate } from "../llm-enhance.js";
import type { NormalizedJob, UserProfile, OutreachDraft, ResumeIntelligence } from "../models.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    job_id: "job-test-01",
    title: "Senior TypeScript Engineer",
    company: "Acme",
    location: "Remote",
    description: "TypeScript react node aws engineer role.",
    url: "https://example.com/job/1",
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
    skills: ["typescript", "react", "node"],
    target_roles: ["Senior Engineer"],
    experience_years: 10,
    work_mode: "remote",
    resume_summary: "Senior engineer with 10 years experience.",
    location: null,
    salary_min: null,
    ...overrides,
  };
}

function makeResumeIntel(overrides: Partial<ResumeIntelligence> = {}): ResumeIntelligence {
  return {
    extracted_keywords: ["typescript", "react", "node", "aws"],
    extracted_phrases: ["full-stack development"],
    keyword_stream: ["typescript", "react", "node", "aws"],
    phrase_stream: ["full-stack development"],
    impact_signals: ["typescript", "react", "node"],
    keyword_weights: { typescript: 1.0, react: 1.0, node: 0.8 },
    phrase_weights: { "full-stack development": 0.8 },
    source: "skills_injected",
    ...overrides,
  };
}

function makeDraft(overrides: Partial<OutreachDraft> = {}): OutreachDraft {
  return {
    job_id: "job-test-01",
    subject: "Interest in Senior TypeScript Engineer at Acme",
    body: "Hi Acme team,\n\nI am interested in this role.\n\nBest regards,\n[Your Name]",
    llm_enhanced: false,
    ...overrides,
  };
}

const ANTHROPIC_CHAIN: ChainCandidate[] = [
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", apiKey: "sk-ant-test" },
];

const OPENAI_CHAIN: ChainCandidate[] = [
  { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
];

/** Build a mock fetch that returns a valid LLM response. */
function mockFetchSuccess(responseText: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ type: "text", text: responseText }],
    }),
  } as unknown as Response);
}

/** Build a mock fetch that returns a valid OpenAI-shaped response. */
function mockFetchOpenAISuccess(responseText: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responseText } }],
    }),
  } as unknown as Response);
}

/** Build a mock fetch that always throws a network error. */
function mockFetchFailure(message = "Network error"): typeof fetch {
  return vi.fn().mockRejectedValue(new Error(message));
}

/** Build a mock fetch that returns HTTP 500. */
function mockFetchHttpError(status = 500): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => "Internal server error",
  } as unknown as Response);
}

const VALID_LLM_RESPONSE = `Subject: Senior TypeScript Engineer at Acme — Application

Hi Acme team,

I'm reaching out about the Senior TypeScript Engineer role at Acme. With over 10 years of experience in TypeScript and React development, I have consistently delivered high-quality production systems.

My core strengths in TypeScript and React align directly with what Acme is building. I am comfortable working across the full stack and thrive in collaborative environments.

I would love to discuss how my background fits your team's needs. Happy to share more about relevant work or answer any questions.

Best regards,
[Your Name]`;

// ---------------------------------------------------------------------------
// Success paths
// ---------------------------------------------------------------------------

describe("enhanceDraft — Anthropic success path", () => {
  it("returns a draft with llm_enhanced=true on success", async () => {
    const result = await enhanceDraft(
      makeJob(),
      makeProfile(),
      makeResumeIntel(),
      makeDraft(),
      [],
      { fetchFn: mockFetchSuccess(VALID_LLM_RESPONSE), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.llm_enhanced).toBe(true);
  });

  it("returns extracted subject from LLM response", async () => {
    const result = await enhanceDraft(
      makeJob(),
      makeProfile(),
      makeResumeIntel(),
      makeDraft(),
      [],
      { fetchFn: mockFetchSuccess(VALID_LLM_RESPONSE), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.llm_enhanced).toBe(true);
    expect(result.subject).toContain("Acme");
  });

  it("returns original draft job_id regardless of enhancement", async () => {
    const draft = makeDraft({ job_id: "preserved-id-999" });
    const result = await enhanceDraft(
      makeJob({ job_id: "preserved-id-999" }),
      makeProfile(),
      makeResumeIntel(),
      draft,
      [],
      { fetchFn: mockFetchSuccess(VALID_LLM_RESPONSE), _chainOverride: ANTHROPIC_CHAIN }
    );
    expect(result.job_id).toBe("preserved-id-999");
  });
});

describe("enhanceDraft — OpenAI success path", () => {
  it("parses OpenAI-shaped response and returns enhanced draft", async () => {
    const result = await enhanceDraft(
      makeJob(),
      makeProfile(),
      makeResumeIntel(),
      makeDraft(),
      [],
      { fetchFn: mockFetchOpenAISuccess(VALID_LLM_RESPONSE), _chainOverride: OPENAI_CHAIN }
    );
    expect(result.llm_enhanced).toBe(true);
    expect(result.job_id).toBe("job-test-01");
  });
});

// ---------------------------------------------------------------------------
// Graceful fallback
// ---------------------------------------------------------------------------

describe("enhanceDraft — graceful fallback", () => {
  it("returns original draft when fetch throws", async () => {
    const draft = makeDraft();
    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: mockFetchFailure(), _chainOverride: ANTHROPIC_CHAIN }
    );
    expect(result.llm_enhanced).toBe(false);
    expect(result.subject).toBe(draft.subject);
    expect(result.body).toBe(draft.body);
  });

  it("returns original draft on HTTP 500", async () => {
    const draft = makeDraft();
    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: mockFetchHttpError(500), _chainOverride: ANTHROPIC_CHAIN }
    );
    expect(result.llm_enhanced).toBe(false);
    expect(result.body).toBe(draft.body);
  });

  it("returns original draft when LLM response has no Subject line", async () => {
    const badResponse = "Hi Acme team,\n\nNo subject line here.\n\nBest regards,\n[Your Name]";
    const draft = makeDraft();
    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: mockFetchSuccess(badResponse), _chainOverride: ANTHROPIC_CHAIN }
    );
    expect(result.llm_enhanced).toBe(false);
  });

  it("never throws — even with a completely broken fetchFn", async () => {
    const brokenFetch = () => { throw new TypeError("fetch is not defined"); };
    const draft = makeDraft();
    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: brokenFetch as unknown as typeof fetch, _chainOverride: ANTHROPIC_CHAIN }
    );
    expect(result.llm_enhanced).toBe(false);
    expect(result.job_id).toBe(draft.job_id);
  });
});

describe("enhanceDraft — circuit breaker", () => {
  it("stops calling fetch after LLM_CIRCUIT_BREAKER_FAILS consecutive failures", async () => {
    const failFetch = mockFetchFailure("timeout");
    const draft = makeDraft();

    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: failFetch, _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.llm_enhanced).toBe(false);
    // Must not loop forever — bounded by retries * circuit breaker threshold
    expect((failFetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Privacy — raw resume text must never reach the LLM
// ---------------------------------------------------------------------------

describe("enhanceDraft — privacy", () => {
  it("does not include raw resume text in the fetch payload", async () => {
    const rawResumeText = "CONFIDENTIAL_RESUME_CONTENT_SHOULD_NOT_APPEAR_IN_REQUEST";
    const resumeIntel = makeResumeIntel({ impact_signals: ["typescript", "react"] });

    let capturedBody = "";
    const spyFetch: typeof fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === "string" ? init.body : "";
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: VALID_LLM_RESPONSE }] }),
      } as unknown as Response;
    });

    await enhanceDraft(
      makeJob(),
      makeProfile({ resume_summary: rawResumeText }),
      resumeIntel,
      makeDraft(),
      [],
      { fetchFn: spyFetch, _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(capturedBody).not.toContain(rawResumeText);
  });

  it("does not include full resume_summary in the fetch payload", async () => {
    const longSummary = "A".repeat(500) + " UNIQUE_MARKER_XYZ";

    let capturedBody = "";
    const spyFetch: typeof fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === "string" ? init.body : "";
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: VALID_LLM_RESPONSE }] }),
      } as unknown as Response;
    });

    await enhanceDraft(
      makeJob(),
      makeProfile({ resume_summary: longSummary }),
      makeResumeIntel(),
      makeDraft(),
      [],
      { fetchFn: spyFetch, _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(capturedBody).not.toContain("UNIQUE_MARKER_XYZ");
  });
});

// ---------------------------------------------------------------------------
// No-op when no LLM keys configured
// ---------------------------------------------------------------------------

describe("enhanceDraft — no keys configured", () => {
  it("returns original draft immediately when chain is empty", async () => {
    const noOpFetch = vi.fn();
    const draft = makeDraft();

    const result = await enhanceDraft(
      makeJob(), makeProfile(), makeResumeIntel(), draft, [],
      { fetchFn: noOpFetch as unknown as typeof fetch, _chainOverride: [] }
    );

    expect(result.llm_enhanced).toBe(false);
    expect(result.job_id).toBe(draft.job_id);
    expect(noOpFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cover letter generation — generateCoverLetter()
// ---------------------------------------------------------------------------

const VALID_COVER_LETTER_RESPONSE = `I am writing to apply for the Senior TypeScript Engineer position at Acme. Your team's focus on building reliable, scalable systems is exactly the kind of challenge I thrive on.

Because I have spent the past decade building production TypeScript applications, I can contribute to your engineering velocity from day one. My experience with React and Node has given me deep insight into full-stack architecture decisions that balance developer experience with runtime performance.

I am also drawn to the collaborative culture at Acme. My background in cross-functional delivery means I can bridge the gap between product requirements and technical implementation effectively.

I would welcome the chance to discuss how my experience aligns with your team's goals.

Sincerely,
[Your Name]`;

describe("generateCoverLetter — success path", () => {
  it("returns a cover letter body string on success", async () => {
    const result = await generateCoverLetter(
      makeJob(),
      makeProfile(),
      makeResumeIntel(),
      ["kubernetes", "graphql"],
      { fetchFn: mockFetchSuccess(VALID_COVER_LETTER_RESPONSE), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).not.toBeNull();
    expect(typeof result.result?.body).toBe("string");
    expect(result.result?.body).toContain("Acme");
  });

  it("strips word count annotations from LLM response", async () => {
    const responseWithCount = VALID_COVER_LETTER_RESPONSE + "\n\n[287 words]";
    const result = await generateCoverLetter(
      makeJob(),
      makeProfile(),
      makeResumeIntel(),
      [],
      { fetchFn: mockFetchSuccess(responseWithCount), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).not.toBeNull();
    expect(result.result?.body).not.toContain("[287 words]");
  });
});

describe("generateCoverLetter — fallback", () => {
  it("returns null when fetch throws", async () => {
    const result = await generateCoverLetter(
      makeJob(), makeProfile(), makeResumeIntel(), [],
      { fetchFn: mockFetchFailure(), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).toBeNull();
  });

  it("returns null on HTTP 500", async () => {
    const result = await generateCoverLetter(
      makeJob(), makeProfile(), makeResumeIntel(), [],
      { fetchFn: mockFetchHttpError(500), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).toBeNull();
  });

  it("returns null when chain is empty", async () => {
    const noOpFetch = vi.fn();
    const result = await generateCoverLetter(
      makeJob(), makeProfile(), makeResumeIntel(), [],
      { fetchFn: noOpFetch as unknown as typeof fetch, _chainOverride: [] }
    );

    expect(result.result).toBeNull();
    expect(noOpFetch).not.toHaveBeenCalled();
  });

  it("returns null when response is too short", async () => {
    const result = await generateCoverLetter(
      makeJob(), makeProfile(), makeResumeIntel(), [],
      { fetchFn: mockFetchSuccess("Hi Acme."), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).toBeNull();
  });

  it("returns null when response does not mention the company", async () => {
    const offTopicResponse = "I am writing to apply for a role at TotallyDifferentCompany. " +
      "My background in software engineering makes me a strong candidate. ".repeat(3);
    const result = await generateCoverLetter(
      makeJob(), makeProfile(), makeResumeIntel(), [],
      { fetchFn: mockFetchSuccess(offTopicResponse), _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(result.result).toBeNull();
  });
});

describe("generateCoverLetter — privacy", () => {
  it("does not include raw resume text in the fetch payload", async () => {
    const rawResumeText = "CONFIDENTIAL_RESUME_SHOULD_NOT_APPEAR";
    const resumeIntel = makeResumeIntel({ impact_signals: ["typescript", "react"] });

    let capturedBody = "";
    const spyFetch: typeof fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = typeof init?.body === "string" ? init.body : "";
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: VALID_COVER_LETTER_RESPONSE }] }),
      } as unknown as Response;
    });

    await generateCoverLetter(
      makeJob(),
      makeProfile({ resume_summary: rawResumeText }),
      resumeIntel,
      [],
      { fetchFn: spyFetch, _chainOverride: ANTHROPIC_CHAIN }
    );

    expect(capturedBody).not.toContain(rawResumeText);
  });
});
