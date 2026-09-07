/**
 * ContentOS - Video Rendering Agent Unit Tests
 * Uses mocked video renderer and storage. No live API calls in unit tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateCompositionReadiness,
  MissingAssetsError,
  InvalidSceneTimingError,
} from '@/lib/media/composition-validator';
import {
  MockVideoRenderer,
  createMockMp4Buffer,
} from '@/lib/media/mock-video-renderer';
import {
  IVideoRenderer,
  VideoCompositionSpecification,
  RenderedVideo,
} from '@/lib/media/video-renderer';
import { VideoRenderingAgent } from '@/lib/services/video-rendering-agent';
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
 * Custom Mock Video Renderer
 */
class CustomMockVideoRenderer implements IVideoRenderer {
  readonly id = 'custom-mock-video-renderer';
  public callCount = 0;
  public lastSpec?: VideoCompositionSpecification;
  public shouldFail = false;

  async renderVideo(spec: VideoCompositionSpecification): Promise<RenderedVideo> {
    this.callCount++;
    this.lastSpec = spec;

    if (this.shouldFail) {
      throw new Error('Simulated video rendering failure');
    }

    const videoBuffer = createMockMp4Buffer(spec.totalDurationSeconds);

    return {
      videoBuffer,
      mimeType: 'video/mp4',
      fileExtension: 'mp4',
      width: spec.dimensions.width,
      height: spec.dimensions.height,
      durationSeconds: spec.totalDurationSeconds,
      fps: spec.fps,
      renderer: 'custom-mock-video-renderer',
    };
  }
}

function makeThenable<T>(
  result: { data: T; error: unknown },
  extraMethods: Record<string, unknown> = {}
) {
  const promise = Promise.resolve(result);
  return Object.assign(promise, {
    order: () => makeThenable(result, extraMethods),
    limit: () => makeThenable(result, extraMethods),
    eq: () => makeThenable(result, extraMethods),
    in: () => makeThenable(result, extraMethods),
    maybeSingle: async () => ({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    }),
    single: async () => ({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    }),
    ...extraMethods,
  });
}

/**
 * In-memory Mock Supabase Client for Video Rendering Agent
 */
function createMockSupabaseClient(options?: {
  pkg?: Record<string, unknown>;
  scenes?: Array<Record<string, unknown>>;
  visualRequirements?: Array<Record<string, unknown>>;
  audioRequirements?: Array<Record<string, unknown>>;
  captions?: Array<Record<string, unknown>>;
  contentAssets?: Array<Record<string, unknown>>;
  failAssetPersistence?: boolean;
}) {
  const pkg = {
    id: 'pkg-001',
    project_id: 'proj-001',
    platform: 'instagram',
    aspect_ratio: '9:16',
    duration_seconds: 60,
    created_at: new Date().toISOString(),
    ...options?.pkg,
  };

  const scenes = options?.scenes || [
    { id: 'scene-1', production_package_id: 'pkg-001', order: 1, start_second: 0, end_second: 12, purpose: 'Hook' },
    { id: 'scene-2', production_package_id: 'pkg-001', order: 2, start_second: 12, end_second: 24, purpose: 'Core Insight' },
  ];

  const visualReqs = options?.visualRequirements || [
    {
      id: 'vis-1',
      production_package_id: 'pkg-001',
      scene_id: 'scene-1',
      prompt: 'Cyber terminal scene 1',
      status: 'pending',
      generation_required: true,
      content_asset_id: null,
      storage_path: null,
    },
    {
      id: 'vis-2',
      production_package_id: 'pkg-001',
      scene_id: 'scene-2',
      prompt: 'Cyber terminal scene 2',
      status: 'pending',
      generation_required: true,
      content_asset_id: null,
      storage_path: null,
    },
  ];

  const audioReqs = options?.audioRequirements || [
    {
      id: 'aud-1',
      production_package_id: 'pkg-001',
      scene_id: 'scene-1',
      audio_type: 'voiceover',
      status: 'completed',
      generation_required: true,
      content_asset_id: 'asset-aud-1',
      storage_path: 'projects/proj-001/audio/aud-1.mp3',
    },
    {
      id: 'aud-2',
      production_package_id: 'pkg-001',
      scene_id: 'scene-2',
      audio_type: 'voiceover',
      status: 'completed',
      generation_required: true,
      content_asset_id: 'asset-aud-2',
      storage_path: 'projects/proj-001/audio/aud-2.mp3',
    },
  ];

  const captions = options?.captions || [
    { id: 'cap-1', production_package_id: 'pkg-001', scene_id: 'scene-1', start_second: 0, end_second: 5, text: 'Hello world' },
    { id: 'cap-2', production_package_id: 'pkg-001', scene_id: 'scene-2', start_second: 12, end_second: 18, text: 'Next segment' },
  ];

  const contentAssets = options?.contentAssets ? [...options.contentAssets] : [];
  const agentRuns: Array<Record<string, unknown>> = [];
  const jobStages: Array<Record<string, unknown>> = [];

  const client = {
    _pkg: pkg,
    _scenes: scenes,
    _visualReqs: visualReqs,
    _audioReqs: audioReqs,
    _captions: captions,
    _contentAssets: contentAssets,
    _agentRuns: agentRuns,
    _jobStages: jobStages,

    storage: {
      from: () => ({
        download: async () => {
          const buf = Buffer.from('mock-asset-data');
          return { data: new Blob([buf]), error: null };
        },
      }),
    },

    from: (table: string) => {
      if (table === 'production_packages') {
        return {
          select: () => makeThenable({ data: pkg, error: null }),
        };
      }

      if (table === 'production_scenes') {
        return {
          select: () => makeThenable({ data: scenes, error: null }),
        };
      }

      if (table === 'production_visual_requirements') {
        return {
          select: () => makeThenable({ data: visualReqs, error: null }),
        };
      }

      if (table === 'production_audio_requirements') {
        return {
          select: () => makeThenable({ data: audioReqs, error: null }),
        };
      }

      if (table === 'production_captions') {
        return {
          select: () => makeThenable({ data: captions, error: null }),
        };
      }

      if (table === 'content_assets') {
        return {
          select: () => makeThenable({ data: contentAssets, error: null }),
          insert: (row: Record<string, unknown>) => {
            if (options?.failAssetPersistence) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Database insert failure' } }),
                }),
              };
            }
            const inserted = { id: `asset-vid-${Date.now()}`, ...row };
            contentAssets.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
        };
      }

      if (table === 'job_stages') {
        return {
          select: () => makeThenable({ data: null, error: null }),
          insert: (row: Record<string, unknown>) => {
            const inserted = { id: `stage-${Date.now()}`, ...row };
            jobStages.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          update: (row: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              const existing = jobStages.find(s => s.id === id);
              if (existing) Object.assign(existing, row);
              return Promise.resolve({ data: existing, error: null });
            },
          }),
        };
      }

      if (table === 'agent_runs') {
        return {
          insert: (row: Record<string, unknown>) => {
            const inserted = { id: `run-${Date.now()}`, ...row };
            agentRuns.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          update: (row: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              const existing = agentRuns.find(r => r.id === id);
              if (existing) Object.assign(existing, row);
              return Promise.resolve({ data: existing, error: null });
            },
          }),
        };
      }

      throw new Error(`Unhandled table in mock: ${table}`);
    },
  };

  return client as unknown as SupabaseClient & {
    _contentAssets: Array<Record<string, unknown>>;
    _agentRuns: Array<Record<string, unknown>>;
    _jobStages: Array<Record<string, unknown>>;
  };
}

describe('Video Composition & Rendering Engine', () => {
  describe('MockVideoRenderer & Deterministic MP4 Buffer', () => {
    it('creates deterministic MP4 container with ftyp, moov, and mdat atoms', () => {
      const buffer = createMockMp4Buffer(60);
      assert.ok(buffer.byteLength > 64, 'Buffer must be valid MP4 size');

      const header = buffer.subarray(4, 8).toString('utf-8');
      assert.equal(header, 'ftyp', 'Must contain ftyp atom at offset 4');

      const str = buffer.toString('binary');
      assert.ok(str.includes('moov'), 'Must contain moov container atom');
      assert.ok(str.includes('mdat'), 'Must contain mdat payload atom');
    });

    it('renders video with correct dimensions and duration', async () => {
      const renderer = new MockVideoRenderer();
      const spec: VideoCompositionSpecification = {
        projectId: 'proj-001',
        jobId: 'job-001',
        productionPackageId: 'pkg-001',
        platform: 'instagram',
        aspectRatio: '9:16',
        dimensions: {
          width: 1080,
          height: 1920,
        },
        totalDurationSeconds: 45,
        fps: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 1,
            startSecond: 0,
            endSecond: 45,
            durationSeconds: 45,
            purpose: 'Hook',
            visualAsset: {
              assetId: 'vis-asset-1',
              storagePath: 'projects/proj-001/images/vis-1.png',
              buffer: Buffer.from('fake-image-bytes'),
              mimeType: 'image/png',
            },
            captions: [],
          },
        ],
      };

      const result = await renderer.renderVideo(spec);
      assert.equal(result.width, 1080);
      assert.equal(result.height, 1920);
      assert.equal(result.durationSeconds, 45);
      assert.equal(result.fps, 30);
      assert.equal(result.mimeType, 'video/mp4');
      assert.equal(result.fileExtension, 'mp4');
      assert.ok(result.videoBuffer.byteLength > 0);
    });
  });

  describe('validateCompositionReadiness', () => {
    it('returns canRender: false when visual requirements are pending', () => {
      const readiness = validateCompositionReadiness({
        scenes: [
          { id: 's-1', order: 1, start_second: 0, end_second: 10 },
        ],
        visualRequirements: [
          { id: 'v-1', scene_id: 's-1', status: 'pending', prompt: 'Hero background', generation_required: true },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 's-1', audio_type: 'voiceover', status: 'completed', content_asset_id: 'asset-1', generation_required: true },
        ],
        captions: [],
        existingAssetIds: new Set(['asset-1']),
      });

      assert.equal(readiness.canRender, false);
      assert.equal(readiness.missingVisuals.length, 1);
      assert.equal(readiness.missingVisuals[0].requirementId, 'v-1');
    });

    it('returns canRender: false when audio voiceover requirements are missing', () => {
      const readiness = validateCompositionReadiness({
        scenes: [
          { id: 's-1', order: 1, start_second: 0, end_second: 10 },
        ],
        visualRequirements: [
          { id: 'v-1', scene_id: 's-1', status: 'completed', content_asset_id: 'img-1', generation_required: true, prompt: 'Hero image' },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 's-1', audio_type: 'voiceover', status: 'pending', generation_required: true },
        ],
        captions: [],
        existingAssetIds: new Set(['img-1']),
      });

      assert.equal(readiness.canRender, false);
      assert.equal(readiness.missingAudios.length, 1);
      assert.equal(readiness.missingAudios[0].requirementId, 'a-1');
    });

    it('returns canRender: true when all visual and voiceover audio assets are completed', () => {
      const readiness = validateCompositionReadiness({
        scenes: [
          { id: 's-1', order: 1, start_second: 0, end_second: 10 },
          { id: 's-2', order: 2, start_second: 10, end_second: 20 },
        ],
        visualRequirements: [
          { id: 'v-1', scene_id: 's-1', status: 'completed', content_asset_id: 'img-1', generation_required: true, prompt: 'Scene 1' },
          { id: 'v-2', scene_id: 's-2', status: 'completed', content_asset_id: 'img-2', generation_required: true, prompt: 'Scene 2' },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 's-1', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-1', generation_required: true },
          { id: 'a-2', scene_id: 's-2', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-2', generation_required: true },
        ],
        captions: [
          { id: 'c-1', scene_id: 's-1', start_second: 0, end_second: 5, text: 'Hello' },
        ],
        existingAssetIds: new Set(['img-1', 'img-2', 'aud-1', 'aud-2']),
      });

      assert.equal(readiness.canRender, true);
      assert.equal(readiness.missingVisuals.length, 0);
      assert.equal(readiness.missingAudios.length, 0);
      assert.equal(readiness.totalScenes, 2);
    });
  });

  describe('VideoRenderingAgent Execution', () => {
    it('STRICT NON-PLACEHOLDER RULE: Fails immediately with MissingAssetsError when visual requirements are pending', async () => {
      const client = createMockSupabaseClient({
        visualRequirements: [
          {
            id: 'vis-pending-1',
            production_package_id: 'pkg-001',
            scene_id: 'scene-1',
            prompt: 'Pending visual asset',
            status: 'pending',
            generation_required: true,
            content_asset_id: null,
          },
        ],
        contentAssets: [
          { id: 'asset-aud-1', project_id: 'proj-001', storage_path: 'projects/proj-001/audio/aud-1.mp3' },
          { id: 'asset-aud-2', project_id: 'proj-001', storage_path: 'projects/proj-001/audio/aud-2.mp3' },
        ],
      });

      const storage = new MockStorageProvider();
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      await assert.rejects(
        async () => {
          await agent.execute({
            client,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            storageProvider: storage,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MissingAssetsError, 'Error must be an instance of MissingAssetsError');
          assert.equal(err.readiness.canRender, false);
          assert.equal(err.readiness.missingVisuals.length, 1);
          assert.match(err.message, /Cannot render video: 1 visual requirement\(s\) and 0 audio requirement\(s\) are still pending/);
          return true;
        }
      );

      // Verify no renderer invocation happened
      assert.equal(customRenderer.callCount, 0, 'Renderer must not be called when assets are missing');
      // Verify no video file uploaded to storage
      assert.equal(storage.uploadedFiles.length, 0, 'No files should be uploaded');
    });

    it('successfully renders and persists video when all assets exist and are completed', async () => {
      const client = createMockSupabaseClient({
        visualRequirements: [
          {
            id: 'vis-done-1',
            production_package_id: 'pkg-001',
            scene_id: 'scene-1',
            status: 'completed',
            generation_required: true,
            content_asset_id: 'asset-vis-1',
            storage_path: 'projects/proj-001/images/vis-1.png',
          },
          {
            id: 'vis-done-2',
            production_package_id: 'pkg-001',
            scene_id: 'scene-2',
            status: 'completed',
            generation_required: true,
            content_asset_id: 'asset-vis-2',
            storage_path: 'projects/proj-001/images/vis-2.png',
          },
        ],
        audioRequirements: [
          {
            id: 'aud-done-1',
            production_package_id: 'pkg-001',
            scene_id: 'scene-1',
            audio_type: 'voiceover',
            status: 'completed',
            generation_required: true,
            content_asset_id: 'asset-aud-1',
            storage_path: 'projects/proj-001/audio/aud-1.mp3',
          },
          {
            id: 'aud-done-2',
            production_package_id: 'pkg-001',
            scene_id: 'scene-2',
            audio_type: 'voiceover',
            status: 'completed',
            generation_required: true,
            content_asset_id: 'asset-aud-2',
            storage_path: 'projects/proj-001/audio/aud-2.mp3',
          },
        ],
        contentAssets: [
          { id: 'asset-vis-1', project_id: 'proj-001', storage_path: 'projects/proj-001/images/vis-1.png' },
          { id: 'asset-vis-2', project_id: 'proj-001', storage_path: 'projects/proj-001/images/vis-2.png' },
          { id: 'asset-aud-1', project_id: 'proj-001', storage_path: 'projects/proj-001/audio/aud-1.mp3' },
          { id: 'asset-aud-2', project_id: 'proj-001', storage_path: 'projects/proj-001/audio/aud-2.mp3' },
        ],
      });

      const storage = new MockStorageProvider();
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      const result = await agent.execute({
        client,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        storageProvider: storage,
      });

      assert.equal(result.success, true);
      assert.equal(result.isReused, false);
      assert.equal(customRenderer.callCount, 1);
      assert.equal(result.videoMetadata.mimeType, 'video/mp4');
      assert.equal(result.videoMetadata.width, 1080);
      assert.equal(result.videoMetadata.height, 1920);

      // Verify file was uploaded to storage
      assert.equal(storage.uploadedFiles.length, 1);
      assert.equal(storage.uploadedFiles[0].bucket, 'content-assets');
      assert.match(storage.uploadedFiles[0].path, /projects\/proj-001\/videos\/.*\.mp4/);

      // Verify database persistence
      const videoAsset = client._contentAssets.find(a => a.asset_type === 'video');
      assert.ok(videoAsset, 'Video asset row must be created in content_assets');
      assert.equal(videoAsset.project_id, 'proj-001');

      // Verify agent_runs and job_stages
      assert.ok(client._agentRuns.length >= 1, 'Agent run must be recorded');
      assert.ok(client._jobStages.length >= 1, 'Job stage must be recorded');
    });

    it('IDEMPOTENCY: Reuses existing completed video asset without re-rendering', async () => {
      const existingVideo = {
        id: 'existing-video-123',
        project_id: 'proj-001',
        asset_type: 'video',
        storage_path: 'projects/proj-001/videos/existing-video-123.mp4',
        duration_seconds: 60,
        file_size: 1048576,
        mime_type: 'video/mp4',
        metadata: {
          production_package_id: 'pkg-001',
          width: 1080,
          height: 1920,
          fps: 30,
        },
        created_at: new Date().toISOString(),
      };

      const client = createMockSupabaseClient({
        contentAssets: [existingVideo],
      });

      const storage = new MockStorageProvider();
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      const result = await agent.execute({
        client,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        storageProvider: storage,
      });

      assert.equal(result.success, true);
      assert.equal(result.isReused, true);
      assert.equal(result.asset.id, 'existing-video-123');
      assert.equal(customRenderer.callCount, 0, 'Renderer must not be invoked when asset is reused');
      assert.equal(storage.uploadedFiles.length, 0, 'No files should be uploaded on reuse');
    });

    it('INVALID SCENE TIMING: Fails immediately when scene timing contains discontinuities or non-positive durations', async () => {
      const client = createMockSupabaseClient({
        scenes: [
          { id: 'scene-1', production_package_id: 'pkg-001', order: 1, start_second: 0, end_second: 10, purpose: 'Hook' },
          // Timing gap: Scene 2 starts at 15 instead of 10
          { id: 'scene-2', production_package_id: 'pkg-001', order: 2, start_second: 15, end_second: 25, purpose: 'Body' },
        ],
        visualRequirements: [
          { id: 'v-1', scene_id: 'scene-1', status: 'completed', content_asset_id: 'vis-1', generation_required: true },
          { id: 'v-2', scene_id: 'scene-2', status: 'completed', content_asset_id: 'vis-2', generation_required: true },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 'scene-1', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-1', generation_required: true },
          { id: 'a-2', scene_id: 'scene-2', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-2', generation_required: true },
        ],
        contentAssets: [
          { id: 'vis-1', project_id: 'proj-001', storage_path: 'p/1.png' },
          { id: 'vis-2', project_id: 'proj-001', storage_path: 'p/2.png' },
          { id: 'aud-1', project_id: 'proj-001', storage_path: 'p/1.mp3' },
          { id: 'aud-2', project_id: 'proj-001', storage_path: 'p/2.mp3' },
        ],
      });

      const storage = new MockStorageProvider();
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      await assert.rejects(
        async () => {
          await agent.execute({
            client,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            storageProvider: storage,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidSceneTimingError);
          assert.match(err.message, /Timing gap or overlap between Scene #1/);
          return true;
        }
      );

      assert.equal(customRenderer.callCount, 0);
      assert.equal(storage.uploadedFiles.length, 0);
    });

    it('STORAGE FAILURE: Handles storage upload error and marks job stage and agent run failed', async () => {
      const client = createMockSupabaseClient({
        visualRequirements: [
          { id: 'v-1', scene_id: 'scene-1', status: 'completed', content_asset_id: 'vis-1', generation_required: true },
          { id: 'v-2', scene_id: 'scene-2', status: 'completed', content_asset_id: 'vis-2', generation_required: true },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 'scene-1', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-1', generation_required: true },
          { id: 'a-2', scene_id: 'scene-2', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-2', generation_required: true },
        ],
        contentAssets: [
          { id: 'vis-1', project_id: 'proj-001', storage_path: 'p/1.png' },
          { id: 'vis-2', project_id: 'proj-001', storage_path: 'p/2.png' },
          { id: 'aud-1', project_id: 'proj-001', storage_path: 'p/1.mp3' },
          { id: 'aud-2', project_id: 'proj-001', storage_path: 'p/2.mp3' },
        ],
      });

      const storage = new MockStorageProvider();
      storage.shouldFail = true; // Force upload failure
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      await assert.rejects(
        async () => {
          await agent.execute({
            client,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            storageProvider: storage,
          });
        },
        /Simulated storage upload failure/
      );

      // Verify failure recorded in job stages and agent runs
      assert.ok(client._jobStages.some(s => s.status === 'failed'));
      assert.ok(client._agentRuns.some(r => r.status === 'failed'));
    });

    it('DATABASE PERSISTENCE FAILURE: Handles content_assets insert failure cleanly', async () => {
      const client = createMockSupabaseClient({
        failAssetPersistence: true, // Force DB insert failure
        visualRequirements: [
          { id: 'v-1', scene_id: 'scene-1', status: 'completed', content_asset_id: 'vis-1', generation_required: true },
          { id: 'v-2', scene_id: 'scene-2', status: 'completed', content_asset_id: 'vis-2', generation_required: true },
        ],
        audioRequirements: [
          { id: 'a-1', scene_id: 'scene-1', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-1', generation_required: true },
          { id: 'a-2', scene_id: 'scene-2', audio_type: 'voiceover', status: 'completed', content_asset_id: 'aud-2', generation_required: true },
        ],
        contentAssets: [
          { id: 'vis-1', project_id: 'proj-001', storage_path: 'p/1.png' },
          { id: 'vis-2', project_id: 'proj-001', storage_path: 'p/2.png' },
          { id: 'aud-1', project_id: 'proj-001', storage_path: 'p/1.mp3' },
          { id: 'aud-2', project_id: 'proj-001', storage_path: 'p/2.mp3' },
        ],
      });

      const storage = new MockStorageProvider();
      const customRenderer = new CustomMockVideoRenderer();
      const agent = new VideoRenderingAgent({
        renderer: customRenderer,
        storageProvider: storage,
      });

      await assert.rejects(
        async () => {
          await agent.execute({
            client,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            storageProvider: storage,
          });
        },
        /Database insert failure/
      );

      // Verify failure recorded in job stages and agent runs
      assert.ok(client._jobStages.some(s => s.status === 'failed'));
      assert.ok(client._agentRuns.some(r => r.status === 'failed'));
    });
  });
});

