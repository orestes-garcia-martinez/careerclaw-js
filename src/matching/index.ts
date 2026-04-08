/**
 * matching/index.ts — Public matching API.
 *
 * Import from here rather than individual files.
 */

export { rankJobs, rankJobsHybrid, rankJobsWithEmbeddings } from "./engine.js";
export {
  scoreKeyword,
  scoreExperience,
  scoreSalary,
  scoreWorkMode,
  compositeScore,
  scoreKeywordEnhanced,
  compositeScoreHybrid,
  compositeScoreWithEmbedding,
} from "./scoring.js";
export type { EmbeddingMatchBreakdown } from "./scoring.js";
