/**
 * ContentOS - Image Agent & Visual Provider Unit Tests
 * Uses mocked image providers and storage. No live API calls in unit tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseImageMetadata, createMockPngBuffer } from '@/lib/media/image-parser';
import { GeminiImageProvider } from '@/lib/media/gemini-image-provider';
import { LocalImageProvider, LocalImageProviderError } from '@/lib/media/local-image-provider';
import { MockImageProvider } from '@/lib/media/mock-image-provider';
import { IImageProvider, GeneratedImage, ImageGenerationRequest } from '@/lib/media/image-provider';
import { ImageAgent, getImageProvider } from '@/lib/services/image-agent';
import { IStorageProvider, StorageUploadResult } from '@/lib/storage';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mock Storage Provider
 */
class MockStorageProvider implements IStorageProvider {
  readonly providerId = 'mock' as const;
  public uploadedFiles: Array<{ bucket: string; path: string; size: number }> = [];
  public shouldFail: boolean = false;

  async upload(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string
  ): Promise<StorageUploadResult> {
    if (this.shouldFail) {
      throw new Error('Simulated storage upload failure');
    }
    this.uploadedFiles.push({
      bucket,
      path: filePath,
      size: fileBuffer.byteLength,
    });
    return {
      path: filePath,
      sizeBytes: fileBuffer.byteLength,
      mimeType: contentType,
    };
  }

  async createSignedUrl(bucket: string, filePath: string): Promise<string> {
    return `https://mock-storage.local/${bucket}/${filePath}?token=signed`;
  }

  async delete(): Promise<boolean> {
    return true;
  }

  buildPath(userId: string, projectId: string, assetType: string, filename: string): string {
    return `${userId}/${projectId}/${assetType}/${filename}`;
  }
}

/**
 * Custom configurable mock image provider
 */
class CustomMockImageProvider implements IImageProvider {
  readonly id = 'custom-mock-image-provider';
  public callCount = 0;
  public lastRequest?: ImageGenerationRequest;
  public shouldFail = false;
  public returnEmptyBuffer = false;
  public returnSmallDimensions = false;

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    this.callCount++;
    this.lastRequest = request;

    if (this.shouldFail) {
      throw new Error('Simulated image generation failure');
    }

    if (this.returnEmptyBuffer) {
      return {
        imageBuffer: Buffer.alloc(0),
        mimeType: 'image/png',
        fileExtension: 'png',
        width: 1080,
        height: 1920,
        provider: 'custom-mock',
        model: 'mock-model',
      };
    }

    const width = this.returnSmallDimensions ? 100 : 1080;
    const height = this.returnSmallDimensions ? 100 : 1920;
    const imageBuffer = createMockPngBuffer(width, height);

    return {
      imageBuffer,
      mimeType: 'image/png',
      fileExtension: 'png',
      width,
      height,
      provider: 'custom-mock',
      model: 'gemini-3.1-flash-image',
      metadata: {
        aspectRatio: request.aspect_ratio || '9:16',
      },
    };
  }
}

interface MockVisualRequirement {
  id: string;
  production_package_id: string;
  scene_id: string;
  asset_type: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  generation_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  storage_path?: string | null;
  content_asset_id?: string | null;
  notes?: string | null;
}

function createMockSupabaseClient(options?: {
  existingRequirement?: Partial<MockVisualRequirement>;
  existingAsset?: Record<string, unknown>;
  failAssetPersistence?: boolean;
}) {
  let requirement: MockVisualRequirement = {
    id: 'req-vis-001',
    production_package_id: 'pkg-001',
    scene_id: 'scene-001',
    asset_type: 'background_image',
    prompt: 'A dark moody cyber workstation, 9:16 vertical frame',
    aspect_ratio: '9:16',
    resolution: '1080x1920',
    generation_required: true,
    status: 'pending',
    storage_path: null,
    content_asset_id: null,
    notes: null,
    ...options?.existingRequirement,
  };

  const assets: Array<Record<string, unknown>> = options?.existingAsset
    ? [options.existingAsset]
    : [];
  const agentRuns: Array<Record<string, unknown>> = [];
  const jobStages: Array<Record<string, unknown>> = [];

  return {
    _getRequirement: () => requirement,
    _getAssets: () => assets,
    _getAgentRuns: () => agentRuns,
    _getJobStages: () => jobStages,

    from: (table: string) => {
      if (table === 'production_visual_requirements') {
        return {
          select: () => ({
            eq: (_field: string, val: string) => ({
              maybeSingle: async () => ({
                data: requirement.id === val ? { ...requirement } : null,
                error: null,
              }),
              single: async () => ({
                data: requirement.id === val ? { ...requirement } : null,
                error: requirement.id === val ? null : { message: 'Not found' },
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: requirement.status === 'pending' ? { ...requirement } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (updates: Record<string, unknown>) => ({
            eq: () => ({
              select: () => ({
                single: async () => {
                  requirement = { ...requirement, ...updates } as MockVisualRequirement;
                  return { data: { ...requirement }, error: null };
                },
              }),
            }),
          }),
        };
      }

      if (table === 'production_packages') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'pkg-001', project_id: 'proj-001' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'content_assets') {
        return {
          select: () => ({
            eq: (field: string, val: string) => ({
              maybeSingle: async () => {
                const found = assets.find((a) => a[field] === val);
                return { data: found ? { ...found } : null, error: null };
              },
            }),
          }),
          insert: (newAsset: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                if (options?.failAssetPersistence) {
                  return {
                    data: null,
                    error: { message: 'Database constraint error on content_assets insert' },
                  };
                }
                const record = { id: crypto.randomUUID(), ...newAsset };
                assets.push(record);
                return { data: record, error: null };
              },
            }),
          }),
        };
      }

      if (table === 'agent_runs') {
        return {
          insert: (run: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const record = { id: crypto.randomUUID(), ...run };
                agentRuns.push(record);
                return { data: record, error: null };
              },
            }),
          }),
        };
      }

      if (table === 'job_stages') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: jobStages.length > 0 ? jobStages[jobStages.length - 1] : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: (stage: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const record = { id: crypto.randomUUID(), ...stage };
                jobStages.push(record);
                return { data: record, error: null };
              },
            }),
          }),
          update: (updateData: Record<string, unknown>) => ({
            eq: async (field: string, val: string) => {
              const found = jobStages.find((s) => s[field] === val);
              if (found) Object.assign(found, updateData);
              return { data: found, error: null };
            },
          }),
          upsert: (stage: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const record = { id: crypto.randomUUID(), ...stage };
                jobStages.push(record);
                return { data: record, error: null };
              },
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

describe('ImageAgent & Visual Generation', () => {
  describe('Provider Configuration', () => {
    it('throws when GEMINI_API_KEY is missing or blank', () => {
      const originalKey = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GOOGLE_API_KEY;

        assert.throws(
          () => new GeminiImageProvider(''),
          /GeminiImageProvider requires a valid GEMINI_API_KEY/
        );
      } finally {
        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      }
    });

    it('creates mock provider with default dimensions', async () => {
      const mock = new MockImageProvider(1080, 1920);
      const res = await mock.generateImage({
        prompt: 'Minimalist tech artwork',
        aspect_ratio: '9:16',
      });
      assert.equal(res.width, 1080);
      assert.equal(res.height, 1920);
      assert.equal(res.mimeType, 'image/png');
      assert.ok(res.imageBuffer.length > 0);
    });
  });

  describe('Image Header Parser', () => {
    it('accurately parses 1080x1920 PNG buffer', () => {
      const buf = createMockPngBuffer(1080, 1920);
      const meta = parseImageMetadata(buf);
      assert.equal(meta.width, 1080);
      assert.equal(meta.height, 1920);
      assert.equal(meta.mimeType, 'image/png');
      assert.equal(meta.fileExtension, 'png');
      assert.equal(meta.formattedAspectRatio, '9:16');
    });

    it('throws when image buffer is empty', () => {
      assert.throws(
        () => parseImageMetadata(Buffer.alloc(0)),
        /Image buffer is empty or undefined/
      );
    });
  });

  describe('ImageAgent Execution & Idempotency', () => {
    it('generates visual for pending requirement and persists to storage and database', async () => {
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      const result = await agent.execute({
        client: mockClient as unknown as SupabaseClient,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        requirementId: 'req-vis-001',
      });

      assert.equal(result.success, true);
      assert.equal(result.isReused, false);
      assert.equal(result.imageMetadata.width, 1080);
      assert.equal(result.imageMetadata.height, 1920);
      assert.equal(result.imageMetadata.aspectRatio, '9:16');

      // Requirement updated to completed
      const req = mockClient._getRequirement();
      assert.equal(req.status, 'completed');
      assert.ok(req.storage_path?.includes('proj-001/visuals/'));

      // Storage upload occurred
      assert.equal(mockStorage.uploadedFiles.length, 1);
      assert.equal(mockStorage.uploadedFiles[0].bucket, 'content-assets');

      // content_assets record created
      const assets = mockClient._getAssets();
      assert.equal(assets.length, 1);
      assert.equal(assets[0].asset_type, 'image');

      // agent_runs and job_stages created
      assert.equal(mockClient._getAgentRuns().length, 1);
      assert.equal(mockClient._getJobStages().length, 1);
    });

    it('reuses existing asset when requirement is already completed (idempotency)', async () => {
      const existingAssetId = 'asset-existing-123';
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({
        existingRequirement: {
          status: 'completed',
          content_asset_id: existingAssetId,
          storage_path: 'projects/proj-001/visuals/asset-existing-123.png',
        },
        existingAsset: {
          id: existingAssetId,
          asset_type: 'image',
          storage_path: 'projects/proj-001/visuals/asset-existing-123.png',
          file_size: 1024,
          mime_type: 'image/png',
          metadata: { width: 1080, height: 1920, aspect_ratio: '9:16' },
        },
      });

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      const result = await agent.execute({
        client: mockClient as unknown as SupabaseClient,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        requirementId: 'req-vis-001',
      });

      assert.equal(result.success, true);
      assert.equal(result.isReused, true);
      assert.equal(result.asset.id, existingAssetId);

      // No image generation was called
      assert.equal(mockImage.callCount, 0);

      // No new storage upload
      assert.equal(mockStorage.uploadedFiles.length, 0);

      // No duplicate assets created
      assert.equal(mockClient._getAssets().length, 1);
    });

    it('throws if visual requirement does not require generation', async () => {
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({
        existingRequirement: { generation_required: false },
      });

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /does not require generation/
      );
    });

    it('throws if prompt is empty', async () => {
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({
        existingRequirement: { prompt: '' },
      });

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /has no visual prompt/
      );
    });

    it('rejects image with dimensions below threshold', async () => {
      const mockImage = new CustomMockImageProvider();
      mockImage.returnSmallDimensions = true; // 100x100 is below 256 threshold
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /below minimum threshold/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
    });

    it('does not mark requirement completed if storage upload fails', async () => {
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      mockStorage.shouldFail = true;
      const mockClient = createMockSupabaseClient();

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /Simulated storage upload failure/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.ok(req.notes?.includes('Storage upload failed'));
      assert.equal(mockClient._getAssets().length, 0);
    });

    it('does not mark requirement completed if database asset persistence fails', async () => {
      const mockImage = new CustomMockImageProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({
        failAssetPersistence: true,
      });

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /Database constraint error on content_assets insert/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.ok(req.notes?.includes('Asset persistence failed'));
      assert.equal(mockClient._getAssets().length, 0);
    });

    it('handles provider error and marks requirement failed', async () => {
      const mockImage = new CustomMockImageProvider();
      mockImage.shouldFail = true;
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /Simulated image generation failure/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.ok(req.notes?.includes('Simulated image generation failure'));
      assert.equal(mockClient._getAssets().length, 0);
    });

    it('rejects empty image buffer returned by provider', async () => {
      const mockImage = new CustomMockImageProvider();
      mockImage.returnEmptyBuffer = true;
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new ImageAgent({
        imageProvider: mockImage,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-vis-001',
          }),
        /Generated image buffer is empty/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
    });
  });

  describe('LocalImageProvider & Provider Selection', () => {
    const validPngBuffer = createMockPngBuffer(1080, 1920);
    const validBase64 = validPngBuffer.toString('base64');

    it('successfully generates image from local server returning base64 JSON payload', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            data: [{ b64_json: validBase64 }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        model: 'sdxl',
        fetchFn: mockFetch,
      });

      const result = await provider.generateImage({
        prompt: 'A dramatic high-tech workspace',
        aspect_ratio: '9:16',
      });

      assert.equal(result.provider, 'local');
      assert.equal(result.model, 'sdxl');
      assert.equal(result.mimeType, 'image/png');
      assert.equal(result.fileExtension, 'png');
      assert.equal(result.width, 1080);
      assert.equal(result.height, 1920);
      assert.ok(result.imageBuffer.byteLength > 0);
    });

    it('successfully generates image from local server returning direct binary image payload', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(new Uint8Array(validPngBuffer), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        model: 'flux-schnell',
        fetchFn: mockFetch,
      });

      const result = await provider.generateImage({
        prompt: 'Direct binary local image response',
        aspect_ratio: '9:16',
      });

      assert.equal(result.provider, 'local');
      assert.equal(result.model, 'flux-schnell');
      assert.equal(result.mimeType, 'image/png');
      assert.equal(result.width, 1080);
      assert.equal(result.height, 1920);
    });

    it('handles request timeout cleanly with TIMEOUT error code', async () => {
      const mockFetch: typeof fetch = async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      };

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        timeoutMs: 100,
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'Test timeout handling',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'TIMEOUT');
          assert.match(err.message, /timed out/);
          return true;
        }
      );
    });

    it('handles malformed response when JSON contains no image data', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(JSON.stringify({ unexpected: 'format', data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'Test malformed response',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'MALFORMED_RESPONSE');
          assert.match(err.message, /did not contain image data/);
          return true;
        }
      );
    });

    it('handles invalid image bytes returned by server', async () => {
      const corruptedBytes = Buffer.from('not a valid png or jpeg header');
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            b64_json: corruptedBytes.toString('base64'),
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'Corrupted image bytes',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'INVALID_IMAGE');
          assert.match(err.message, /invalid or corrupted image binary/);
          return true;
        }
      );
    });

    it('rejects wrong or undersized dimensions violating minimum threshold', async () => {
      const undersizedBuffer = createMockPngBuffer(100, 100);
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            b64_json: undersizedBuffer.toString('base64'),
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'Undersized image',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'INVALID_DIMENSIONS');
          assert.match(err.message, /minimum dimension requirement/);
          return true;
        }
      );
    });

    it('handles provider unavailable when network connection fails', async () => {
      const mockFetch: typeof fetch = async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8188');
      };

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'Offline local server',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'UNAVAILABLE');
          assert.match(err.message, /is unreachable/);
          return true;
        }
      );
    });

    it('handles HTTP error status from local server', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response('Internal Server Error: VRAM Out of Memory', {
          status: 500,
        });

      const provider = new LocalImageProvider({
        apiUrl: 'http://127.0.0.1:8188',
        fetchFn: mockFetch,
      });

      await assert.rejects(
        () =>
          provider.generateImage({
            prompt: 'VRAM error',
          }),
        (err: unknown) => {
          assert.ok(err instanceof LocalImageProviderError);
          assert.equal(err.code, 'HTTP_ERROR');
          assert.match(err.message, /HTTP 500/);
          return true;
        }
      );
    });

    it('strict provider selection: selects requested provider without silent fallback', () => {
      const local = getImageProvider('local');
      assert.ok(local instanceof LocalImageProvider);
      assert.equal(local.id, 'local');

      const mock = getImageProvider('mock');
      assert.ok(mock instanceof MockImageProvider);
      assert.equal(mock.id, 'mock');

      assert.throws(
        () => getImageProvider('unsupported_provider'),
        /Unknown image provider 'unsupported_provider'/
      );
    });
  });
});

