/**
 * ContentOS - Centralized AI Model & Provider Configuration
 * All model identifiers, default temperature, and token budgets are maintained here.
 */

export const AI_CONFIG = {
  defaultProvider: (process.env.AI_DEFAULT_PROVIDER as 'gemini' | 'openai' | 'anthropic') || 'gemini',
  
  // Google Gemini Model Settings
  gemini: {
    // Current fast model optimized for low latency and high accuracy structured output
    defaultModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    temperature: 0.3,
    maxOutputTokens: 8192,
  },
} as const;

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  return Boolean(key && !key.startsWith('YOUR_') && !key.startsWith('your-'));
}
