/**
 * ContentOS - Gemini Image Provider Implementation
 * Server-only image provider using Google GenAI SDK and gemini-3.1-flash-image.
 */

import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { IImageProvider, ImageGenerationRequest, GeneratedImage } from './image-provider';
import { IMAGE_CONFIG } from './image-config';
import { parseImageMetadata } from './image-parser';

export class GeminiImageProvider implements IImageProvider {
  readonly id = 'gemini' as const;
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, modelName?: string) {
    const key =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!key || key.startsWith('YOUR_') || key.startsWith('your-')) {
      throw new Error(
        'GeminiImageProvider requires a valid GEMINI_API_KEY environment variable. Please set it in .env.local.'
      );
    }

    this.client = new GoogleGenAI({ apiKey: key });
    this.model = modelName || IMAGE_CONFIG.model;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Image generation prompt cannot be empty');
    }

    const aspectRatio = request.aspect_ratio || request.aspectRatio || IMAGE_CONFIG.defaultAspectRatio;
    const style = request.style || 'modern high-contrast digital production art';

    // Construct structured prompt specifying framing, aspect ratio, and stylistic requirements
    const promptParts = [
      request.prompt.trim(),
      `Style: ${style}.`,
      `Framing: Vertical format with aspect ratio ${aspectRatio}.`,
      'Composition: Professional production asset with clean focal center and cinematic lighting.',
    ];

    if (request.negative_constraints && request.negative_constraints.length > 0) {
      promptParts.push(`Avoid: ${request.negative_constraints.join(', ')}.`);
    }

    const fullPrompt = promptParts.join(' ');

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: fullPrompt,
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidate returned by Gemini Image model');
      }

      const parts = candidate.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

      if (!imagePart || !imagePart.inlineData?.data) {
        throw new Error('Gemini image response did not contain inline image data');
      }

      const rawBase64 = imagePart.inlineData.data;
      const reportedMimeType = imagePart.inlineData.mimeType || 'image/png';
      const imageBuffer = Buffer.from(rawBase64, 'base64');

      if (imageBuffer.length === 0) {
        throw new Error('Decoded image buffer is empty');
      }

      // Parse binary header to extract actual dimensions, file extension, and confirmed format
      const parsed = parseImageMetadata(imageBuffer, reportedMimeType);

      return {
        imageBuffer,
        mimeType: parsed.mimeType,
        fileExtension: parsed.fileExtension,
        width: parsed.width,
        height: parsed.height,
        provider: 'gemini',
        model: this.model,
        metadata: {
          aspectRatio,
          detectedAspectRatio: parsed.formattedAspectRatio,
          sizeBytes: parsed.sizeBytes,
          reportedMimeType,
          style,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown Gemini image error';
      // Sanitized error logging (no keys or tokens)
      console.error('[ContentOS] [GeminiImageProvider] Image generation error:', msg);
      throw new Error(`Gemini image generation failed: ${msg}`);
    }
  }
}
