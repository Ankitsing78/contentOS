/**
 * ContentOS - Modular Video Composition & Rendering Abstraction
 * Defines the vendor-agnostic contract for video timeline assembly and rendering.
 */

import { AspectRatio } from '@/types/production';

export interface CompositionSceneAsset {
  assetId: string;
  storagePath: string;
  mimeType: string;
  buffer: Buffer;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface CompositionCaption {
  id: string;
  startSecond: number;
  endSecond: number;
  text: string;
  emphasisWords: string[];
}

export interface CompositionScene {
  sceneId: string;
  order: number;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  purpose: string;
  visualAsset: CompositionSceneAsset;
  narrationAsset?: CompositionSceneAsset;
  captions: CompositionCaption[];
}

export interface VideoCompositionSpecification {
  projectId: string;
  jobId: string;
  productionPackageId: string;
  platform: string;
  aspectRatio: AspectRatio;
  dimensions: {
    width: number;
    height: number;
  };
  fps: number;
  totalDurationSeconds: number;
  scenes: CompositionScene[];
  metadata?: Record<string, unknown>;
}

export interface RenderedVideo {
  videoBuffer: Buffer;
  mimeType: string;
  fileExtension: string;
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  renderer: string;
  metadata?: Record<string, unknown>;
}

export interface IVideoRenderer {
  readonly id: string;

  /**
   * Assembles and encodes a structured video from the composition specification.
   * Every scene must contain a verified real visual asset and synchronized audio.
   */
  renderVideo(spec: VideoCompositionSpecification): Promise<RenderedVideo>;
}
