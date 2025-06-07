/**
 * Centralized AI provider configuration and error handling
 */

import { provider } from "../provider.js";

export function handleProviderSetup(
  providerName: string,
  model: string | string[],
) {
  try {
    // If model is an array, use the first model in the array
    const modelToUse = Array.isArray(model) ? model[0] : model;
    return provider(providerName)(modelToUse);
  } catch (error: unknown) {
    throw new Error(
      `AI configuration error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
