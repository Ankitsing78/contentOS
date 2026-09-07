/**
 * ContentOS - Modular Image & Visual Provider Abstraction
 * Defines the vendor-agnostic contract for graphic, diagram, and image generation.
 */

export interface ImageGenerationRequest {
  prompt: string;
  projectId?: string;
  sceneId?: string;
  visualRequirementId?: string;
  aspect_ratio?: '9:16' | '16:9' | '1:1' | '4:5';
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  resolution?: string;
  requestedResolution?: string;
  style?: string;
  negative_constraints?: string[];
  metadata?: Record<string, unknown>;
}

export interface GeneratedImage {
  imageBuffer: Buffer;
  mimeType: string;
  fileExtension: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface IImageProvider {
  readonly id: string;

  /**
   * Generates a visual asset (image, graphic, diagram background) from a prompt.
   * Prompts must be treated as authoritative and respect factual accuracy constraints.
   */
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImage>;
}
