/**
 * embedding/provider.ts — EmbeddingProvider interface.
 *
 * Defines the contract that all embedding backends must satisfy.
 * Implementations: LocalEmbeddingProvider (@xenova/transformers, ONNX).
 * Future: RemoteEmbeddingProvider (OpenAI, Cohere, etc.).
 */

export interface EmbeddingProvider {
  /**
   * Embed a batch of texts into L2-normalized vectors.
   *
   * All texts in the batch are embedded in a single forward pass.
   * Returns one Float32Array per input text, each of length `dimensions`.
   * Vectors are L2-normalized — cosine similarity equals the dot product.
   */
  embed(texts: string[]): Promise<Float32Array[]>;

  /** Dimensionality of the output vectors (model-specific). */
  readonly dimensions: number;

  /** Hugging Face model identifier (e.g. "Xenova/all-MiniLM-L6-v2"). */
  readonly modelName: string;
}
