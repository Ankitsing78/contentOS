/**
 * ContentOS - Image Generation Agent
 * Orchestrates visual graphic and image generation, dimension validation,
 * private Supabase storage persistence, content_assets recording, and
 * visual requirement status lifecycle tracking.
 */

import 'server-only';
import { SupabaseClient } from '@supabase/supabase-js';
import { IImageProvider, GeneratedImage } from '@/lib/media/image-provider';
import { GeminiImageProvider } from '@/lib/media/gemini-image-provider';
import { LocalImageProvider } from '@/lib/media/local-image-provider';
import { MockImageProvider } from '@/lib/media/mock-image-provider';
import { IMAGE_CONFIG, SupportedAspectRatio } from '@/lib/media/image-config';
import { IStorageProvider, CONTENT_ASSETS_BUCKET } from '@/lib/storage';
import { SupabaseStorageProvider } from '@/lib/storage/supabase-storage';
import {
  recordContentAsset,
  getContentAssetById,
} from '@/lib/database/repositories/assets';
import {
  getProductionVisualRequirementById,
  getFirstEligiblePendingVisualRequirement,
  updateProductionVisualRequirementStatus,
} from '@/lib/database/repositories/production';
import { ContentAssetRow } from '@/types';

export interface ExecuteImageGenerationInput {
  client: SupabaseClient;
  projectId: string;
  userId: string;
  jobId: string;
  productionPackageId?: string;
  requirementId?: string;
  imageProvider?: IImageProvider;
  storageProvider?: IStorageProvider;
}

export interface ImageGenerationResult {
  success: boolean;
  isReused: boolean;
  asset: ContentAssetRow;
  requirementId: string;
  visualRequirement: Record<string, unknown>;
  imageMetadata: {
    mimeType: string;
    fileExtension: string;
    width: number;
    height: number;
    aspectRatio: string;
    fileSizeBytes: number;
    provider: string;
    model: string;
  };
  storagePath: string;
  agentRunId?: string;
  jobStageId?: string;
}

export interface VisualRequirementEntity {
  id: string;
  production_package_id?: string;
  scene_id?: string | null;
  user_id?: string;
  asset_type: string;
  description?: string;
  prompt?: string | null;
  aspect_ratio?: string;
  resolution?: string;
  duration_seconds?: number | string;
  source?: string;
  generation_required: boolean;
  status: string;
  storage_path?: string | null;
  content_asset_id?: string | null;
  notes?: string | null;
}

/**
 * Factory function to retrieve the configured image provider.
 * Strictly avoids silent fallback between providers.
 */
export function getImageProvider(providerName?: string): IImageProvider {
  const selected = providerName || process.env.IMAGE_PROVIDER || IMAGE_CONFIG.provider;
  switch (selected) {
    case 'mock':
      return new MockImageProvider();
    case 'local':
      return new LocalImageProvider();
    case 'gemini':
      return new GeminiImageProvider();
    default:
      throw new Error(
        `Unknown image provider '${selected}'. Supported providers: 'gemini', 'local', 'mock'.`
      );
  }
}

export class ImageAgent {
  private imageProvider: IImageProvider;
  private storageProvider?: IStorageProvider;

  constructor(options?: {
    imageProvider?: IImageProvider;
    storageProvider?: IStorageProvider;
  }) {
    if (options?.imageProvider) {
      this.imageProvider = options.imageProvider;
    } else {
      this.imageProvider = getImageProvider();
    }
    this.storageProvider = options?.storageProvider;
  }

  async execute(input: ExecuteImageGenerationInput): Promise<ImageGenerationResult> {
    const { client, projectId, userId, jobId } = input;
    const provider = input.imageProvider || this.imageProvider;
    const storage = input.storageProvider || this.storageProvider || new SupabaseStorageProvider(client);

    console.log(
      `[ContentOS] [Image Agent] Starting visual generation for project ${projectId}, job ${jobId}`
    );

    // 1. Locate the target visual requirement
    let requirement: VisualRequirementEntity | null = null;

    if (input.requirementId) {
      requirement = (await getProductionVisualRequirementById(client, input.requirementId)) as VisualRequirementEntity | null;
    } else if (input.productionPackageId) {
      requirement = (await getFirstEligiblePendingVisualRequirement(client, input.productionPackageId)) as VisualRequirementEntity | null;
    } else {
      // Find latest production package for project first
      const { data: pkg } = await client
        .from('production_packages')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pkg?.id) {
        requirement = (await getFirstEligiblePendingVisualRequirement(client, pkg.id)) as VisualRequirementEntity | null;
      }
    }

    if (!requirement) {
      throw new Error(
        `No eligible pending visual requirement found for project ${projectId}`
      );
    }

    // 2. Validate requirement eligibility
    if (!requirement.generation_required) {
      throw new Error(`Requirement ${requirement.id} does not require generation.`);
    }

    if (!requirement.prompt || requirement.prompt.trim().length === 0) {
      throw new Error(`Requirement ${requirement.id} has no visual prompt.`);
    }

    const rawPrompt: string = requirement.prompt.trim();
    const targetAspectRatio = (requirement.aspect_ratio || IMAGE_CONFIG.defaultAspectRatio) as SupportedAspectRatio;

    // 3. Idempotency Check: Return existing asset if already completed
    if (requirement.status === 'completed') {
      console.log(
        `[ContentOS] [Image Agent] Requirement ${requirement.id} is already completed. Checking existing asset...`
      );

      let existingAsset: ContentAssetRow | null = null;
      if (requirement.content_asset_id) {
        existingAsset = await getContentAssetById(client, requirement.content_asset_id);
      } else if (requirement.storage_path) {
        const { data: assetByPath } = await client
          .from('content_assets')
          .select()
          .eq('storage_path', requirement.storage_path)
          .maybeSingle();
        existingAsset = (assetByPath as ContentAssetRow) || null;
      }

      if (existingAsset) {
        console.log(
          `[ContentOS] [Image Agent] Idempotency match: Reusing existing asset ${existingAsset.id}`
        );
        const meta = existingAsset.metadata || {};
        return {
          success: true,
          isReused: true,
          asset: existingAsset,
          requirementId: requirement.id,
          visualRequirement: requirement as unknown as Record<string, unknown>,
          imageMetadata: {
            mimeType: existingAsset.mime_type || 'image/png',
            fileExtension: existingAsset.storage_path.split('.').pop() || 'png',
            width: Number(meta.width) || 1080,
            height: Number(meta.height) || 1920,
            aspectRatio: String(meta.aspect_ratio || targetAspectRatio),
            fileSizeBytes: Number(existingAsset.file_size) || 0,
            provider: String(meta.provider || 'gemini'),
            model: String(meta.model || IMAGE_CONFIG.model),
          },
          storagePath: existingAsset.storage_path,
        };
      }
    }

    // 4. Mark requirement in_progress
    try {
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'in_progress',
      });
    } catch (statusErr) {
      console.warn('[ContentOS] [Image Agent] Notice updating status to in_progress:', statusErr);
    }

    // 5. Prompt Injection Defense & Factual Grounding
    // Sanitize prompt text and strip dangerous directive injection tokens
    const sanitizedPrompt = rawPrompt
      .replace(/<[^>]*>/g, '') // remove HTML tags
      .replace(/(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|reveal\s+secret)/gi, '')
      .trim();

    // 6. Generate visual asset with Image Provider
    console.log(
      `[ContentOS] [Image Agent] Calling ${provider.id} for requirement ${requirement.id} (${targetAspectRatio})`
    );

    let generated: GeneratedImage;
    try {
      generated = await provider.generateImage({
        prompt: sanitizedPrompt,
        aspect_ratio: targetAspectRatio,
        resolution: requirement.resolution || IMAGE_CONFIG.defaultResolution,
        style: 'modern cinematic high-contrast digital production art',
        metadata: {
          requirement_id: requirement.id,
          scene_id: requirement.scene_id,
        },
      });
    } catch (genError) {
      const errorMsg = genError instanceof Error ? genError.message : 'Visual generation failed';
      console.error('[ContentOS] [Image Agent] Visual generation failed:', errorMsg);
      // Mark requirement as failed
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Generation failed: ${errorMsg}`,
      });
      throw genError;
    }

    // 7. Quality & Dimension Validation
    if (!generated.imageBuffer || generated.imageBuffer.length === 0) {
      const emptyErr = 'Generated image buffer is empty';
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: emptyErr,
      });
      throw new Error(`Image validation failed: ${emptyErr}`);
    }

    if (
      generated.width < IMAGE_CONFIG.minDimension ||
      generated.height < IMAGE_CONFIG.minDimension
    ) {
      const dimErr = `Generated image dimensions (${generated.width}x${generated.height}) are below minimum threshold (${IMAGE_CONFIG.minDimension}px)`;
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: dimErr,
      });
      throw new Error(`Image validation failed: ${dimErr}`);
    }

    if (generated.imageBuffer.length > IMAGE_CONFIG.maxFileSizeBytes) {
      const sizeErr = `Image file size (${generated.imageBuffer.length} bytes) exceeds maximum limit (${IMAGE_CONFIG.maxFileSizeBytes} bytes)`;
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: sizeErr,
      });
      throw new Error(`Image validation failed: ${sizeErr}`);
    }

    // 8. Upload to Supabase Storage (Private content-assets bucket)
    const assetId = crypto.randomUUID();
    const storagePath = IMAGE_CONFIG.buildStoragePath(
      projectId,
      assetId,
      generated.fileExtension,
      requirement.scene_id
    );

    console.log(
      `[ContentOS] [Image Agent] Uploading ${generated.imageBuffer.byteLength} bytes to bucket '${CONTENT_ASSETS_BUCKET}' at '${storagePath}'`
    );

    try {
      await storage.upload(
        CONTENT_ASSETS_BUCKET,
        storagePath,
        generated.imageBuffer,
        generated.mimeType
      );
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : 'Storage upload failed';
      console.error('[ContentOS] [Image Agent] Storage upload failed:', msg);
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Storage upload failed: ${msg}`,
      });
      throw storageErr;
    }

    // 9. Persist Record to public.content_assets
    console.log('[ContentOS] [Image Agent] Persisting row to content_assets table');
    let assetRow: ContentAssetRow;
    try {
      assetRow = await recordContentAsset(client, {
        project_id: projectId,
        user_id: userId,
        asset_type: 'image',
        storage_path: storagePath,
        mime_type: generated.mimeType,
        file_size: generated.imageBuffer.byteLength,
        metadata: {
          asset_id: assetId,
          requirement_id: requirement.id,
          production_package_id: requirement.production_package_id,
          scene_id: requirement.scene_id,
          provider: generated.provider,
          model: generated.model,
          width: generated.width,
          height: generated.height,
          aspect_ratio: targetAspectRatio,
          detected_aspect_ratio: generated.metadata?.detectedAspectRatio || targetAspectRatio,
          prompt: sanitizedPrompt,
          is_live_generation: generated.provider === 'gemini',
        },
      });
    } catch (assetErr) {
      const msg = assetErr instanceof Error ? assetErr.message : 'Failed to record visual asset';
      console.error('[ContentOS] [Image Agent] Visual asset recording failed:', msg);
      await updateProductionVisualRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Asset persistence failed: ${msg}`,
      });
      throw assetErr;
    }

    // 10. Update production_visual_requirements row
    console.log(
      `[ContentOS] [Image Agent] Linking asset ${assetRow.id} to requirement ${requirement.id}`
    );
    const updatedRequirement = await updateProductionVisualRequirementStatus(client, requirement.id, {
      status: 'completed',
      contentAssetId: assetRow.id,
      storagePath,
      generationRequired: false,
      notes: `Generated with ${generated.provider} (${generated.model})`,
    });

    // 11. Audit History & Job Stages Tracking
    const now = new Date().toISOString();
    let agentRunId: string | undefined;
    let jobStageId: string | undefined;

    try {
      const { data: runRow } = await client
        .from('agent_runs')
        .insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Visual Generation Agent',
          status: 'completed',
          model: generated.model,
          input: {
            requirement_id: requirement.id,
            scene_id: requirement.scene_id,
            prompt_length: sanitizedPrompt.length,
            aspect_ratio: targetAspectRatio,
            provider: generated.provider,
          },
          output: {
            asset_id: assetRow.id,
            storage_path: storagePath,
            width: generated.width,
            height: generated.height,
            mime_type: generated.mimeType,
            file_size_bytes: generated.imageBuffer.byteLength,
          },
          completed_at: now,
        })
        .select('id')
        .single();

      agentRunId = runRow?.id;
    } catch (runErr) {
      console.warn('[ContentOS] [Image Agent] Notice recording agent_runs:', runErr);
    }

    try {
      // Check if visual_generation or asset_generation already exists for this job
      const { data: existingVisualStage } = await client
        .from('job_stages')
        .select('id, stage')
        .eq('job_id', jobId)
        .in('stage', ['visual_generation', 'asset_generation'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingVisualStage?.id) {
        jobStageId = existingVisualStage.id;
        await client
          .from('job_stages')
          .update({
            status: 'completed',
            completed_at: now,
            output: {
              completed_requirement_id: requirement.id,
              asset_id: assetRow.id,
              storage_path: storagePath,
              width: generated.width,
              height: generated.height,
            },
          })
          .eq('id', existingVisualStage.id);
      } else {
        let stageName = 'visual_generation';
        const { data: stageRow, error: stageErr } = await client
          .from('job_stages')
          .insert({
            job_id: jobId,
            stage: stageName,
            status: 'completed',
            started_at: now,
            completed_at: now,
            output: {
              completed_requirement_id: requirement.id,
              asset_id: assetRow.id,
              storage_path: storagePath,
              width: generated.width,
              height: generated.height,
            },
          })
          .select('id')
          .single();

        if (stageErr && stageErr.message?.includes('job_stages_stage_check')) {
          // Fall back to 'asset_generation' if migration 0006 is not yet applied
          stageName = 'asset_generation';
          const { data: fallbackStage } = await client
            .from('job_stages')
            .insert({
              job_id: jobId,
              stage: stageName,
              status: 'completed',
              started_at: now,
              completed_at: now,
              output: {
                sub_stage: 'visual_generation',
                completed_requirement_id: requirement.id,
                asset_id: assetRow.id,
                storage_path: storagePath,
                width: generated.width,
                height: generated.height,
              },
            })
            .select('id')
            .single();

          jobStageId = fallbackStage?.id;
        } else {
          jobStageId = stageRow?.id;
        }
      }
    } catch (stageErr) {
      console.warn('[ContentOS] [Image Agent] Notice updating job_stages:', stageErr);
    }

    console.log(
      `[ContentOS] [Image Agent] Visual generation successfully completed for requirement ${requirement.id}`
    );

    return {
      success: true,
      isReused: false,
      asset: assetRow,
      requirementId: requirement.id,
      visualRequirement: updatedRequirement,
      imageMetadata: {
        mimeType: generated.mimeType,
        fileExtension: generated.fileExtension,
        width: generated.width,
        height: generated.height,
        aspectRatio: targetAspectRatio,
        fileSizeBytes: generated.imageBuffer.byteLength,
        provider: generated.provider,
        model: generated.model,
      },
      storagePath,
      agentRunId,
      jobStageId,
    };
  }
}
