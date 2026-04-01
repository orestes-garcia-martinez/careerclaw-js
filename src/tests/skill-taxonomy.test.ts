import { describe, expect, it } from "vitest";
import {
  expandSkills,
  extractCanonicalSkillsFromText,
  getCanonicalSkill,
  getCredentials,
  getRelatedSkills,
  isKnownSkill,
  normalizeSkill,
} from "../core/skill-taxonomy.js";

describe("skill taxonomy", () => {
  it("normalizes common punctuation variations", () => {
    expect(normalizeSkill(" React.js ")).toBe("reactjs");
    expect(normalizeSkill("CI/CD")).toBe("cicd");
  });

  it("resolves aliases to canonical skills", () => {
    expect(getCanonicalSkill("rn")).toBe("registered nurse");
    expect(getCanonicalSkill("react.js")).toBe("react");
    expect(getCanonicalSkill("project management professional")).toBe("pmp");
  });

  it("expands healthcare aliases and related terms", () => {
    const expanded = expandSkills(["rn"]);
    expect(expanded).toContain("registered nurse");
    expect(expanded).toContain("nursing");
    expect(expanded).toContain("patient care");
  });

  it("expands finance credentials", () => {
    const expanded = expandSkills(["cpa"]);
    expect(expanded).toContain("certified public accountant");
    expect(expanded).toContain("accounting");
    expect(getCredentials("cpa")).toContain("cpa license");
  });

  it("expands tech aliases and related skills", () => {
    const expanded = expandSkills(["k8s"]);
    expect(expanded).toContain("kubernetes");
    expect(expanded).toContain("docker");
  });

  it("supports trades and operations aliases", () => {
    expect(getRelatedSkills("hvac")).toContain("refrigeration");
    expect(expandSkills(["pmp"])).toContain("project management");
  });

  it("extracts canonical concepts from text", () => {
    const concepts = extractCanonicalSkillsFromText(
      "Seeking RN with active BSN and patient care experience."
    );
    expect(concepts).toContain("registered nurse");
  });

  it("returns false for unknown skills", () => {
    expect(isKnownSkill("totally made up skill")).toBe(false);
  });
});
