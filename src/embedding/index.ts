/**
 * embedding/index.ts — Public embedding API.
 *
 * Import from here rather than individual files.
 */

export type { EmbeddingProvider } from "./provider.js";
export { cosineSimilarity } from "./cosine.js";
export { buildProfileEmbeddingText, buildJobEmbeddingText } from "./text-builder.js";
export { warmEmbeddingProvider, getActiveEmbeddingProvider } from "./singleton.js";
