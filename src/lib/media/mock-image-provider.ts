/**
 * ContentOS - Mock Image Provider Implementation
 * Provides deterministic synthetic image buffers for offline testing and local validation.
 */

import { IImageProvider, ImageGenerationRequest, GeneratedImage } from './image-provider';
import { createMockPngBuffer, parseImageMetadata } from './image-parser';
import { IMAGE_CONFIG } from './image-config';

export class MockImageProvider implements IImageProvider {
  readonly id = 'mock' as const;
  private width: number;
  private height: number;

  constructor(width = 1080, height = 1920) {
    this.width = width;
    this.height = height;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Image generation prompt cannot be empty');
    }

    const imageBuffer = createMockPngBuffer(this.width, this.height);
    const parsed = parseImageMetadata(imageBuffer, 'image/png');

    return {
      imageBuffer,
      mimeType: parsed.mimeType,
      fileExtension: parsed.fileExtension,
      width: parsed.width,
      height: parsed.height,
      provider: 'mock',
      model: 'mock-image-generator',
      metadata: {
        isMockData: true,
        aspectRatio: request.aspect_ratio || IMAGE_CONFIG.defaultAspectRatio,
        detectedAspectRatio: parsed.formattedAspectRatio,
        sizeBytes: imageBuffer.length,
      },
    };
  }
}
