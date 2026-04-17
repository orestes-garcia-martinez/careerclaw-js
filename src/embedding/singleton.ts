/**
 * embedding/singleton.ts — Module-level embedding provider singleton.
 *
 * `warmEmbeddingProvider()` is called once at worker startup to load the
 * model from disk into memory. All subsequent briefing calls find the
 * already-initialized provider here via `getActiveEmbeddingProvider()`.
 *
 * Lifecycle:
 *   startup  → warmEmbeddingProvider() → model loads from disk (~2–3 s)
 *   requests → getActiveEmbeddingProvider() → instant, returns cached instance
 *   fallback → if provider is null, briefing falls back to rankJobsHybrid
 *
 * The @huggingface/transformers module is imported dynamically only when
 * CAREERCLAW_EMBEDDING_PROVIDER=local. When set to "none" the heavy
 * ONNX runtime is never loaded, keeping cold-start overhead minimal.
 */

import {
  EMBEDDING_MODEL_DIR,
  EMBEDDING_MODEL_NAME,
  EMBEDDING_PROVIDER,
} from "../config.js";
import type { EmbeddingProvider } from "./provider.js";

let _provider: EmbeddingProvider | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Pre-warm the embedding provider at worker startup.
 *
 * Safe to call multiple times — the initialization runs only once.
 * If CAREERCLAW_EMBEDDING_PROVIDER=none, returns immediately.
 * If the model directory is missing, logs a warning and falls back.
 */
export async function warmEmbeddingProvider(): Promise<void> {
  if (EMBEDDING_PROVIDER === "none") return;

  // Deduplicate concurrent calls (e.g., tests that call warm twice)
  if (_initPromise) {
    await _initPromise;
    return;
  }

  _initPromise = (async () => {
    try {
      const { LocalEmbeddingProvider } = await import("./local-provider.js");
      const provider = new LocalEmbeddingProvider(EMBEDDING_MODEL_NAME);
      await provider.initialize(EMBEDDING_MODEL_DIR);
      _provider = provider;
      console.log(
        `[careerclaw] Embedding provider ready: ${EMBEDDING_MODEL_NAME} ` +
        `(${provider.dimensions} dims) from ${EMBEDDING_MODEL_DIR}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[careerclaw] Embedding provider failed to load: ${message}\n` +
        `[careerclaw] Run 'node node_modules/careerclaw-js/dist/scripts/download-model.js' ` +
        `to download the model, then restart the worker.\n` +
        `[careerclaw] Falling back to hybrid-only scoring.`,
      );
      _provider = null;
    }
  })();

  await _initPromise;
}

/**
 * Returns the active embedding provider, or null if not available.
 * Null causes the briefing pipeline to fall back to rankJobsHybrid.
 */
export function getActiveEmbeddingProvider(): EmbeddingProvider | null {
  return _provider;
}

/**
 * Reset singleton state — for testing only.
 * @internal
 */
export function _resetEmbeddingProvider(): void {
  _provider = null;
  _initPromise = null;
}
