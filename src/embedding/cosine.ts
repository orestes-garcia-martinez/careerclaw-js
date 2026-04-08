/**
 * embedding/cosine.ts — Cosine similarity for pre-normalized vectors.
 *
 * Because the LocalEmbeddingProvider requests `normalize: true` from the
 * ONNX pipeline, every output vector already has unit L2 norm.
 * For unit vectors: cosine_similarity(a, b) = dot_product(a, b).
 *
 * Result is clamped to [0, 1]. Sentence embeddings never produce negative
 * similarity in practice, but floating-point drift can push a value
 * infinitesimally below 0.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(0, Math.min(1, dot));
}
