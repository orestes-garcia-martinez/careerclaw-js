import type { NormalizedJob, SearchOverrides, UserProfile } from "../models.js";

export type RoleFamily =
  | "marketing"
  | "design"
  | "operations"
  | "finance"
  | "engineering"
  | "sales"
  | "data"
  | "product"
  | "customer_success";

export type IndustryFamily =
  | "fintech"
  | "healthcare"
  | "gaming"
  | "ecommerce"
  | "artificial_intelligence"
  | "developer_tools"
  | "saas"
  | "defense";

const ROLE_FAMILY_KEYWORDS: Record<RoleFamily, readonly string[]> = {
  marketing: [
    "marketing",
    "product marketing",
    "growth",
    "demand gen",
    "demand generation",
    "lifecycle",
    "brand",
    "messaging",
    "campaign",
    "seo",
    "content strategy",
    "content marketing",
    "paid acquisition",
  ],
  design: [
    "design",
    "designer",
    "ux",
    "ui",
    "product design",
    "interaction design",
    "design systems",
    "figma",
    "prototype",
    "accessibility",
    "ux writing",
    "storyboard",
    "storyboarding",
    "design qa",
  ],
  operations: [
    "operations",
    "operator",
    "program management",
    "program manager",
    "project management",
    "launch readiness",
    "process design",
    "vendor management",
    "onboarding",
    "support workflow",
    "support workflows",
    "implementation",
    "enablement",
    "service operations",
  ],
  finance: [
    "finance",
    "fp&a",
    "fpa",
    "financial",
    "accounting",
    "accountant",
    "pricing",
    "cash planning",
    "board reporting",
    "revenue analysis",
    "subscription economics",
    "margin",
    "procurement",
    "netsuite",
  ],
  engineering: [
    "engineer",
    "engineering",
    "developer",
    "software",
    "frontend",
    "backend",
    "full-stack",
    "full stack",
    "platform",
    "devops",
    "sre",
    "python",
    "node",
    "typescript",
    "react",
    "ruby on rails",
  ],
  sales: [
    "sales",
    "account executive",
    "sales development",
    "business development",
    "sdr",
    "bdr",
    "revenue generation",
    "pipeline generation",
  ],
  data: [
    "data",
    "analyst",
    "analytics engineer",
    "data scientist",
    "business intelligence",
    "bi",
    "sql analyst",
    "reporting analyst",
  ],
  product: [
    "product manager",
    "product management",
    "product strategy",
    "product lead",
    "go-to-market",
    "gtm",
    "roadmap",
  ],
  customer_success: [
    "customer success",
    "customer operations",
    "implementation manager",
    "account management",
    "customer onboarding",
    "renewal",
    "retention",
    "success manager",
  ],
};

const RELATED_ROLE_FAMILIES: Partial<Record<RoleFamily, readonly RoleFamily[]>> = {
  marketing: ["sales", "product"],
  design: ["product", "engineering"],
  operations: ["customer_success", "product"],
  finance: ["data", "operations"],
  engineering: ["data", "design", "product"],
  sales: ["marketing", "customer_success"],
  data: ["engineering", "finance", "marketing"],
  product: ["design", "engineering", "marketing", "operations"],
  customer_success: ["operations", "sales"],
};

const INDUSTRY_KEYWORDS: Record<IndustryFamily, readonly string[]> = {
  fintech: [
    "fintech",
    "financial technology",
    "payments",
    "payment",
    "banking",
    "bank",
    "deposits",
    "lending",
    "loan",
    "credit",
    "wealth",
    "insurtech",
    "remittance",
  ],
  healthcare: [
    "healthcare",
    "health care",
    "medical",
    "patient",
    "clinical",
    "hospital",
    "provider",
    "medtech",
    "telehealth",
    "care delivery",
  ],
  gaming: [
    "gaming",
    "game",
    "games",
    "game studio",
    "mobile gaming",
    "player acquisition",
  ],
  ecommerce: [
    "ecommerce",
    "e-commerce",
    "commerce",
    "retail",
    "marketplace",
    "merchant",
    "shopping",
    "storefront",
  ],
  artificial_intelligence: [
    "artificial intelligence",
    "machine learning",
    "generative ai",
    "genai",
    "llm",
    "foundation model",
    "model serving",
    "prompt engineering",
  ],
  developer_tools: [
    "developer tools",
    "devtools",
    "api platform",
    "developer platform",
    "observability",
    "ci/cd",
    "sdk",
    "infrastructure for developers",
  ],
  saas: [
    "saas",
    "software as a service",
    "b2b software",
    "workflow software",
    "subscription software",
  ],
  defense: [
    "defense",
    "defence",
    "aerospace",
    "dod",
    "clearance",
    "government contractor",
    "national security",
  ],
};

export interface ExplicitIntentProfile {
  roleFamilies: RoleFamily[];
  requestedIndustry: IndustryFamily | null;
}

interface InferFamiliesOptions {
  maxFamilies?: number | null;
}

export function buildExplicitIntentProfile(
  profile: UserProfile,
  overrides?: SearchOverrides,
): ExplicitIntentProfile {
  const requestedIndustry = normalizeRequestedIndustry(
    overrides?.target_industry ?? profile.target_industry ?? null,
  );

  return {
    roleFamilies: inferRoleFamiliesFromTargetRolesForGate(profile),
    requestedIndustry,
  };
}

export function inferRoleFamiliesFromProfile(profile: UserProfile): RoleFamily[] {
  const text = [
    ...profile.target_roles,
    ...profile.skills,
    profile.resume_summary ?? "",
  ].join(" ");
  return inferRoleFamilies(text);
}

export function inferRoleFamiliesFromTargetRoles(profile: UserProfile): RoleFamily[] {
  return inferRoleFamilies(profile.target_roles.join(" "));
}

export function inferRoleFamiliesFromTargetRolesForGate(profile: UserProfile): RoleFamily[] {
  return inferRoleFamilies(profile.target_roles.join(" "), { maxFamilies: null });
}

export function inferRoleFamiliesFromJob(job: NormalizedJob): RoleFamily[] {
  const titleFamilies = inferRoleFamilies(job.title);
  if (titleFamilies.length > 0) {
    return titleFamilies;
  }

  return inferRoleFamilies(`${job.title} ${job.description}`);
}

export function inferRoleFamiliesFromJobForGate(job: NormalizedJob): RoleFamily[] {
  const titleFamilies = inferRoleFamilies(job.title, { maxFamilies: null });
  if (titleFamilies.length > 0) {
    return titleFamilies;
  }

  return inferRoleFamilies(`${job.title} ${job.description}`, { maxFamilies: null });
}

export function roleFamilyCompatibility(a: RoleFamily, b: RoleFamily): number {
  if (a === b) {
    return 1.0;
  }

  if (RELATED_ROLE_FAMILIES[a]?.includes(b) || RELATED_ROLE_FAMILIES[b]?.includes(a)) {
    return 0.35;
  }

  return 0.05;
}

export function normalizeRequestedIndustry(industry: string | null | undefined): IndustryFamily | null {
  if (!industry) {
    return null;
  }

  return inferIndustries(industry)[0] ?? null;
}

export function inferIndustriesFromJob(job: NormalizedJob): IndustryFamily[] {
  return inferIndustries(`${job.company} ${job.title} ${job.description}`);
}

function inferRoleFamilies(text: string, options: InferFamiliesOptions = {}): RoleFamily[] {
  return inferFamilies(text, ROLE_FAMILY_KEYWORDS, options);
}

function inferIndustries(text: string, options: InferFamiliesOptions = {}): IndustryFamily[] {
  return inferFamilies(text, INDUSTRY_KEYWORDS, options);
}

function inferFamilies<TFamily extends string>(
  text: string,
  keywordMap: Record<TFamily, readonly string[]>,
  options: InferFamiliesOptions = {},
): TFamily[] {
  const { maxFamilies = 2 } = options;
  const haystack = text.toLowerCase();
  const scored = (Object.entries(keywordMap) as Array<[TFamily, readonly string[]]>)
    .map(([family, keywords]) => {
      const score = keywords.reduce((sum, keyword) => sum + countKeywordHits(haystack, keyword), 0);
      return { family, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [];
  }

  const topScore = scored[0]!.score;
  const matchedFamilies = scored
    .filter((entry) => entry.score >= Math.max(1, topScore * 0.6))
    .map((entry) => entry.family);

  if (maxFamilies === null) {
    return matchedFamilies;
  }

  return matchedFamilies.slice(0, maxFamilies);
}

function countKeywordHits(haystack: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches?.length ?? 0;
}
