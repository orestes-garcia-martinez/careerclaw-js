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

  it("resolves design tool aliases", () => {
    expect(getCanonicalSkill("a11y")).toBe("accessibility");
    expect(getCanonicalSkill("wcag")).toBe("accessibility");
    expect(getCanonicalSkill("ux")).toBe("ux design");
    expect(getCanonicalSkill("ixd")).toBe("interaction design");
    expect(getCanonicalSkill("ia")).toBe("information architecture");
    expect(getCanonicalSkill("product designer")).toBe("product design");
    expect(getCanonicalSkill("design system")).toBe("design systems");
    expect(getCanonicalSkill("user research")).toBe("ux research");
  });

  it("expands design skills to related terms", () => {
    const expanded = expandSkills(["figma"]);
    expect(expanded).toContain("prototyping");
    expect(expanded).toContain("wireframing");
    expect(expanded).toContain("ui design");

    const a11y = expandSkills(["accessibility"]);
    expect(a11y).toContain("keyboard navigation");
    expect(a11y).toContain("inclusive design");
    expect(a11y).toContain("aria");

    const ds = expandSkills(["design systems"]);
    expect(ds).toContain("component library");
    expect(ds).toContain("storybook");
  });

  it("expands ux design to its full concept cluster", () => {
    const expanded = expandSkills(["ux design"]);
    expect(expanded).toContain("product design");
    expect(expanded).toContain("interaction design");
    expect(expanded).toContain("ux research");
    expect(expanded).toContain("wireframing");
  });

  it("extracts design concepts from job description text", () => {
    const concepts = extractCanonicalSkillsFromText(
      "Looking for a Product Designer with Figma expertise and experience in Design Systems and accessibility."
    );
    expect(concepts).toContain("product design");
    expect(concepts).toContain("figma");
    expect(concepts).toContain("design systems");
    expect(concepts).toContain("accessibility");
  });

  it("returns false for unknown skills", () => {
    expect(isKnownSkill("totally made up skill")).toBe(false);
  });
});
