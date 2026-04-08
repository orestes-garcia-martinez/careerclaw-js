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
 *
 * Dimension safety:
 *   - `dimensions` is derived from the model's actual output during
 *     initialize() rather than hardcoded. A probe embed is run immediately
 *     after the pipeline loads so that any model — regardless of its output
 *     size — slices tensors at the correct stride in embed().
 */

import type { EmbeddingProvider } from "./provider.js";

// Dynamically typed to avoid a hard import at module load time.
// The singleton imports this module only when EMBEDDING_PROVIDER=local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipeline = (texts: string | string[], opts: Record<string, unknown>) => Promise<any>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  // Set to the real value after initialize() completes.
  // Reading this before initialize() will throw (pipe guard fires first).
  dimensions: number = 0;
  readonly modelName: string;

  private pipe: Pipeline | null = null;

  // Maximum number of texts per ONNX forward pass. Keeping batches small
  // bounds the activation tensor size during inference (~18 MB at 8 texts ×
  // 256 tokens × 384 dims) and prevents OOM on constrained instances.
  private static readonly BATCH_SIZE = 8;

  constructor(modelName: string = "Xenova/all-MiniLM-L6-v2") {
    this.modelName = modelName;
  }

  /**
   * Load the model from `modelDir` and detect its output dimensionality.
   * Must be called once before `embed()`. Reads model files from disk —
   * no network access.
   *
   * A single probe embed ("probe") is run immediately after the pipeline
   * loads so that `output.dims[1]` is available to set `this.dimensions`
   * before any real batch is processed. This guarantees correct tensor
   * slicing for every model regardless of its output size.
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

    // Derive real output dimensions from the model rather than assuming 384.
    // Any model — MiniLM (384), mpnet-base (768), etc. — will be handled
    // correctly without touching config or constructor arguments.
    const probe = await this.pipe(["probe"], { pooling: "mean", normalize: true });
    this.dimensions = probe.dims[1] as number;
  }

  /**
   * Embed a list of texts and return one L2-normalized Float32Array per input.
   *
   * Inputs are processed in sequential chunks of BATCH_SIZE to keep ONNX
   * activation tensors small. A single pass over all N texts would produce
   * a tensor of shape [N, seqLen, hiddenDim] that can OOM on constrained
   * instances (e.g. 2 GB Lightsail) when N is large. Chunking caps the
   * per-pass memory budget regardless of how many jobs are in the briefing.
   *
   * Tensor stride is read from output.dims[1] on every chunk — consistent
   * with the dimensions derived during initialize().
   */
  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipe) {
      throw new Error(
        "LocalEmbeddingProvider.embed() called before initialize(). " +
        "Call warmEmbeddingProvider() at worker startup.",
      );
    }
    if (texts.length === 0) return [];

    const vectors: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += LocalEmbeddingProvider.BATCH_SIZE) {
      const chunk = texts.slice(i, i + LocalEmbeddingProvider.BATCH_SIZE);
      const output = await this.pipe(chunk, { pooling: "mean", normalize: true });

      // Use output.dims[1] as the authoritative stride for this chunk.
      const dims = output.dims[1] as number;
      for (let j = 0; j < chunk.length; j++) {
        vectors.push(output.data.slice(j * dims, (j + 1) * dims) as Float32Array);
      }
    }

    return vectors;
  }
}
