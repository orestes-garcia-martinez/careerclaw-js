/**
 * scripts/download-model.ts — One-time embedding model download.
 *
 * Run once on the target server after deploying careerclaw-js:
 *
 *   node --env-file=.env node_modules/careerclaw-js/dist/scripts/download-model.js
 *
 * Configuration is read from the same env vars and defaults as the runtime
 * (CAREERCLAW_EMBEDDING_MODEL_DIR, CAREERCLAW_EMBEDDING_MODEL), so the
 * downloaded model is always in the location the worker expects.
 *
 * The model files are written to:
 *   <CAREERCLAW_EMBEDDING_MODEL_DIR>/<org>/<model-name>/
 *
 * This directory persists across npm installs — it is entirely independent
 * of the careerclaw-js package lifecycle.
 *
 * After download, ensure your worker .env contains:
 *   CAREERCLAW_EMBEDDING_PROVIDER=local
 *   CAREERCLAW_EMBEDDING_MODEL_DIR=<same value used here>
 */

import { existsSync, mkdirSync } from "node:fs";
import { EMBEDDING_MODEL_DIR, EMBEDDING_MODEL_NAME } from "../config.js";

// Re-use the exact same defaults as the runtime so the paths always match.
// If CAREERCLAW_EMBEDDING_MODEL_DIR is unset, both this script and
// warmEmbeddingProvider() resolve to the same HOME-relative path.
const modelDir = EMBEDDING_MODEL_DIR;
const modelName = EMBEDDING_MODEL_NAME;

async function main(): Promise<void> {
  console.log(`[careerclaw] Downloading model: ${modelName}`);
  console.log(`[careerclaw] Target directory:  ${modelDir}`);

  if (!existsSync(modelDir)) {
    mkdirSync(modelDir, { recursive: true });
    console.log(`[careerclaw] Created directory: ${modelDir}`);
  }

  const { env, pipeline } = await import("@huggingface/transformers");

  env.cacheDir = modelDir;
  env.allowRemoteModels = true; // allow download — this is the setup script
  env.allowLocalModels = true;

  console.log("[careerclaw] Fetching model files from Hugging Face Hub...");

  await pipeline("feature-extraction", modelName, { dtype: "q8" });

  console.log("[careerclaw] Model downloaded successfully.");
  console.log("[careerclaw] Add to your worker .env:");
  console.log(`  CAREERCLAW_EMBEDDING_PROVIDER=local`);
  console.log(`  CAREERCLAW_EMBEDDING_MODEL_DIR=${modelDir}`);
}

main().catch((err) => {
  console.error("[careerclaw] Download failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
