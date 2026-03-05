/**
 * llm-enhance.ts — LLM-powered outreach draft enhancement (Pro tier).
 *
 * `enhanceDraft()` replaces the deterministic baseline draft with a
 * personalised LLM-generated version when a valid Pro key is active.
 *
 * Design principles:
 *   - Silent fallback: any failure returns the original draft unchanged.
 *     The function never throws.
 *   - Privacy-first: only extracted keyword signals are sent to the LLM.
 *     Raw resume text is NEVER included in the prompt.
 *   - Failover chain: providers are tried left-to-right from LLM_CHAIN.
 *     Each candidate is retried up to LLM_MAX_RETRIES times before moving
 *     to the next. A circuit breaker opens after LLM_CIRCUIT_BREAKER_FAILS
 *     consecutive failures across the whole chain.
 *   - Testable: the fetch function is injectable so tests run fully offline.
 */

import type { NormalizedJob, UserProfile, OutreachDraft, ResumeIntelligence } from "./models.js";
import {
  LLM_ANTHROPIC_KEY,
  LLM_OPENAI_KEY,
  LLM_API_KEY,
  LLM_CHAIN,
  LLM_MAX_RETRIES,
  LLM_CIRCUIT_BREAKER_FAILS,
  HTTP_TIMEOUT_MS,
} from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainCandidate {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
}

export interface EnhanceOptions {
  /**
   * Injectable fetch — defaults to global fetch.
   * Pass a stub in tests to avoid live network calls.
   */
  fetchFn?: typeof fetch;
  /**
   * Override the resolved provider chain — for testing only.
   * Bypasses env-var key resolution so tests can run without real credentials.
   */
  _chainOverride?: ChainCandidate[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to replace `draft` with an LLM-enhanced version.
 *
 * @param job          - The job being applied to
 * @param profile      - User profile (experience_years used in prompt)
 * @param resumeIntel  - Section-aware keyword signals (impact_signals used)
 * @param draft        - Deterministic baseline to fall back to on failure
 * @param gapKeywords  - Keywords from the job not present in the profile
 * @param options      - Injectable fetch for testing
 * @returns Enhanced draft with llm_enhanced=true, or original draft on failure
 */
export async function enhanceDraft(
  job: NormalizedJob,
  profile: UserProfile,
  resumeIntel: ResumeIntelligence,
  draft: OutreachDraft,
  gapKeywords: string[] = [],
  options: EnhanceOptions = {}
): Promise<OutreachDraft> {
  const fetchFn = options.fetchFn ?? fetch;
  const chain = options._chainOverride ?? buildChain();
  if (chain.length === 0) {
    return draft; // No configured providers — degrade silently
  }

  let consecutiveFails = 0;

  for (const candidate of chain) {
    if (consecutiveFails >= LLM_CIRCUIT_BREAKER_FAILS) {
      break; // Circuit breaker open
    }

    for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
      if (consecutiveFails >= LLM_CIRCUIT_BREAKER_FAILS) break;

      try {
        const prompt = buildPrompt(job, profile, resumeIntel, gapKeywords);
        const text = await callProvider(candidate, prompt, fetchFn);
        const parsed = parseResponse(text, job);
        if (parsed) {
          return { ...draft, subject: parsed.subject, body: parsed.body, llm_enhanced: true };
        }
        // Unparseable response counts as a soft failure — try next attempt
        consecutiveFails++;
      } catch {
        consecutiveFails++;
      }
    }
  }

  return draft; // All candidates exhausted or circuit open — fall back
}

// ---------------------------------------------------------------------------
// Chain construction
// ---------------------------------------------------------------------------

/**
 * Parse LLM_CHAIN into candidates with resolved API keys.
 * Candidates without a usable key are silently skipped.
 *
 * Chain format: "anthropic/claude-haiku-4-5-20251001,openai/gpt-4o-mini"
 */
function buildChain(): ChainCandidate[] {
  return LLM_CHAIN.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): ChainCandidate[] => {
      const slash = entry.indexOf("/");
      if (slash === -1) return [];
      const provider = entry.slice(0, slash).toLowerCase();
      const model = entry.slice(slash + 1);
      if (provider !== "anthropic" && provider !== "openai") return [];

      const apiKey = resolveKey(provider);
      if (!apiKey) return []; // No key for this provider — skip

      return [{ provider, model, apiKey }];
    });
}

function resolveKey(provider: "anthropic" | "openai"): string | undefined {
  if (provider === "anthropic") return LLM_ANTHROPIC_KEY ?? LLM_API_KEY;
  if (provider === "openai")    return LLM_OPENAI_KEY    ?? LLM_API_KEY;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Build the LLM prompt.
 *
 * Only sends keyword signals — never raw resume text.
 * Uses impact_signals (skills + summary section, weight >= 0.8) as the
 * candidate's strength summary, and gap_keywords as what to address.
 */
function buildPrompt(
  job: NormalizedJob,
  profile: UserProfile,
  resumeIntel: ResumeIntelligence,
  gapKeywords: string[] = []
): string {
  const experienceClause =
    profile.experience_years != null
      ? `${profile.experience_years}+ years`
      : "extensive experience";

  const strengths = resumeIntel.impact_signals.slice(0, 12).join(", ") || "software engineering";
  const gaps = gapKeywords.slice(0, 6).join(", ");

  const gapsLine = gaps
    ? `Keywords to acknowledge or address: ${gaps}`
    : "";

  return [
    `Write a concise, professional outreach email for a job application.`,
    ``,
    `Role: ${job.title}`,
    `Company: ${job.company}`,
    `Candidate experience: ${experienceClause}`,
    `Candidate strengths (keywords): ${strengths}`,
    gapsLine,
    ``,
    `Requirements:`,
    `- Subject line on the first line, prefixed with "Subject: "`,
    `- One blank line after the subject`,
    `- 150–220 word body`,
    `- Professional but warm tone`,
    `- Opening: "Hi ${job.company} team,"`,
    `- Closing: "Best regards," followed by "[Your Name]"`,
    `- Do NOT invent specific projects, metrics, or company details`,
    `- Do NOT include placeholders other than [Your Name]`,
    `- Plain text only — no markdown, no bullet points`,
  ]
    .filter((line) => line !== undefined && !(line === "" && gapsLine === "" && line === gapsLine))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Provider API calls
// ---------------------------------------------------------------------------

async function callProvider(
  candidate: ChainCandidate,
  prompt: string,
  fetchFn: typeof fetch
): Promise<string> {
  if (candidate.provider === "anthropic") {
    return callAnthropic(candidate.apiKey, candidate.model, prompt, fetchFn);
  }
  return callOpenAI(candidate.apiKey, candidate.model, prompt, fetchFn);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  fetchFn: typeof fetch
): Promise<string> {
  const res = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Anthropic HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  if (!text) throw new Error("Anthropic: empty response content");
  return text;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  fetchFn: typeof fetch
): Promise<string> {
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI: empty response content");
  return text;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Extract subject and body from raw LLM text.
 *
 * Expected format:
 *   Subject: <subject line>
 *   <blank line>
 *   <body...>
 *
 * Returns null if the response cannot be parsed — caller treats as failure.
 */
function parseResponse(
  text: string,
  job: NormalizedJob
): { subject: string; body: string } | null {
  const lines = text.trim().split(/\r?\n/);

  // Find subject line (must start with "Subject:")
  const subjectIdx = lines.findIndex((l) =>
    l.trimStart().toLowerCase().startsWith("subject:")
  );
  if (subjectIdx === -1) return null;

  const subject = lines[subjectIdx]!
    .replace(/^subject:\s*/i, "")
    .trim();
  if (!subject) return null;

  // Body is everything after the subject (skip blank separator line)
  let bodyStart = subjectIdx + 1;
  while (bodyStart < lines.length && lines[bodyStart]!.trim() === "") {
    bodyStart++;
  }

  const body = lines.slice(bodyStart).join("\n").trim();
  if (!body) return null;

  // Sanity check: body must mention the company (guards against hallucination)
  if (!body.toLowerCase().includes(job.company.toLowerCase().slice(0, 6))) {
    return null;
  }

  return { subject, body };
}
