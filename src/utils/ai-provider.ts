/**
 * Centralized AI provider configuration and error handling
 */

import { provider } from "../provider.js";

/**
 * Sets up the AI provider with the specified model
 *
 * @param providerName The name of the AI provider to use
 * @param model A single model name or an array of model names
 * @param modelIndex Optional index to use a specific model from the array (defaults to 0)
 * @returns The configured AI provider
 */
export function handleProviderSetup(
  providerName: string,
  model: string | string[],
  modelIndex?: number,
) {
  try {
    // If model is an array, use the specified model index or default to the first model
    const modelToUse = Array.isArray(model) ? model[modelIndex ?? 0] : model;

    return provider(providerName)(modelToUse);
  } catch (error: unknown) {
    throw new Error(
      `AI configuration error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
