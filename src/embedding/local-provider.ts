/**
 * embedding/local-provider.ts — Local ONNX embedding provider.
 *
 * Uses @xenova/transformers (ONNX Runtime) to run sentence embedding
 * models entirely on-device. No network calls during inference.
 *
 * Intended use:
 *   1. Download the model once via `scripts/download-model.ts`.
 *   2. Point CAREERCLAW_EMBEDDING_MODEL_DIR at the download directory.
 *   3. The worker calls initialize() at startup — model stays in memory.
 *
 * Runtime safety:
 *   - `allowRemoteModels = false` guarantees no network downloads at runtime.
 *   - If the model directory is missing or corrupted, initialize() throws
 *     and the singleton falls back to hybrid-only scoring.
 */

import type { EmbeddingProvider } from "./provider.js";

// Dynamically typed to avoid a hard import at module load time.
// The singleton imports this module only when EMBEDDING_PROVIDER=local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipeline = (texts: string | string[], opts: Record<string, unknown>) => Promise<any>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName: string;

  private pipe: Pipeline | null = null;

  constructor(
    modelName: string = "Xenova/all-MiniLM-L6-v2",
    dimensions: number = 384,
  ) {
    this.modelName = modelName;
    this.dimensions = dimensions;
  }

  /**
   * Load the model from `modelDir`. Must be called once before `embed()`.
   * Reads model files from disk — no network access.
   *
   * @throws If the model is not found in `modelDir`.
   */
  async initialize(modelDir: string): Promise<void> {
    const { env, pipeline } = await import("@xenova/transformers");

    env.cacheDir = modelDir;
    env.allowRemoteModels = false; // never download at runtime
    env.allowLocalModels = true;

    this.pipe = await pipeline("feature-extraction", this.modelName, {
      quantized: true, // use model_quantized.onnx (~22 MB for MiniLM)
    }) as Pipeline;
  }

  /**
   * Embed a batch of texts in a single ONNX forward pass.
   * Returns one L2-normalized Float32Array per input text.
   */
  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipe) {
      throw new Error(
        "LocalEmbeddingProvider.embed() called before initialize(). " +
        "Call warmEmbeddingProvider() at worker startup.",
      );
    }
    if (texts.length === 0) return [];

    const output = await this.pipe(texts, { pooling: "mean", normalize: true });

    // output.data: Float32Array of length texts.length * dimensions
    // output.dims: [texts.length, dimensions]
    const dims = this.dimensions;
    const vectors: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      vectors.push(output.data.slice(i * dims, (i + 1) * dims) as Float32Array);
    }
    return vectors;
  }
}
