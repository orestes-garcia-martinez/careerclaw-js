/**
 * matching/index.ts — Public matching API.
 *
 * Import from here rather than individual files.
 */

export { rankJobs, rankJobsHybrid } from "./engine.js";
export {
  scoreKeyword,
  scoreExperience,
  scoreSalary,
  scoreWorkMode,
  compositeScore,
  scoreKeywordEnhanced,
  compositeScoreHybrid,
} from "./scoring.js";
