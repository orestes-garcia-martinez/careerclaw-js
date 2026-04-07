import {
  extractPhrasesFromText,
  tokenizeUnique,
} from "./text-processing.js";

export interface SkillNode {
  aliases: string[];
  related: string[];
  credentials?: string[];
  parent?: string;
}

/**
 * Focused cross-industry taxonomy for Phase 1 semantic matching.
 *
 * This is intentionally curated rather than exhaustive. It should cover
 * the highest-signal alias / credential / abbreviation patterns that cause
 * obvious false negatives in job matching today.
 */
export const SKILL_TAXONOMY: Record<string, SkillNode> = {
  // Healthcare
  "registered nurse": {
    aliases: ["rn", "nurse", "nursing"],
    related: ["patient care", "clinical", "healthcare"],
    credentials: ["nclex-rn", "bsn", "msn"],
    parent: "healthcare",
  },
  "licensed practical nurse": {
    aliases: ["lpn", "lvn", "licensed vocational nurse"],
    related: ["patient care", "nursing", "healthcare"],
    credentials: ["nclex-pn"],
    parent: "healthcare",
  },
  "certified nursing assistant": {
    aliases: ["cna", "nursing assistant", "nurse aide"],
    related: ["patient care", "nursing", "healthcare"],
    parent: "healthcare",
  },
  "emr": {
    aliases: ["ehr", "electronic medical records", "electronic health records", "epic", "cerner"],
    related: ["healthcare it", "clinical documentation", "medical records"],
    parent: "healthcare",
  },
  "bls": {
    aliases: ["basic life support"],
    related: ["cpr", "first aid", "healthcare"],
    credentials: ["bls certification"],
    parent: "healthcare",
  },
  "acls": {
    aliases: ["advanced cardiac life support"],
    related: ["emergency medicine", "critical care", "healthcare"],
    credentials: ["acls certification"],
    parent: "healthcare",
  },

  // Finance
  "certified public accountant": {
    aliases: ["cpa", "public accountant", "accountant"],
    related: ["accounting", "auditing", "tax", "gaap", "finance"],
    credentials: ["cpa license"],
    parent: "finance",
  },
  "chartered financial analyst": {
    aliases: ["cfa"],
    related: ["finance", "valuation", "investment analysis", "portfolio management"],
    parent: "finance",
  },
  "quickbooks": {
    aliases: ["qb", "qbo", "quickbooks online"],
    related: ["bookkeeping", "accounting software"],
    parent: "finance",
  },

  // Project / operations
  "project management": {
    aliases: ["project manager", "pm"],
    related: ["planning", "scheduling", "stakeholder management", "budgeting"],
    credentials: ["pmp", "capm", "prince2"],
    parent: "operations",
  },
  "pmp": {
    aliases: ["project management professional"],
    related: ["project management", "pmi"],
    credentials: ["pmp certified"],
    parent: "operations",
  },
  "agile": {
    aliases: ["agile methodology", "agile development"],
    related: ["scrum", "kanban", "sprint"],
    credentials: ["csm", "psm", "safe"],
    parent: "operations",
  },
  "scrum": {
    aliases: ["scrum master", "scrum methodology"],
    related: ["agile", "sprint", "project management"],
    credentials: ["csm", "psm"],
    parent: "operations",
  },
  "six sigma": {
    aliases: ["6 sigma", "lean six sigma"],
    related: ["process improvement", "quality", "continuous improvement"],
    credentials: ["six sigma green belt", "six sigma black belt"],
    parent: "operations",
  },

  // Technology
  "typescript": {
    aliases: ["ts"],
    related: ["javascript", "frontend", "nodejs"],
    parent: "technology",
  },
  "javascript": {
    aliases: ["js", "ecmascript", "es6"],
    related: ["typescript", "frontend", "nodejs", "web development"],
    parent: "technology",
  },
  "react": {
    aliases: ["reactjs", "react js", "react.js"],
    related: ["javascript", "frontend", "jsx", "hooks"],
    parent: "technology",
  },
  "angular": {
    aliases: ["angularjs", "angular js", "angular.js"],
    related: ["typescript", "frontend", "spa"],
    parent: "technology",
  },
  "vue": {
    aliases: ["vuejs", "vue js", "vue.js"],
    related: ["javascript", "frontend", "spa"],
    parent: "technology",
  },
  "nodejs": {
    aliases: ["node", "node.js", "node js"],
    related: ["javascript", "backend", "server-side"],
    parent: "technology",
  },
  "python": {
    aliases: ["python3", "py"],
    related: ["django", "flask", "data science", "machine learning"],
    parent: "technology",
  },
  "aws": {
    aliases: ["amazon web services"],
    related: ["cloud", "ec2", "s3", "lambda", "infrastructure"],
    credentials: ["aws certified", "aws solutions architect", "aws developer"],
    parent: "technology",
  },
  "azure": {
    aliases: ["microsoft azure"],
    related: ["cloud", "infrastructure", "devops"],
    credentials: ["azure certified", "az-900", "az-104"],
    parent: "technology",
  },
  "gcp": {
    aliases: ["google cloud", "google cloud platform"],
    related: ["cloud", "infrastructure", "devops"],
    credentials: ["google cloud certified"],
    parent: "technology",
  },
  "docker": {
    aliases: [],
    related: ["containers", "containerization", "devops", "kubernetes"],
    parent: "technology",
  },
  "kubernetes": {
    aliases: ["k8s"],
    related: ["containers", "orchestration", "docker", "devops"],
    credentials: ["cka", "ckad"],
    parent: "technology",
  },
  "ci/cd": {
    aliases: ["cicd", "continuous integration", "continuous delivery", "continuous deployment"],
    related: ["github actions", "jenkins", "devops"],
    parent: "technology",
  },
  "machine learning": {
    aliases: ["ml"],
    related: ["artificial intelligence", "ai", "data science", "deep learning"],
    parent: "technology",
  },
  "artificial intelligence": {
    aliases: ["ai"],
    related: ["machine learning", "ml", "nlp", "computer vision"],
    parent: "technology",
  },
  "sql": {
    aliases: ["structured query language"],
    related: ["postgresql", "mysql", "database"],
    parent: "technology",
  },
  "postgresql": {
    aliases: ["postgres", "psql"],
    related: ["sql", "database"],
    parent: "technology",
  },
  "full stack": {
    aliases: ["fullstack", "full-stack"],
    related: ["frontend", "backend", "web development"],
    parent: "technology",
  },
  "devops": {
    aliases: ["dev ops", "devsecops"],
    related: ["ci/cd", "infrastructure", "automation", "cloud"],
    parent: "technology",
  },
  "rest api": {
    aliases: ["rest", "restful", "restful api"],
    related: ["api", "web services", "http"],
    parent: "technology",
  },

  // Trades / engineering
  "hvac": {
    aliases: ["heating ventilation air conditioning", "hvac technician"],
    related: ["mechanical systems", "refrigeration", "building systems"],
    credentials: ["epa 608", "hvac certification"],
    parent: "trades",
  },
  "electrician": {
    aliases: ["electrical technician", "electrical work"],
    related: ["electrical systems", "wiring", "nec code"],
    credentials: ["journeyman electrician", "master electrician"],
    parent: "trades",
  },
  "plumbing": {
    aliases: ["plumber", "plumbing technician"],
    related: ["pipe fitting", "water systems", "drainage"],
    credentials: ["journeyman plumber", "master plumber"],
    parent: "trades",
  },

  // Design / UX
  "figma": {
    aliases: [],
    related: ["sketch", "adobe xd", "invision", "prototyping", "ui design", "wireframing"],
    parent: "design",
  },
  "sketch": {
    aliases: [],
    related: ["figma", "adobe xd", "ui design", "wireframing"],
    parent: "design",
  },
  "storybook": {
    aliases: [],
    related: ["design systems", "component library", "frontend"],
    parent: "design",
  },
  "product design": {
    aliases: ["product designer"],
    related: ["ux design", "ui design", "interaction design", "design systems", "user experience"],
    parent: "design",
  },
  "ux design": {
    aliases: ["ux", "user experience design", "user experience", "uxd"],
    related: ["product design", "interaction design", "ui design", "ux research", "usability", "wireframing", "prototyping"],
    parent: "design",
  },
  "ui design": {
    aliases: ["ui", "user interface design", "user interface"],
    related: ["ux design", "figma", "design systems", "frontend"],
    parent: "design",
  },
  "design systems": {
    aliases: ["design system"],
    related: ["component library", "storybook", "figma", "ui design"],
    parent: "design",
  },
  "ux research": {
    aliases: ["user research", "usability research", "ux researcher", "user experience research"],
    related: ["usability testing", "user interviews", "ux design"],
    parent: "design",
  },
  "interaction design": {
    aliases: ["ixd"],
    related: ["ux design", "ui design", "prototyping", "wireframing"],
    parent: "design",
  },
  "accessibility": {
    aliases: ["a11y", "wcag", "web accessibility"],
    related: ["inclusive design", "aria", "keyboard navigation", "screen reader"],
    credentials: ["cpacc", "was"],
    parent: "design",
  },
  "information architecture": {
    aliases: ["ia"],
    related: ["ux design", "navigation design", "wireframing", "content strategy"],
    parent: "design",
  },

  // Sales / marketing / HR
  "digital marketing": {
    aliases: ["online marketing", "internet marketing"],
    related: ["seo", "sem", "content marketing", "social media marketing"],
    parent: "business",
  },
  "crm": {
    aliases: ["customer relationship management", "salesforce", "hubspot"],
    related: ["sales", "account management", "customer success"],
    parent: "business",
  },
  "salesforce": {
    aliases: ["sfdc"],
    related: ["crm", "sales operations"],
    credentials: ["salesforce certified administrator", "salesforce certified developer"],
    parent: "business",
  },
  "human resources": {
    aliases: ["hr", "people ops", "people operations"],
    related: ["recruiting", "employee relations", "benefits"],
    parent: "business",
  },
  "recruiting": {
    aliases: ["recruiter", "talent acquisition", "staffing"],
    related: ["human resources", "sourcing", "hiring"],
    parent: "business",
  },
};

const canonicalKeys = new Set<string>();
const aliasToCanonical = new Map<string, string>();

for (const [canonical, node] of Object.entries(SKILL_TAXONOMY)) {
  const normalizedCanonical = normalizeSkill(canonical);
  canonicalKeys.add(normalizedCanonical);
  aliasToCanonical.set(normalizedCanonical, normalizedCanonical);

  for (const alias of node.aliases) {
    aliasToCanonical.set(normalizeSkill(alias), normalizedCanonical);
  }

  for (const credential of node.credentials ?? []) {
    aliasToCanonical.set(normalizeSkill(credential), normalizedCanonical);
  }
}

export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[._]/g, "")
    .replace(/[\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCanonicalSkill(skill: string): string | null {
  const normalized = normalizeSkill(skill);
  return aliasToCanonical.get(normalized) ?? null;
}

export function getSkillAliases(skill: string): string[] {
  const canonical = getCanonicalSkill(skill) ?? normalizeSkill(skill);
  const node = SKILL_TAXONOMY[canonical];
  return node ? [...node.aliases] : [];
}

export function getRelatedSkills(skill: string): string[] {
  const canonical = getCanonicalSkill(skill) ?? normalizeSkill(skill);
  const node = SKILL_TAXONOMY[canonical];
  return node ? [...node.related] : [];
}

export function getCredentials(skill: string): string[] {
  const canonical = getCanonicalSkill(skill) ?? normalizeSkill(skill);
  const node = SKILL_TAXONOMY[canonical];
  return node?.credentials ? [...node.credentials] : [];
}

export function expandSkills(skills: string[]): string[] {
  const expanded = new Set<string>();

  for (const raw of skills) {
    const normalized = normalizeSkill(raw);
    if (!normalized) continue;

    const canonical = getCanonicalSkill(normalized) ?? normalized;
    expanded.add(canonical);
    expanded.add(raw.toLowerCase().trim());

    for (const alias of getSkillAliases(canonical)) expanded.add(alias);
    for (const related of getRelatedSkills(canonical)) expanded.add(related);
    for (const credential of getCredentials(canonical)) expanded.add(credential);
  }

  return [...expanded];
}

export function extractCanonicalSkillsFromText(text: string): string[] {
  if (!text.trim()) return [];

  const candidates = new Set<string>();
  candidates.add(normalizeSkill(text));

  for (const token of tokenizeUnique(text)) {
    candidates.add(normalizeSkill(token));
  }

  for (const phrase of extractPhrasesFromText(text)) {
    candidates.add(normalizeSkill(phrase));
  }

  const matches = new Set<string>();
  for (const candidate of candidates) {
    const canonical = getCanonicalSkill(candidate);
    if (canonical) matches.add(canonical);
  }

  return [...matches];
}

export function expandCanonicalSkills(canonicalSkills: string[]): string[] {
  const expanded = new Set<string>();

  for (const canonical of canonicalSkills) {
    const normalized = getCanonicalSkill(canonical) ?? normalizeSkill(canonical);
    expanded.add(normalized);

    const node = SKILL_TAXONOMY[normalized];
    if (!node) continue;

    for (const alias of node.aliases) expanded.add(alias);
    for (const related of node.related) expanded.add(related);
    for (const credential of node.credentials ?? []) expanded.add(credential);
    if (node.parent) expanded.add(node.parent);
  }

  return [...expanded];
}

export function isKnownSkill(skill: string): boolean {
  return canonicalKeys.has(normalizeSkill(skill)) || aliasToCanonical.has(normalizeSkill(skill));
}
