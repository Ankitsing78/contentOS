/**
 * ContentOS - Centralized Image Generation Configuration
 * Manages models, aspect ratios, storage path generation, and dimension rules.
 */

export const IMAGE_CONFIG = {
  // Automated visual generation status: PAUSED / ON HOLD per system directive
  isPaused: true,
  pauseMessage: 'Automated visual generation is temporarily paused / on hold. Provider architecture is preserved for future resumption.',

  // Primary visual generation model
  provider: (process.env.IMAGE_PROVIDER || 'gemini') as 'gemini' | 'local' | 'mock',
  model: 'gemini-3.1-flash-image',

  // Local image inference server configuration
  local: {
    apiUrl: process.env.LOCAL_IMAGE_API_URL || 'http://127.0.0.1:8188',
    model: process.env.LOCAL_IMAGE_MODEL || 'sdxl',
    timeoutMs: Number(process.env.LOCAL_IMAGE_TIMEOUT_MS) || 60000,
  },

  // Target aspect ratios supported by modern short-form and long-form video
  supportedAspectRatios: ['9:16', '16:9', '1:1', '4:5'] as const,
  defaultAspectRatio: '9:16' as const,

  // Default target resolution
  defaultResolution: '1080x1920',

  // Quality and dimension tolerances
  minDimension: 256,
  maxDimension: 4096,
  maxFileSizeBytes: 20 * 1024 * 1024, // 20 MB

  // Timeouts
  generationTimeoutMs: 60000,

  // Private storage configuration
  storageBucket: 'content-assets',

  /**
   * Deterministic path generator for visual assets
   * Pattern: projects/{projectId}/visuals/{sceneId}/{assetId}.{ext}
   */
  buildStoragePath: (projectId: string, assetId: string, fileExtension = 'png', sceneId?: string | null): string => {
    const cleanExt = fileExtension.replace(/^\./, '').toLowerCase();
    if (sceneId) {
      return `projects/${projectId}/visuals/${sceneId}/${assetId}.${cleanExt}`;
    }
    return `projects/${projectId}/visuals/${assetId}.${cleanExt}`;
  },

  /**
   * Map standard aspect ratio string to numeric ratio with tolerance
   */
  getAspectRatioValue: (ratio: string): number => {
    switch (ratio) {
      case '9:16':
        return 9 / 16; // 0.5625
      case '16:9':
        return 16 / 9; // 1.7778
      case '1:1':
        return 1.0;
      case '4:5':
        return 4 / 5; // 0.8
      default:
        return 9 / 16;
    }
  },
} as const;

export type SupportedAspectRatio = typeof IMAGE_CONFIG.supportedAspectRatios[number];
