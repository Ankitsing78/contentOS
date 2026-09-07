/**
 * ContentOS - Local Image Provider Implementation
 * Vendor-agnostic local image inference provider supporting external local inference HTTP APIs
 * (e.g. ComfyUI, Ollama, Stable Diffusion WebUI/Forge, LocalAI, or custom local inference servers).
 * Zero per-image API charges with full privacy and local GPU acceleration.
 */

import { IImageProvider, ImageGenerationRequest, GeneratedImage } from './image-provider';
import { IMAGE_CONFIG } from './image-config';
import { parseImageMetadata } from './image-parser';

export interface LocalImageProviderOptions {
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export class LocalImageProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TIMEOUT'
      | 'UNAVAILABLE'
      | 'HTTP_ERROR'
      | 'MALFORMED_RESPONSE'
      | 'INVALID_IMAGE'
      | 'INVALID_DIMENSIONS'
      | 'UNKNOWN' = 'UNKNOWN'
  ) {
    super(message);
    this.name = 'LocalImageProviderError';
  }
}

export class LocalImageProvider implements IImageProvider {
  readonly id = 'local' as const;
  private apiUrl: string;
  private model: string;
  private timeoutMs: number;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(options?: LocalImageProviderOptions) {
    const rawUrl =
      options?.apiUrl ||
      process.env.LOCAL_IMAGE_API_URL ||
      IMAGE_CONFIG.local.apiUrl;

    // Ensure valid URL scheme
    this.apiUrl = rawUrl.replace(/\/+$/, '');
    this.model =
      options?.model ||
      process.env.LOCAL_IMAGE_MODEL ||
      IMAGE_CONFIG.local.model;
    this.timeoutMs =
      options?.timeoutMs ||
      Number(process.env.LOCAL_IMAGE_TIMEOUT_MS) ||
      IMAGE_CONFIG.local.timeoutMs;
    this.apiKey = options?.apiKey || process.env.LOCAL_IMAGE_API_KEY;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Resolves target pixel dimensions from aspect ratio string
   */
  private resolveDimensions(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '4:5':
        return { width: 1080, height: 1350 };
      default:
        return { width: 1080, height: 1920 };
    }
  }

  /**
   * Sanitizes URLs for logging/errors by masking basic auth or token parameters
   */
  private sanitizeUrl(urlStr: string): string {
    try {
      const u = new URL(urlStr);
      if (u.password) u.password = '***';
      if (u.searchParams.has('token')) u.searchParams.set('token', '***');
      if (u.searchParams.has('key')) u.searchParams.set('key', '***');
      return u.toString();
    } catch {
      return urlStr.replace(/:\/\/.*@/, '://***@');
    }
  }

  /**
   * Builds the target API endpoint path
   */
  private getEndpoint(): string {
    // If user provided a full path (e.g. includes /v1/images/generations or /generate), use it directly
    if (
      this.apiUrl.includes('/v1/') ||
      this.apiUrl.includes('/generate') ||
      this.apiUrl.includes('/api/')
    ) {
      return this.apiUrl;
    }
    return `${this.apiUrl}/v1/images/generations`;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new LocalImageProviderError('Image generation prompt cannot be empty', 'INVALID_IMAGE');
    }

    const aspectRatio = request.aspect_ratio || request.aspectRatio || IMAGE_CONFIG.defaultAspectRatio;
    const { width, height } = this.resolveDimensions(aspectRatio);
    const style = request.style || 'modern high-contrast digital production art';

    // Construct full prompt
    const promptParts = [
      request.prompt.trim(),
      `Style: ${style}.`,
      `Framing: Aspect ratio ${aspectRatio}.`,
      'Composition: Professional production asset with clean focal center and cinematic lighting.',
    ];

    if (request.negative_constraints && request.negative_constraints.length > 0) {
      promptParts.push(`Negative: ${request.negative_constraints.join(', ')}.`);
    }

    const fullPrompt = promptParts.join(' ');
    const endpoint = this.getEndpoint();
    const sanitizedEndpoint = this.sanitizeUrl(endpoint);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, image/png, image/jpeg, */*',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      prompt: fullPrompt,
      model: this.model,
      aspect_ratio: aspectRatio,
      width,
      height,
      response_format: 'b64_json',
    };

    let response: Response;
    let signal: AbortSignal | undefined;

    // Set up timeout controller
    if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      signal = AbortSignal.timeout(this.timeoutMs);
    } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), this.timeoutMs);
      signal = controller.signal;
    }

    try {
      response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (
        errorObj.name === 'TimeoutError' ||
        errorObj.name === 'AbortError' ||
        errorObj.message?.toLowerCase().includes('timeout')
      ) {
        throw new LocalImageProviderError(
          `Local image generation timed out after ${this.timeoutMs}ms from ${sanitizedEndpoint}`,
          'TIMEOUT'
        );
      }

      throw new LocalImageProviderError(
        `Local image inference server at ${sanitizedEndpoint} is unreachable: ${errorObj.message || 'Connection failed'}`,
        'UNAVAILABLE'
      );
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error response';
      }
      throw new LocalImageProviderError(
        `Local image server returned HTTP ${response.status} from ${sanitizedEndpoint}: ${errorBody.slice(0, 300)}`,
        'HTTP_ERROR'
      );
    }

    let imageBuffer: Buffer;
    let reportedMimeType = 'image/png';

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // 1. Direct binary image response
    if (contentType.startsWith('image/')) {
      reportedMimeType = contentType.split(';')[0].trim();
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      // 2. JSON response (standard OpenAI format, ComfyUI wrapper, or Ollama image output)
      let json: Record<string, unknown>;
      try {
        json = (await response.json()) as Record<string, unknown>;
      } catch {
        throw new LocalImageProviderError(
          `Local image server returned invalid JSON response from ${sanitizedEndpoint}`,
          'MALFORMED_RESPONSE'
        );
      }

      let base64Data: string | null = null;

      // Extract base64 image from common API response schemas:
      // A: { data: [{ b64_json: "..." }] } (OpenAI / standard compatible)
      if (Array.isArray(json.data) && json.data.length > 0) {
        const item = json.data[0] as Record<string, unknown>;
        if (typeof item.b64_json === 'string') {
          base64Data = item.b64_json;
        } else if (typeof item.image === 'string') {
          base64Data = item.image;
        }
      }
      // B: { b64_json: "..." }
      else if (typeof json.b64_json === 'string') {
        base64Data = json.b64_json;
      }
      // C: { image: "..." } or { images: ["..."] }
      else if (typeof json.image === 'string') {
        base64Data = json.image;
      } else if (Array.isArray(json.images) && typeof json.images[0] === 'string') {
        base64Data = json.images[0];
      }

      if (!base64Data || base64Data.trim().length === 0) {
        throw new LocalImageProviderError(
          `Local image server response did not contain image data from ${sanitizedEndpoint}`,
          'MALFORMED_RESPONSE'
        );
      }

      // Strip optional data:image/png;base64, prefix
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new LocalImageProviderError('Decoded local image buffer is empty', 'INVALID_IMAGE');
    }

    // Validate MIME type
    const supportedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (reportedMimeType && !supportedMimes.some((m) => reportedMimeType.includes(m))) {
      throw new LocalImageProviderError(
        `Local image server returned unsupported MIME type: ${reportedMimeType}`,
        'INVALID_IMAGE'
      );
    }

    // Validate image format magic bytes (PNG, JPEG, WebP)
    const isPng =
      imageBuffer.length >= 8 &&
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47;
    const isJpeg =
      imageBuffer.length >= 3 &&
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8 &&
      imageBuffer[2] === 0xff;
    const isWebp =
      imageBuffer.length >= 12 &&
      imageBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      imageBuffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isPng && !isJpeg && !isWebp) {
      throw new LocalImageProviderError(
        `Local image server returned invalid or corrupted image binary (unrecognized image signature) from ${sanitizedEndpoint}`,
        'INVALID_IMAGE'
      );
    }

    // Parse image binary header to validate format and extract true dimensions
    let parsed;
    try {
      parsed = parseImageMetadata(imageBuffer, reportedMimeType);
    } catch (parseErr: unknown) {
      const err = parseErr as Error;
      throw new LocalImageProviderError(
        `Local image server returned invalid or corrupted image binary: ${err.message}`,
        'INVALID_IMAGE'
      );
    }

    // Validate minimum dimensions
    if (parsed.width < IMAGE_CONFIG.minDimension || parsed.height < IMAGE_CONFIG.minDimension) {
      throw new LocalImageProviderError(
        `Generated image dimensions (${parsed.width}x${parsed.height}) do not satisfy minimum dimension requirement (${IMAGE_CONFIG.minDimension}px)`,
        'INVALID_DIMENSIONS'
      );
    }

    return {
      imageBuffer,
      mimeType: parsed.mimeType,
      fileExtension: parsed.fileExtension,
      width: parsed.width,
      height: parsed.height,
      provider: 'local',
      model: this.model,
      metadata: {
        aspectRatio,
        detectedAspectRatio: parsed.formattedAspectRatio,
        sizeBytes: parsed.sizeBytes,
        reportedMimeType,
        apiUrl: sanitizedEndpoint,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
