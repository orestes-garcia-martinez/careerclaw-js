/**
 * scripts/download-model.ts — One-time embedding model download.
 *
 * Run once on the target server after deploying careerclaw-js:
 *
 *   node node_modules/careerclaw-js/dist/scripts/download-model.js
 *
 * Reads configuration from environment variables (or .env file when
 * launched via `node --env-file=.env dist/scripts/download-model.js`):
 *
 *   CAREERCLAW_EMBEDDING_MODEL_DIR   Target directory (required)
 *   CAREERCLAW_EMBEDDING_MODEL       Model name (default: Xenova/all-MiniLM-L6-v2)
 *
 * The model files are written to:
 *   <CAREERCLAW_EMBEDDING_MODEL_DIR>/<org>/<model-name>/
 *
 * This directory persists across npm installs — it is entirely independent
 * of the careerclaw-js package lifecycle.
 *
 * After download, set in your worker .env:
 *   CAREERCLAW_EMBEDDING_PROVIDER=local
 *   CAREERCLAW_EMBEDDING_MODEL_DIR=<same path used here>
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const modelDir =
  process.env["CAREERCLAW_EMBEDDING_MODEL_DIR"] ??
  join(process.env["HOME"] ?? process.cwd(), "careerclaw-workspace", "models");

const modelName =
  process.env["CAREERCLAW_EMBEDDING_MODEL"] ?? "Xenova/all-MiniLM-L6-v2";

async function main(): Promise<void> {
  console.log(`[careerclaw] Downloading model: ${modelName}`);
  console.log(`[careerclaw] Target directory:  ${modelDir}`);

  if (!existsSync(modelDir)) {
    mkdirSync(modelDir, { recursive: true });
    console.log(`[careerclaw] Created directory: ${modelDir}`);
  }

  const { env, pipeline } = await import("@xenova/transformers");

  env.cacheDir = modelDir;
  env.allowRemoteModels = true;  // allow download — this is the setup script
  env.allowLocalModels = true;

  console.log("[careerclaw] Fetching model files from Hugging Face Hub...");

  await pipeline("feature-extraction", modelName, { quantized: true });

  console.log("[careerclaw] Model downloaded successfully.");
  console.log(`[careerclaw] Add to your worker .env:`);
  console.log(`  CAREERCLAW_EMBEDDING_PROVIDER=local`);
  console.log(`  CAREERCLAW_EMBEDDING_MODEL_DIR=${modelDir}`);
}

main().catch((err) => {
  console.error("[careerclaw] Download failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
