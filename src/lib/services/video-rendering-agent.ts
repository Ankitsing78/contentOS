/**
 * ContentOS - Video Rendering Agent Service
 * Orchestrates video timeline composition, asset verification, rendering, and persistence.
 * Strictly prevents silent placeholder substitution when visual assets are pending.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IStorageProvider, SupabaseStorageProvider, CONTENT_ASSETS_BUCKET } from '@/lib/storage';
import {
  IVideoRenderer,
  VideoCompositionSpecification,
  CompositionScene,
  RenderedVideo,
} from '@/lib/media/video-renderer';
import { MockVideoRenderer } from '@/lib/media/mock-video-renderer';
import {
  validateCompositionReadiness,
  CompositionReadiness,
  MissingAssetsError,
  InvalidSceneTimingError,
} from '@/lib/media/composition-validator';
import { AspectRatio } from '@/types/production';
import { ContentAssetRow } from '@/types';
import { recordContentAsset } from '@/lib/database/repositories/assets';

export interface ExecuteVideoRenderingInput {
  client: SupabaseClient;
  projectId: string;
  userId: string;
  jobId: string;
  productionPackageId?: string;
  renderer?: IVideoRenderer;
  storageProvider?: IStorageProvider;
}

export interface VideoRenderingResult {
  success: boolean;
  isReused: boolean;
  asset: ContentAssetRow;
  storagePath: string;
  videoMetadata: {
    mimeType: string;
    width: number;
    height: number;
    durationSeconds: number;
    fps: number;
    fileSizeBytes: number;
    renderer: string;
  };
  agentRunId?: string;
  jobStageId?: string;
  readiness: CompositionReadiness;
}

export class VideoRenderingAgent {
  private renderer: IVideoRenderer;
  private storageProvider?: IStorageProvider;

  constructor(options?: {
    renderer?: IVideoRenderer;
    storageProvider?: IStorageProvider;
  }) {
    this.renderer = options?.renderer || new MockVideoRenderer();
    this.storageProvider = options?.storageProvider;
  }

  /**
   * Evaluates readiness of the video composition without triggering rendering.
   */
  async checkReadiness(
    client: SupabaseClient,
    projectId: string,
    productionPackageId?: string
  ): Promise<{ readiness: CompositionReadiness; packageId: string }> {
    // 1. Locate production package
    let pkgId: string;
    if (productionPackageId) {
      pkgId = productionPackageId;
    } else {
      const { data: pkg } = await client
        .from('production_packages')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pkg?.id) {
        throw new Error(`No production package found for project ${projectId}`);
      }
      pkgId = pkg.id;
    }

    // 2. Fetch scenes
    const { data: rawScenes } = await client
      .from('production_scenes')
      .select('*')
      .eq('production_package_id', pkgId);

    const scenes = (rawScenes || [])
      .map((s: Record<string, unknown>) => ({
        id: String(s.id),
        order: Number(s.scene_order ?? s.order ?? 1),
        start_second: Number(s.start_second || 0),
        end_second: Number(s.end_second || 0),
      }))
      .sort((a, b) => a.order - b.order);

    // 3. Fetch visual requirements
    const { data: visualReqs } = await client
      .from('production_visual_requirements')
      .select('id, scene_id, status, prompt, content_asset_id, generation_required, storage_path')
      .eq('production_package_id', pkgId);

    // 4. Fetch audio requirements
    const { data: audioReqs } = await client
      .from('production_audio_requirements')
      .select('id, scene_id, audio_type, status, content_asset_id, generation_required, storage_path')
      .eq('production_package_id', pkgId);

    // 5. Fetch captions
    const { data: rawCaptions } = await client
      .from('production_captions')
      .select('*')
      .eq('production_package_id', pkgId);

    const captions = (rawCaptions || []).map((c: Record<string, unknown>) => ({
      id: String(c.id),
      scene_id: String(c.scene_id),
      start_second: Number(c.start_second || 0),
      end_second: Number(c.end_second || 0),
      text: String(c.caption_text ?? c.text ?? ''),
    }));

    // 6. Fetch existing content_assets for verification
    const { data: projectAssets } = await client
      .from('content_assets')
      .select('id')
      .eq('project_id', projectId);

    const existingAssetIds = new Set((projectAssets || []).map((a) => a.id));

    const readiness = validateCompositionReadiness({
      scenes: scenes || [],
      visualRequirements: visualReqs || [],
      audioRequirements: audioReqs || [],
      captions: captions || [],
      existingAssetIds,
    });

    return { readiness, packageId: pkgId };
  }

  /**
   * Executes the full video composition and rendering pipeline.
   */
  async execute(input: ExecuteVideoRenderingInput): Promise<VideoRenderingResult> {
    const { client, projectId, userId, jobId } = input;
    const renderer = input.renderer || this.renderer;
    const storage = input.storageProvider || this.storageProvider || new SupabaseStorageProvider(client);

    console.log(
      `[ContentOS] [Video Agent] Starting video composition for project ${projectId}, job ${jobId}`
    );

    // 1. Locate production package
    let pkg: Record<string, unknown> | null = null;
    if (input.productionPackageId) {
      const { data } = await client
        .from('production_packages')
        .select('*')
        .eq('id', input.productionPackageId)
        .maybeSingle();
      pkg = data;
    } else {
      const { data } = await client
        .from('production_packages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pkg = data;
    }

    if (!pkg?.id) {
      throw new Error(`No production package found for project ${projectId}`);
    }

    // 2. Fetch full package components
    const [scenesRes, visualReqsRes, audioReqsRes, captionsRes, assetsRes] = await Promise.all([
      client
        .from('production_scenes')
        .select('*')
        .eq('production_package_id', pkg.id),
      client
        .from('production_visual_requirements')
        .select('*')
        .eq('production_package_id', pkg.id),
      client
        .from('production_audio_requirements')
        .select('*')
        .eq('production_package_id', pkg.id),
      client
        .from('production_captions')
        .select('*')
        .eq('production_package_id', pkg.id)
        .order('start_second', { ascending: true }),
      client
        .from('content_assets')
        .select('*')
        .eq('project_id', projectId),
    ]);

    const rawScenes = scenesRes.data || [];
    const scenes = rawScenes
      .map((s: Record<string, unknown>) => ({
        ...s,
        id: String(s.id),
        order: Number(s.scene_order ?? s.order ?? 1),
        start_second: Number(s.start_second || 0),
        end_second: Number(s.end_second || 0),
        duration_seconds: Number(
          s.duration_seconds || (Number(s.end_second || 0) - Number(s.start_second || 0))
        ),
        purpose: String(s.purpose || ''),
      }))
      .sort((a, b) => a.order - b.order);

    const visualReqs = visualReqsRes.data || [];
    const audioReqs = audioReqsRes.data || [];
    const rawCaptions = captionsRes.data || [];
    const captions = rawCaptions.map((c: Record<string, unknown>) => ({
      ...c,
      id: String(c.id),
      scene_id: String(c.scene_id),
      start_second: Number(c.start_second || 0),
      end_second: Number(c.end_second || 0),
      text: String(c.caption_text ?? c.text ?? ''),
      emphasis_words: Array.isArray(c.emphasis_words) ? c.emphasis_words : [],
    }));
    const projectAssets: ContentAssetRow[] = assetsRes.data || [];

    const assetMap = new Map<string, ContentAssetRow>();
    for (const asset of projectAssets) {
      assetMap.set(asset.id, asset);
    }

    // 3. Check Idempotency: Has this video already been rendered?
    const existingVideo = projectAssets.find(
      (a) =>
        a.asset_type === 'video' &&
        (a.metadata as Record<string, unknown>)?.production_package_id === pkg.id
    );

    if (existingVideo) {
      console.log(
        `[ContentOS] [Video Agent] Idempotency match: Reusing existing video asset ${existingVideo.id}`
      );
      const meta = existingVideo.metadata || {};
      return {
        success: true,
        isReused: true,
        asset: existingVideo,
        storagePath: existingVideo.storage_path,
        videoMetadata: {
          mimeType: existingVideo.mime_type || 'video/mp4',
          width: Number(meta.width) || 1080,
          height: Number(meta.height) || 1920,
          durationSeconds: Number(meta.duration_seconds) || Number(pkg.duration_seconds) || 60,
          fps: Number(meta.fps) || 30,
          fileSizeBytes: Number(existingVideo.file_size) || 0,
          renderer: String(meta.renderer || renderer.id),
        },
        readiness: {
          canRender: true,
          totalScenes: scenes.length,
          completedScenes: scenes.length,
          missingVisuals: [],
          missingAudios: [],
          timingErrors: [],
          readyAssets: {
            visuals: visualReqs.length,
            audios: audioReqs.length,
            captions: captions.length,
          },
        },
      };
    }

    // 4. Strict Composition Readiness Validation
    const readiness = validateCompositionReadiness({
      scenes,
      visualRequirements: visualReqs,
      audioRequirements: audioReqs,
      captions,
      existingAssetIds: new Set(assetMap.keys()),
    });

    if (!readiness.canRender) {
      if (readiness.timingErrors && readiness.timingErrors.length > 0) {
        const timingMsg = `Cannot render video due to invalid scene timing: ${readiness.timingErrors.join('; ')}`;
        console.warn(`[ContentOS] [Video Agent] Validation halted: ${timingMsg}`);

        try {
          await client.from('agent_runs').insert({
            job_id: jobId,
            project_id: projectId,
            agent_name: 'Video Rendering Agent',
            status: 'failed',
            model: renderer.id,
            input: { package_id: pkg.id, scenes_count: scenes.length },
            output: { error: timingMsg, timingErrors: readiness.timingErrors },
            completed_at: new Date().toISOString(),
          });
        } catch (auditErr) {
          console.warn('[ContentOS] [Video Agent] Notice logging agent run failure:', auditErr);
        }

        throw new InvalidSceneTimingError(timingMsg, readiness.timingErrors);
      }

      const missingVisualCount = readiness.missingVisuals.length;
      const missingAudioCount = readiness.missingAudios.length;
      const failureMsg = `Cannot render video: ${missingVisualCount} visual requirement(s) and ${missingAudioCount} audio requirement(s) are still pending. Silent placeholder substitution is strictly prohibited.`;

      console.warn(`[ContentOS] [Video Agent] Validation halted: ${failureMsg}`);

      // Record audit failure in agent_runs
      try {
        await client.from('agent_runs').insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Video Rendering Agent',
          status: 'failed',
          model: renderer.id,
          input: {
            package_id: pkg.id,
            platform: pkg.platform,
            scenes_count: scenes.length,
          },
          output: {
            error: failureMsg,
            readiness,
          },
          completed_at: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn('[ContentOS] [Video Agent] Notice logging agent run failure:', auditErr);
      }

      throw new MissingAssetsError(failureMsg, readiness);
    }

    // 5. Download Media Asset Buffers & Assemble Composition Timeline
    console.log(
      `[ContentOS] [Video Agent] All assets validated. Assembling composition for ${scenes.length} scenes.`
    );

    const compositionScenes: CompositionScene[] = [];

    for (const scene of scenes) {
      // Locate the primary visual requirement for this scene
      const sceneVisual = visualReqs.find(
        (v) => v.scene_id === scene.id && v.status === 'completed' && v.content_asset_id
      );

      if (!sceneVisual || !sceneVisual.content_asset_id) {
        throw new Error(`Scene ${scene.order} is missing completed visual asset.`);
      }

      const visualAssetRow = assetMap.get(sceneVisual.content_asset_id);
      if (!visualAssetRow) {
        throw new Error(
          `Visual asset record ${sceneVisual.content_asset_id} not found in database.`
        );
      }

      // Download visual asset buffer from private storage
      const { data: visualDownload, error: vDownErr } = await client.storage
        .from(CONTENT_ASSETS_BUCKET)
        .download(visualAssetRow.storage_path);

      if (vDownErr || !visualDownload) {
        throw new Error(
          `Failed to download visual asset ${visualAssetRow.id} from storage: ${vDownErr?.message}`
        );
      }

      const visualBuffer = Buffer.from(await visualDownload.arrayBuffer());

      // Locate narration audio for this scene if present
      let narrationAssetSpec: CompositionScene['narrationAsset'];
      const sceneNarration = audioReqs.find(
        (a) =>
          a.scene_id === scene.id &&
          a.audio_type === 'voiceover' &&
          a.status === 'completed' &&
          a.content_asset_id
      );

      if (sceneNarration && sceneNarration.content_asset_id) {
        const audioAssetRow = assetMap.get(sceneNarration.content_asset_id);
        if (audioAssetRow) {
          const { data: audioDownload } = await client.storage
            .from(CONTENT_ASSETS_BUCKET)
            .download(audioAssetRow.storage_path);

          if (audioDownload) {
            narrationAssetSpec = {
              assetId: audioAssetRow.id,
              storagePath: audioAssetRow.storage_path,
              mimeType: audioAssetRow.mime_type || 'audio/wav',
              buffer: Buffer.from(await audioDownload.arrayBuffer()),
              durationSeconds: scene.end_second - scene.start_second,
            };
          }
        }
      }

      // Collect captions for this scene
      const sceneCaptions = captions
        .filter((c) => c.scene_id === scene.id)
        .map((c) => ({
          id: c.id,
          startSecond: c.start_second,
          endSecond: c.end_second,
          text: c.text,
          emphasisWords: c.emphasis_words || [],
        }));

      compositionScenes.push({
        sceneId: scene.id,
        order: scene.order,
        startSecond: scene.start_second,
        endSecond: scene.end_second,
        durationSeconds: scene.duration_seconds || scene.end_second - scene.start_second,
        purpose: scene.purpose,
        visualAsset: {
          assetId: visualAssetRow.id,
          storagePath: visualAssetRow.storage_path,
          mimeType: visualAssetRow.mime_type || 'image/png',
          buffer: visualBuffer,
          width: Number(visualAssetRow.metadata?.width) || 1080,
          height: Number(visualAssetRow.metadata?.height) || 1920,
        },
        narrationAsset: narrationAssetSpec,
        captions: sceneCaptions,
      });
    }

    // 6. Execute Video Rendering Engine
    const isPortrait = pkg.aspect_ratio === '9:16';
    const dimensions = isPortrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

    const spec: VideoCompositionSpecification = {
      projectId,
      jobId,
      productionPackageId: String(pkg.id),
      platform: String(pkg.platform || 'instagram'),
      aspectRatio: (pkg.aspect_ratio as AspectRatio) || '9:16',
      dimensions,
      fps: 30,
      totalDurationSeconds: Number(pkg.duration_seconds) || 60,
      scenes: compositionScenes,
    };

    console.log(
      `[ContentOS] [Video Agent] Invoking renderer '${renderer.id}' (${spec.dimensions.width}x${spec.dimensions.height}, ${spec.totalDurationSeconds}s)`
    );

    let rendered: RenderedVideo;
    try {
      rendered = await renderer.renderVideo(spec);
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : 'Render execution failed';
      console.error('[ContentOS] [Video Agent] Video rendering failed:', msg);
      throw renderErr;
    }

    // 7. Validate Rendered Output
    if (!rendered.videoBuffer || rendered.videoBuffer.length === 0) {
      throw new Error('Video rendering failed: Rendered output buffer is empty.');
    }

    // 8. Upload Rendered Video to Private Storage Bucket
    const assetId = crypto.randomUUID();
    const storagePath = `projects/${projectId}/videos/${assetId}.${rendered.fileExtension}`;

    console.log(
      `[ContentOS] [Video Agent] Uploading rendered video (${rendered.videoBuffer.byteLength} bytes) to '${storagePath}'`
    );

    try {
      await storage.upload(
        CONTENT_ASSETS_BUCKET,
        storagePath,
        rendered.videoBuffer,
        rendered.mimeType
      );
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Storage upload failed';
      console.error('[ContentOS] [Video Agent] Video storage upload failed:', msg);

      try {
        await client.from('agent_runs').insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Video Rendering Agent',
          status: 'failed',
          model: renderer.id,
          input: { package_id: pkg.id },
          output: { error: msg },
          completed_at: new Date().toISOString(),
        });
        await client.from('job_stages').insert({
          job_id: jobId,
          stage: 'video_rendering',
          status: 'failed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          output: { error: msg },
        });
      } catch (logErr) {
        console.warn('[ContentOS] [Video Agent] Notice recording stage failure:', logErr);
      }

      throw uploadErr;
    }

    // 9. Persist Record in public.content_assets
    console.log('[ContentOS] [Video Agent] Persisting row in content_assets table');
    let assetRow: ContentAssetRow;
    try {
      assetRow = await recordContentAsset(client, {
        project_id: projectId,
        user_id: userId,
        asset_type: 'video',
        storage_path: storagePath,
        mime_type: rendered.mimeType,
        file_size: rendered.videoBuffer.byteLength,
        metadata: {
          asset_id: assetId,
          production_package_id: String(pkg.id),
          platform: String(pkg.platform || 'instagram'),
          aspect_ratio: String(pkg.aspect_ratio || '9:16'),
          width: rendered.width,
          height: rendered.height,
          duration_seconds: rendered.durationSeconds,
          fps: rendered.fps,
          renderer: rendered.renderer,
          scenes_count: compositionScenes.length,
          rendered_at: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : 'Failed to record video asset';
      console.error('[ContentOS] [Video Agent] Video asset recording failed:', msg);

      try {
        await client.from('agent_runs').insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Video Rendering Agent',
          status: 'failed',
          model: renderer.id,
          input: { package_id: pkg.id },
          output: { error: msg },
          completed_at: new Date().toISOString(),
        });
        await client.from('job_stages').insert({
          job_id: jobId,
          stage: 'video_rendering',
          status: 'failed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          output: { error: msg },
        });
      } catch (logErr) {
        console.warn('[ContentOS] [Video Agent] Notice recording stage failure:', logErr);
      }

      throw dbErr;
    }

    // 10. Audit History & Job Stages Tracking
    const now = new Date().toISOString();
    let agentRunId: string | undefined;
    let jobStageId: string | undefined;

    try {
      const { data: runRow } = await client
        .from('agent_runs')
        .insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Video Rendering Agent',
          status: 'completed',
          model: rendered.renderer,
          input: {
            package_id: pkg.id,
            platform: pkg.platform,
            aspect_ratio: pkg.aspect_ratio,
            scenes_count: compositionScenes.length,
            duration_seconds: rendered.durationSeconds,
          },
          output: {
            asset_id: assetRow.id,
            storage_path: storagePath,
            width: rendered.width,
            height: rendered.height,
            duration_seconds: rendered.durationSeconds,
            file_size_bytes: rendered.videoBuffer.byteLength,
          },
          completed_at: now,
        })
        .select('id')
        .single();

      agentRunId = runRow?.id;
    } catch (runErr) {
      console.warn('[ContentOS] [Video Agent] Notice recording agent_runs:', runErr);
    }

    try {
      // Update job_stages with video_rendering (or fallback to asset_generation)
      const { data: stageRow, error: stageErr } = await client
        .from('job_stages')
        .insert({
          job_id: jobId,
          stage: 'video_rendering',
          status: 'completed',
          started_at: now,
          completed_at: now,
          output: {
            asset_id: assetRow.id,
            storage_path: storagePath,
            duration_seconds: rendered.durationSeconds,
            width: rendered.width,
            height: rendered.height,
          },
        })
        .select('id')
        .single();

      if (stageErr && stageErr.message?.includes('job_stages_stage_check')) {
        // Fall back to asset_generation if migration 0007 is pending in SQL editor
        const { data: fallbackStage } = await client
          .from('job_stages')
          .insert({
            job_id: jobId,
            stage: 'asset_generation',
            status: 'completed',
            started_at: now,
            completed_at: now,
            output: {
              sub_stage: 'video_rendering',
              asset_id: assetRow.id,
              storage_path: storagePath,
            },
          })
          .select('id')
          .single();
        jobStageId = fallbackStage?.id;
      } else {
        jobStageId = stageRow?.id;
      }
    } catch (stageErr) {
      console.warn('[ContentOS] [Video Agent] Notice updating job_stages:', stageErr);
    }

    console.log(
      `[ContentOS] [Video Agent] Video rendering successfully completed for package ${pkg.id}`
    );

    return {
      success: true,
      isReused: false,
      asset: assetRow,
      storagePath,
      videoMetadata: {
        mimeType: rendered.mimeType,
        width: rendered.width,
        height: rendered.height,
        durationSeconds: rendered.durationSeconds,
        fps: rendered.fps,
        fileSizeBytes: rendered.videoBuffer.byteLength,
        renderer: rendered.renderer,
      },
      agentRunId,
      jobStageId,
      readiness,
    };
  }
}
