/**
 * ContentOS - Platform & Format Production Specifications
 * 
 * Centralizes aspect ratios, resolutions, visual pacing, and formatting rules
 * for downstream media planning across Instagram, YouTube, and X.
 */

import { PlatformType } from '@/types/content';
import { ScriptFormat } from '@/types/script';
import { AspectRatio } from '@/types/production';

export interface PlatformProductionConfig {
  platform: PlatformType;
  format: ScriptFormat;
  aspectRatio: AspectRatio;
  resolution: string;
  maxSceneDurationSeconds: number;
  minSceneDurationSeconds: number;
  defaultVisualType: 'talking_head' | 'kinetic_text' | 'screen_recording';
  captionMaxWordsPerBlock: number;
  visualCadenceNotes: string;
}

export const DEFAULT_PRODUCTION_CONFIGS: Record<PlatformType, Record<string, PlatformProductionConfig>> = {
  instagram: {
    short_video: {
      platform: 'instagram',
      format: 'short_video',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      maxSceneDurationSeconds: 15,
      minSceneDurationSeconds: 2,
      defaultVisualType: 'talking_head',
      captionMaxWordsPerBlock: 5,
      visualCadenceNotes: 'High-contrast vertical framing, rapid kinetic typography, bold stat callouts centered in safe zone.',
    },
    reel: {
      platform: 'instagram',
      format: 'reel',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      maxSceneDurationSeconds: 12,
      minSceneDurationSeconds: 2,
      defaultVisualType: 'talking_head',
      captionMaxWordsPerBlock: 5,
      visualCadenceNotes: 'Vertical framing, fast visual hook in first 2-3s, burned-in subtitles.',
    },
  },
  youtube: {
    short_video: {
      platform: 'youtube',
      format: 'short_video',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      maxSceneDurationSeconds: 15,
      minSceneDurationSeconds: 2,
      defaultVisualType: 'talking_head',
      captionMaxWordsPerBlock: 6,
      visualCadenceNotes: 'Continuous background momentum, crisp lower-third info cards, pinned comment callout.',
    },
    long_video: {
      platform: 'youtube',
      format: 'long_video',
      aspectRatio: '16:9',
      resolution: '1920x1080',
      maxSceneDurationSeconds: 45,
      minSceneDurationSeconds: 3,
      defaultVisualType: 'talking_head',
      captionMaxWordsPerBlock: 8,
      visualCadenceNotes: 'Landscape 16:9 cinematic framing, multi-angle camera cuts, detailed data charts and architecture schematics.',
    },
  },
  x: {
    short_video: {
      platform: 'x',
      format: 'short_video',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      maxSceneDurationSeconds: 12,
      minSceneDurationSeconds: 2,
      defaultVisualType: 'kinetic_text',
      captionMaxWordsPerBlock: 5,
      visualCadenceNotes: 'High-density information delivery, rapid stat highlights, clean typography for mobile feed.',
    },
    post: {
      platform: 'x',
      format: 'post',
      aspectRatio: '1:1',
      resolution: '1080x1080',
      maxSceneDurationSeconds: 10,
      minSceneDurationSeconds: 2,
      defaultVisualType: 'kinetic_text',
      captionMaxWordsPerBlock: 6,
      visualCadenceNotes: 'Square 1:1 visual card format, bold headline quotes and stat charts.',
    },
  },
};

/**
 * Resolves platform production configuration with sensible defaults
 */
export function getPlatformProductionConfig(
  platform: PlatformType,
  format: ScriptFormat = 'short_video'
): PlatformProductionConfig {
  const platformConfigs = DEFAULT_PRODUCTION_CONFIGS[platform] || DEFAULT_PRODUCTION_CONFIGS.instagram;
  const config = platformConfigs[format] || platformConfigs.short_video || Object.values(platformConfigs)[0];
  return config;
}
