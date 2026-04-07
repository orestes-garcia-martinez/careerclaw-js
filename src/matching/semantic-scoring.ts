import type {
  NormalizedJob,
  ResumeIntelligence,
  UserProfile,
} from "../models.js";
import { SEMANTIC_MATCHING } from "../config.js";
import {
  extractCanonicalSkillsFromText,
  expandCanonicalSkills,
  expandSkills,
} from "../core/skill-taxonomy.js";
import {
  extractPhrasesFromText,
  tokenizeUnique,
} from "../core/text-processing.js";

export interface SemanticScoreResult {
  score: number;
  available: boolean;
  matched: string[];
  gaps: string[];
  matched_concepts: string[];
  gap_concepts: string[];
}

export interface SemanticProfileView {
  lexicalWeights: Map<string, number>;
  semanticConcepts: Set<string>;
  semanticPhrases: Set<string>;
}

export interface SemanticJobView {
  lexicalWeights: Map<string, number>;
  semanticConcepts: Set<string>;
  semanticPhrases: Set<string>;
}

const lexicalViewCache = new Map<string, SemanticProfileView>();

function computeCacheKey(
  profile: UserProfile,
  resumeText?: string,
  resumeIntel?: ResumeIntelligence | null
): string {
  // Use a stable hash based on content that actually affects the view
  const parts = [
    profile.skills.sort().join("|"),
    profile.target_roles.sort().join("|"),
    profile.resume_summary ?? "",
    resumeText?.slice(0, 500) ?? "",  // First 500 chars as fingerprint
    resumeIntel?.extracted_keywords?.join("|") ?? "",
  ];
  return parts.join(":::");
}

export function buildProfileSemanticView(
  profile: UserProfile,
  options: { resumeText?: string; resumeIntel?: ResumeIntelligence | null } = {}
): SemanticProfileView {
  const cacheKey = computeCacheKey(profile, options.resumeText, options.resumeIntel);

  const cached = lexicalViewCache.get(cacheKey);
  if (cached) return cached;

  const lexicalWeights = new Map<string, number>();
  const semanticConcepts = new Set<string>();
  const semanticPhrases = new Set<string>();

  const addText = (text: string, weight: number): void => {
    for (const token of tokenizeUnique(text)) {
      lexicalWeights.set(token, Math.max(weight, lexicalWeights.get(token) ?? 0));
    }
    for (const phrase of extractPhrasesFromText(text)) {
      semanticPhrases.add(phrase);
    }
    for (const concept of extractCanonicalSkillsFromText(text)) {
      semanticConcepts.add(concept);
    }
  };

  // Narrative prose (full resume text) contributes tokens and phrases for
  // lexical overlap, but must NOT feed taxonomy concept extraction. Resume
  // text frequently mentions skills the user doesn't own — e.g. "Worked
  // closely with PM" — which would inject phantom taxonomy clusters
  // (project management, planning, scheduling) into the profile signal.
  const addNarrativeText = (text: string, weight: number): void => {
    for (const token of tokenizeUnique(text)) {
      lexicalWeights.set(token, Math.max(weight, lexicalWeights.get(token) ?? 0));
    }
    for (const phrase of extractPhrasesFromText(text)) {
      semanticPhrases.add(phrase);
    }
  };

  addText(profile.skills.join(" "), 1.0);
  addText(expandSkills(profile.skills).join(" "), 0.9);
  addText(profile.target_roles.join(" "), 0.9);
  addText(profile.resume_summary ?? "", 0.75);

  if (options.resumeText?.trim()) {
    addNarrativeText(options.resumeText, 0.55);
  }

  if (options.resumeIntel) {
    addText(options.resumeIntel.impact_signals.join(" "), 1.0);
    addText(options.resumeIntel.extracted_keywords.join(" "), 0.75);
    addText(options.resumeIntel.extracted_phrases.join(" "), 0.8);
  }

  for (const concept of [...semanticConcepts]) {
    for (const term of expandCanonicalSkills([concept])) {
      const weight = lexicalWeights.has(term) ? lexicalWeights.get(term)! : 0.7;
      lexicalWeights.set(term, Math.max(weight, lexicalWeights.get(term) ?? 0));
    }
  }

  const view = { lexicalWeights, semanticConcepts, semanticPhrases };
  lexicalViewCache.set(cacheKey, view);
  return view;
}

export function buildJobSemanticView(job: NormalizedJob): SemanticJobView {
  const lexicalWeights = new Map<string, number>();
  const semanticConcepts = new Set<string>();
  const semanticPhrases = new Set<string>();

  const addText = (text: string, weight: number): void => {
    for (const token of tokenizeUnique(text)) {
      lexicalWeights.set(token, Math.max(weight, lexicalWeights.get(token) ?? 0));
    }
    for (const phrase of extractPhrasesFromText(text)) {
      semanticPhrases.add(phrase);
    }
    for (const concept of extractCanonicalSkillsFromText(text)) {
      semanticConcepts.add(concept);
    }
  };

  addText(job.title, 1.0);
  addText(job.description, 0.7);

  for (const concept of [...semanticConcepts]) {
    for (const term of expandCanonicalSkills([concept])) {
      const weight = lexicalWeights.has(term) ? lexicalWeights.get(term)! : 0.7;
      lexicalWeights.set(term, Math.max(weight, lexicalWeights.get(term) ?? 0));
    }
  }

  return { lexicalWeights, semanticConcepts, semanticPhrases };
}

export function weightedOverlapScore(
  a: Map<string, number>,
  b: Map<string, number>
): { score: number; matched: string[]; gaps: string[] } {
  if (a.size === 0 || b.size === 0) {
    return { score: 0, matched: [], gaps: [] };
  }

  const keys = new Set([...a.keys(), ...b.keys()]);
  let matchedWeight = 0;
  let unionWeight = 0;
  const matched: string[] = [];
  const gaps: string[] = [];

  for (const key of keys) {
    const aWeight = a.get(key) ?? 0;
    const bWeight = b.get(key) ?? 0;
    unionWeight += Math.max(aWeight, bWeight);
    matchedWeight += Math.min(aWeight, bWeight);
    if (aWeight > 0 && bWeight > 0) matched.push(key);
    if (bWeight > 0 && aWeight === 0) gaps.push(key);
  }

  const score = unionWeight === 0 ? 0 : matchedWeight / unionWeight;
  return {
    score: roundScore(score),
    matched: [...new Set(matched)],
    gaps: [...new Set(gaps)],
  };
}

export function computeSemanticScore(
  profileView: SemanticProfileView,
  jobView: SemanticJobView
): SemanticScoreResult {
  const conceptMatched = [...profileView.semanticConcepts].filter((concept) =>
    jobView.semanticConcepts.has(concept)
  );
  const conceptGaps = [...jobView.semanticConcepts].filter(
    (concept) => !profileView.semanticConcepts.has(concept)
  );

  const phraseMatched = [...profileView.semanticPhrases].filter((phrase) =>
    jobView.semanticPhrases.has(phrase)
  );
  const phraseGaps = [...jobView.semanticPhrases].filter(
    (phrase) => !profileView.semanticPhrases.has(phrase)
  );

  const conceptUnion = new Set([
    ...profileView.semanticConcepts,
    ...jobView.semanticConcepts,
  ]).size;
  const phraseUnion = new Set([
    ...profileView.semanticPhrases,
    ...jobView.semanticPhrases,
  ]).size;

  const conceptScore = conceptUnion === 0 ? 0 : conceptMatched.length / conceptUnion;
  const phraseScore = phraseUnion === 0 ? 0 : phraseMatched.length / phraseUnion;
  const available = conceptUnion > 0 || phraseUnion > 0;

  const { CONCEPT, PHRASE } = SEMANTIC_MATCHING.CONCEPT_PHRASE_WEIGHTS;
  const score = available
    ? roundScore(conceptScore * CONCEPT + phraseScore * PHRASE)
    : 0;

  return {
    score,
    available,
    matched: [...new Set([...conceptMatched, ...phraseMatched])],
    gaps: [...new Set([...conceptGaps, ...phraseGaps])],
    matched_concepts: conceptMatched,
    gap_concepts: conceptGaps,
  };
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
