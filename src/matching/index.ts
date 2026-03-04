/**
 * matching/index.ts — Public matching API.
 *
 * Import from here rather than individual files.
 */

export { rankJobs } from "./engine.js";
export {
  scoreKeyword,
  scoreExperience,
  scoreSalary,
  scoreWorkMode,
  compositeScore,
  WEIGHTS,
} from "./scoring.js";
