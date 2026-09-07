/**
 * ContentOS - Voice Agent & TTS Provider Unit Tests
 * Uses mocked Gemini responses. No live API calls in unit tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAudioMetadata } from '@/lib/media/audio-parser';
import { GeminiVoiceProvider } from '@/lib/media/gemini-voice-provider';
import { IVoiceProvider, GeneratedAudio, VoiceGenerationRequest } from '@/lib/media/voice-provider';
import { VoiceAgent } from '@/lib/services/voice-agent';
import { IStorageProvider, StorageUploadResult } from '@/lib/storage';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a valid PCM WAV buffer in memory with specified sample rate and duration.
 */
function createSyntheticWavBuffer(durationSeconds: number, sampleRate: number = 24000, channels: number = 1): Buffer {
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 4);
  buf.write('WAVE', 8, 'ascii');

  // fmt chunk
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buf.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); // BitsPerSample

  // data chunk
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  // Fill audio sample data with simple silence/dither
  buf.fill(0, 44);

  return buf;
}

/**
 * Mock Voice Provider for testing VoiceAgent orchestration without live Gemini
 */
class MockVoiceProvider implements IVoiceProvider {
  readonly id = 'mock-voice-provider';
  public callCount = 0;
  public lastRequest?: VoiceGenerationRequest;
  public mockDuration: number;
  public shouldFail: boolean = false;
  public failureMessage: string = 'Simulated TTS failure';

  constructor(options?: { duration?: number; shouldFail?: boolean }) {
    this.mockDuration = options?.duration ?? 6.9;
    this.shouldFail = options?.shouldFail ?? false;
  }

  async generateSpeech(request: VoiceGenerationRequest): Promise<GeneratedAudio> {
    this.callCount++;
    this.lastRequest = request;

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const audioBuffer = createSyntheticWavBuffer(this.mockDuration);
    const parsed = parseAudioMetadata(audioBuffer, 'audio/wav');

    return {
      audioBuffer,
      mimeType: parsed.mimeType,
      fileExtension: parsed.fileExtension,
      durationSeconds: parsed.durationSeconds,
      sampleRate: parsed.sampleRate,
      channels: parsed.channels,
      provider: 'mock-gemini',
      model: 'gemini-3.1-flash-tts-preview',
      metadata: {
        textLength: request.text.length,
        style: request.speaking_style,
      },
    };
  }
}

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

interface MockAudioRequirement {
  id: string;
  production_package_id: string;
  audio_type: string;
  description: string;
  text: string | null;
  voice_requirement: string | null;
  duration_seconds: number;
  generation_required: boolean;
  status: string;
  storage_path: string | null;
  content_asset_id: string | null;
  notes: string | null;
  [key: string]: unknown;
}

interface MockAssetRow {
  id: string;
  project_id: string;
  user_id: string;
  asset_type: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  metadata: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Mock Supabase Database Client
 */
function createMockSupabaseClient(options?: {
  existingRequirement?: MockAudioRequirement;
  existingAsset?: MockAssetRow;
  failAssetPersistence?: boolean;
}) {
  let requirement: MockAudioRequirement = options?.existingRequirement || {
    id: 'req-audio-001',
    production_package_id: 'pkg-001',
    audio_type: 'voiceover',
    description: 'Scene 1 Voiceover',
    text: 'Think AI is taking your software engineering job? Think again.',
    voice_requirement: 'Punchy and authoritative',
    duration_seconds: 6.9,
    generation_required: true,
    status: 'pending',
    storage_path: null,
    content_asset_id: null,
    notes: null,
  };

  const assets: MockAssetRow[] = options?.existingAsset ? [options.existingAsset] : [];
  const agentRuns: Record<string, unknown>[] = [];
  const jobStages: Record<string, unknown>[] = [];
  const jobs: Record<string, unknown>[] = [{ id: 'job-001', status: 'completed' }];

  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          eq: (col2: string, val2: unknown) => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => {
                  if (table === 'production_audio_requirements') {
                    if (requirement[col] === val && requirement[col2] === val2) return { data: requirement, error: null };
                    return { data: null, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
            }),
            maybeSingle: async () => {
              if (table === 'job_stages') {
                const stage = jobStages.find((s) => s.job_id === val && s.stage === val2);
                return { data: stage || null, error: null };
              }
              return { data: null, error: null };
            },
          }),
          order: () => ({
            limit: () => ({
              maybeSingle: async () => {
                if (table === 'production_packages') return { data: { id: 'pkg-001' }, error: null };
                return { data: null, error: null };
              },
            }),
          }),
          maybeSingle: async () => {
            if (table === 'production_audio_requirements') {
              if (requirement[col] === val) return { data: requirement, error: null };
              return { data: null, error: null };
            }
            if (table === 'content_assets') {
              const a = assets.find((item) => item[col] === val);
              return { data: a || null, error: null };
            }
            if (table === 'jobs') {
              return { data: jobs[0], error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (table === 'content_assets') {
              if (options?.failAssetPersistence) {
                throw new Error('Database constraint error on content_assets insert');
              }
              const row: MockAssetRow = {
                id: (payload.id as string) || 'asset-' + Math.random().toString(36).slice(2, 8),
                project_id: (payload.project_id as string) || 'proj-001',
                user_id: (payload.user_id as string) || 'user-001',
                asset_type: (payload.asset_type as string) || 'audio',
                storage_path: (payload.storage_path as string) || '',
                mime_type: (payload.mime_type as string) || 'audio/wav',
                file_size: (payload.file_size as number) || 0,
                metadata: (payload.metadata as Record<string, unknown>) || {},
                created_at: new Date().toISOString(),
                ...payload,
              };
              assets.push(row);
              return { data: row, error: null };
            }
            if (table === 'agent_runs') {
              const runRow = { id: 'run-001', ...payload };
              agentRuns.push(runRow);
              return { data: runRow, error: null };
            }
            if (table === 'job_stages') {
              const stageRow = { id: 'stage-001', ...payload };
              jobStages.push(stageRow);
              return { data: stageRow, error: null };
            }
            return { data: payload, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => ({
          select: () => ({
            single: async () => {
              if (table === 'production_audio_requirements' && requirement[col] === val) {
                requirement = { ...requirement, ...payload };
                return { data: requirement, error: null };
              }
              return { data: payload, error: null };
            },
          }),
        }),
      }),
    }),
    _getRequirement: () => requirement,
    _getAssets: () => assets,
    _getAgentRuns: () => agentRuns,
  };
}

describe('Voice Generation Unit Tests (Step 8B-1)', () => {
  describe('1. Audio Parser & Metadata Extraction', () => {
    it('accurately parses WAV header sample rate, channels, bit depth, and duration', () => {
      const durationSeconds = 6.9;
      const wavBuffer = createSyntheticWavBuffer(durationSeconds, 24000, 1);
      const metadata = parseAudioMetadata(wavBuffer, 'audio/wav');

      assert.equal(metadata.mimeType, 'audio/wav');
      assert.equal(metadata.fileExtension, 'wav');
      assert.equal(metadata.sampleRate, 24000);
      assert.equal(metadata.channels, 1);
      assert.equal(metadata.bitsPerSample, 16);
      assert.ok(metadata.durationSeconds !== undefined);
      assert.ok(Math.abs(metadata.durationSeconds - durationSeconds) < 0.1);
    });

    it('handles simulated MP3 header and calculates duration based on bitrate', () => {
      // 128kbps = 16000 bytes/sec -> 32000 bytes = ~2.0s
      const mp3Buf = Buffer.alloc(32000);
      mp3Buf[0] = 0xff;
      mp3Buf[1] = 0xfb; // MPEG Audio sync word
      const meta = parseAudioMetadata(mp3Buf, 'audio/mpeg');

      assert.equal(meta.mimeType, 'audio/mpeg');
      assert.equal(meta.fileExtension, 'mp3');
      assert.ok(meta.durationSeconds !== undefined && meta.durationSeconds > 1.8 && meta.durationSeconds < 2.2);
    });
  });

  describe('2. Provider Initialization & Boundaries', () => {
    it('throws descriptive error if GEMINI_API_KEY is missing or placeholder', () => {
      assert.throws(
        () => new GeminiVoiceProvider('YOUR_GEMINI_KEY'),
        /requires a valid GEMINI_API_KEY/
      );
      assert.throws(
        () => new GeminiVoiceProvider(''),
        /requires a valid GEMINI_API_KEY/
      );
    });
  });

  describe('3. Voice Agent Orchestration & Verification', () => {
    it('synthesizes speech, uploads to storage, and links to production requirement', async () => {
      const mockVoice = new MockVoiceProvider({ duration: 6.9 });
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new VoiceAgent({
        voiceProvider: mockVoice,
        storageProvider: mockStorage,
      });

      const result = await agent.execute({
        client: mockClient as unknown as SupabaseClient,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        requirementId: 'req-audio-001',
      });

      // Verification
      assert.equal(result.success, true);
      assert.equal(result.isReused, false);
      assert.equal(mockVoice.callCount, 1);
      assert.equal(mockStorage.uploadedFiles.length, 1);
      assert.ok(mockStorage.uploadedFiles[0].path.startsWith('projects/proj-001/audio/narration/'));

      // Storage verification
      assert.equal(result.audioMetadata.mimeType, 'audio/wav');
      assert.equal(result.audioMetadata.fileExtension, 'wav');
      assert.ok(result.audioMetadata.durationSeconds! > 6.0);

      // Requirement updated
      const updatedReq = mockClient._getRequirement();
      assert.equal(updatedReq.status, 'completed');
      assert.ok(updatedReq.storage_path?.includes('.wav'));

      // Content asset recorded
      const assets = mockClient._getAssets();
      assert.equal(assets.length, 1);
      assert.equal(assets[0].asset_type, 'audio');
    });

    it('enforces idempotency when requirement is already completed', async () => {
      const existingAsset = {
        id: 'asset-existing-123',
        project_id: 'proj-001',
        user_id: 'user-001',
        asset_type: 'audio',
        storage_path: 'projects/proj-001/audio/narration/asset-existing-123.wav',
        mime_type: 'audio/wav',
        file_size: 331244,
        metadata: { duration_seconds: 6.9, provider: 'gemini' },
      };

      const existingRequirement: MockAudioRequirement = {
        id: 'req-audio-001',
        production_package_id: 'pkg-001',
        audio_type: 'voiceover',
        description: 'Scene 1 Voiceover',
        text: 'Think AI is taking your software engineering job? Think again.',
        voice_requirement: 'Punchy and authoritative',
        duration_seconds: 6.9,
        generation_required: true,
        status: 'completed',
        content_asset_id: 'asset-existing-123',
        storage_path: existingAsset.storage_path,
        notes: null,
      };

      const mockVoice = new MockVoiceProvider();
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({
        existingRequirement,
        existingAsset,
      });

      const agent = new VoiceAgent({
        voiceProvider: mockVoice,
        storageProvider: mockStorage,
      });

      const result = await agent.execute({
        client: mockClient as unknown as SupabaseClient,
        projectId: 'proj-001',
        userId: 'user-001',
        jobId: 'job-001',
        requirementId: 'req-audio-001',
      });

      assert.equal(result.success, true);
      assert.equal(result.isReused, true);
      assert.equal(result.asset.id, 'asset-existing-123');
      // No duplicate TTS call
      assert.equal(mockVoice.callCount, 0);
      // No duplicate storage upload
      assert.equal(mockStorage.uploadedFiles.length, 0);
    });

    it('rejects synthesis when duration deviation significantly exceeds threshold', async () => {
      // Planned duration is 6.9s, but mock returns 25.0s (massive deviation > 5s and > 50%)
      const mockVoice = new MockVoiceProvider({ duration: 25.0 });
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient();

      const agent = new VoiceAgent({
        voiceProvider: mockVoice,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-audio-001',
          }),
        /exceeds acceptable threshold/
      );

      // Requirement marked failed, NOT falsely completed
      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.equal(mockStorage.uploadedFiles.length, 0);
    });

    it('does not mark requirement completed if storage upload fails', async () => {
      const mockVoice = new MockVoiceProvider({ duration: 6.9 });
      const mockStorage = new MockStorageProvider();
      mockStorage.shouldFail = true; // Fail upload
      const mockClient = createMockSupabaseClient();

      const agent = new VoiceAgent({
        voiceProvider: mockVoice,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-audio-001',
          }),
        /Simulated storage upload failure/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.ok(req.notes?.includes('Storage upload failed'));
      // No asset created
      assert.equal(mockClient._getAssets().length, 0);
    });

    it('does not mark requirement completed if database asset persistence fails', async () => {
      const mockVoice = new MockVoiceProvider({ duration: 6.9 });
      const mockStorage = new MockStorageProvider();
      const mockClient = createMockSupabaseClient({ failAssetPersistence: true });

      const agent = new VoiceAgent({
        voiceProvider: mockVoice,
        storageProvider: mockStorage,
      });

      await assert.rejects(
        () =>
          agent.execute({
            client: mockClient as unknown as SupabaseClient,
            projectId: 'proj-001',
            userId: 'user-001',
            jobId: 'job-001',
            requirementId: 'req-audio-001',
          }),
        /Database constraint error on content_assets insert/
      );

      const req = mockClient._getRequirement();
      assert.equal(req.status, 'failed');
      assert.ok(req.notes?.includes('Asset persistence failed'));
    });
  });
});
