/**
 * embedding/text-builder.ts — Text representations for embedding.
 *
 * Converts structured profile and job objects into single strings
 * that the embedding model can process. The goal is to capture the
 * most semantically dense signal in a compact representation.
 *
 * Profile text order (highest signal first):
 *   target_roles | skills | resume_summary | resumeText[:500]
 *
 * Job text order:
 *   title | description[:1000]
 *
 * The "|" separator gives the model a soft boundary between fields.
 * Description truncation avoids diluting the signal with boilerplate
 * that appears at the end of long job posts.
 */

import type { NormalizedJob, UserProfile } from "../models.js";

export function buildProfileEmbeddingText(
  profile: UserProfile,
  resumeText?: string,
): string {
  const parts: string[] = [];

  if (profile.target_roles.length > 0) {
    parts.push(profile.target_roles.join(", "));
  }
  if (profile.skills.length > 0) {
    parts.push(profile.skills.join(", "));
  }
  if (profile.resume_summary?.trim()) {
    parts.push(profile.resume_summary.trim());
  }
  if (resumeText?.trim()) {
    // First 500 characters capture the professional summary and most recent
    // experience — the highest-signal portion of a resume.
    parts.push(resumeText.trim().slice(0, 500));
  }

  return parts.join(" | ");
}

export function buildJobEmbeddingText(job: NormalizedJob): string {
  // Truncate description to 1000 chars — enough to cover requirements and
  // responsibilities without including boilerplate benefits/EEO text.
  const description = job.description.slice(0, 1_000);
  return `${job.title} | ${description}`;
}
