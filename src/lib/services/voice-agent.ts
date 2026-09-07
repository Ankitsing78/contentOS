/**
 * ContentOS - Voice Generation Agent
 * Orchestrates TTS voice synthesis, duration validation, private storage persistence,
 * content_assets record creation, and audio requirement status lifecycle tracking.
 */

import 'server-only';
import { SupabaseClient } from '@supabase/supabase-js';
import { IVoiceProvider, GeneratedAudio } from '@/lib/media/voice-provider';
import { GeminiVoiceProvider } from '@/lib/media/gemini-voice-provider';
import { VOICE_CONFIG, buildNarrationStoragePath } from '@/lib/media/voice-config';
import { IStorageProvider, CONTENT_ASSETS_BUCKET } from '@/lib/storage';
import { SupabaseStorageProvider } from '@/lib/storage/supabase-storage';
import {
  recordContentAsset,
  getContentAssetById,
} from '@/lib/database/repositories/assets';
import {
  getProductionAudioRequirementById,
  getFirstEligiblePendingVoiceRequirement,
  updateProductionAudioRequirementStatus,
} from '@/lib/database/repositories/production';
import { ContentAssetRow } from '@/types';

export interface ExecuteVoiceGenerationInput {
  client: SupabaseClient;
  projectId: string;
  userId: string;
  jobId: string;
  productionPackageId?: string;
  requirementId?: string;
  voiceProvider?: IVoiceProvider;
  storageProvider?: IStorageProvider;
}

export interface VoiceGenerationResult {
  success: boolean;
  isReused: boolean;
  asset: ContentAssetRow;
  requirementId: string;
  audioRequirement: Record<string, unknown>;
  audioMetadata: {
    mimeType: string;
    fileExtension: string;
    durationSeconds?: number;
    plannedDurationSeconds: number;
    durationDeviationSeconds?: number;
    fileSizeBytes: number;
    provider: string;
    model: string;
  };
  storagePath: string;
  agentRunId?: string;
  jobStageId?: string;
}

export class VoiceAgent {
  private voiceProvider: IVoiceProvider;
  private storageProvider?: IStorageProvider;

  constructor(options?: {
    voiceProvider?: IVoiceProvider;
    storageProvider?: IStorageProvider;
  }) {
    this.voiceProvider = options?.voiceProvider || new GeminiVoiceProvider();
    this.storageProvider = options?.storageProvider;
  }

  async execute(input: ExecuteVoiceGenerationInput): Promise<VoiceGenerationResult> {
    const { client, projectId, userId, jobId } = input;
    const provider = input.voiceProvider || this.voiceProvider;
    const storage = input.storageProvider || this.storageProvider || new SupabaseStorageProvider(client);

    console.log(
      `[ContentOS] [Voice Agent] Starting voice generation for project ${projectId}, job ${jobId}`
    );

    // 1. Locate the target audio requirement
    let requirement: {
      id: string;
      production_package_id?: string;
      scene_id?: string | null;
      user_id?: string;
      audio_type: string;
      description?: string;
      text?: string | null;
      voice_requirement?: string | null;
      duration_seconds: number | string;
      generation_required: boolean;
      status: string;
      storage_path?: string | null;
      content_asset_id?: string | null;
      notes?: string | null;
    } | null = null;

    if (input.requirementId) {
      requirement = (await getProductionAudioRequirementById(client, input.requirementId)) as typeof requirement;
    } else if (input.productionPackageId) {
      requirement = (await getFirstEligiblePendingVoiceRequirement(client, input.productionPackageId)) as typeof requirement;
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
        requirement = await getFirstEligiblePendingVoiceRequirement(client, pkg.id);
      }
    }

    if (!requirement) {
      throw new Error(
        `No eligible pending voiceover requirement found for project ${projectId}`
      );
    }

    // 2. Validate requirement eligibility
    if (requirement.audio_type !== 'voiceover') {
      throw new Error(
        `Requirement ${requirement.id} is of type '${requirement.audio_type}'. Only 'voiceover' audio is eligible for TTS.`
      );
    }

    if (!requirement.generation_required) {
      throw new Error(`Requirement ${requirement.id} does not require generation.`);
    }

    if (!requirement.text || requirement.text.trim().length === 0) {
      throw new Error(`Requirement ${requirement.id} has no narration text.`);
    }

    const narrationText: string = requirement.text.trim();
    const plannedDuration: number = Number(requirement.duration_seconds) || 0;

    // 3. Idempotency Check: Return existing asset if already completed
    if (requirement.status === 'completed') {
      console.log(
        `[ContentOS] [Voice Agent] Requirement ${requirement.id} is already completed. Checking existing asset...`
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
          `[ContentOS] [Voice Agent] Idempotency match: Reusing existing asset ${existingAsset.id}`
        );
        return {
          success: true,
          isReused: true,
          asset: existingAsset,
          requirementId: requirement.id,
          audioRequirement: requirement,
          audioMetadata: {
            mimeType: existingAsset.mime_type || 'audio/wav',
            fileExtension: existingAsset.storage_path.split('.').pop() || 'wav',
            durationSeconds: (existingAsset.metadata?.duration_seconds as number) || plannedDuration,
            plannedDurationSeconds: plannedDuration,
            durationDeviationSeconds: 0,
            fileSizeBytes: Number(existingAsset.file_size) || 0,
            provider: (existingAsset.metadata?.provider as string) || 'gemini',
            model: (existingAsset.metadata?.model as string) || VOICE_CONFIG.model,
          },
          storagePath: existingAsset.storage_path,
        };
      }
    }

    // 4. Mark requirement in_progress
    try {
      await updateProductionAudioRequirementStatus(client, requirement.id, {
        status: 'in_progress',
      });
    } catch (statusErr) {
      console.warn('[ContentOS] [Voice Agent] Notice updating status to in_progress:', statusErr);
    }

    // 5. Generate speech with Voice Provider
    console.log(
      `[ContentOS] [Voice Agent] Calling ${provider.id} TTS for requirement ${requirement.id} (${narrationText.length} chars)`
    );

    let generated: GeneratedAudio;
    try {
      generated = await provider.generateSpeech({
        text: narrationText,
        voice: VOICE_CONFIG.defaultVoice,
        speaking_style: requirement.voice_requirement || VOICE_CONFIG.defaultSpeakingStyle,
        pace: VOICE_CONFIG.defaultPace,
        expectedDurationSeconds: plannedDuration,
      });
    } catch (synthError) {
      const errorMsg = synthError instanceof Error ? synthError.message : 'Speech synthesis failed';
      console.error('[ContentOS] [Voice Agent] Speech synthesis failed:', errorMsg);
      // Mark requirement as failed
      await updateProductionAudioRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Generation failed: ${errorMsg}`,
      });
      throw synthError;
    }

    // 6. Validate Duration & Deviation
    const actualDuration = generated.durationSeconds;
    let deviationSeconds: number | undefined;

    if (actualDuration !== undefined && plannedDuration > 0) {
      deviationSeconds = Math.round(Math.abs(actualDuration - plannedDuration) * 100) / 100;
      console.log(
        `[ContentOS] [Voice Agent] Duration analysis: Planned ${plannedDuration}s | Actual ${actualDuration}s | Deviation ${deviationSeconds}s`
      );

      // Check against acceptance threshold
      const isExcessive =
        deviationSeconds > VOICE_CONFIG.maxDurationDeviationSeconds &&
        deviationSeconds / plannedDuration > VOICE_CONFIG.maxDurationDeviationRatio;

      if (isExcessive) {
        const warnMsg = `Narration duration deviation (${deviationSeconds}s) exceeds acceptable threshold`;
        console.warn(`[ContentOS] [Voice Agent] WARNING: ${warnMsg}`);
        await updateProductionAudioRequirementStatus(client, requirement.id, {
          status: 'failed',
          notes: warnMsg,
        });
        throw new Error(`Voice generation rejected: ${warnMsg}`);
      }
    }

    // 7. Upload to Supabase Storage (Private content-assets bucket)
    const assetId = crypto.randomUUID();
    const storagePath = buildNarrationStoragePath(projectId, assetId, generated.fileExtension);

    console.log(
      `[ContentOS] [Voice Agent] Uploading ${generated.audioBuffer.byteLength} bytes to bucket '${CONTENT_ASSETS_BUCKET}' at '${storagePath}'`
    );

    try {
      await storage.upload(
        CONTENT_ASSETS_BUCKET,
        storagePath,
        generated.audioBuffer,
        generated.mimeType
      );
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : 'Storage upload failed';
      console.error('[ContentOS] [Voice Agent] Storage upload failed:', msg);
      await updateProductionAudioRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Storage upload failed: ${msg}`,
      });
      throw storageErr;
    }

    // 8. Persist Record to public.content_assets
    console.log('[ContentOS] [Voice Agent] Persisting row to content_assets table');
    let assetRow: ContentAssetRow;
    try {
      assetRow = await recordContentAsset(client, {
        project_id: projectId,
        user_id: userId,
        asset_type: 'audio',
        storage_path: storagePath,
        mime_type: generated.mimeType,
        file_size: generated.audioBuffer.byteLength,
        metadata: {
          asset_id: assetId,
          requirement_id: requirement.id,
          production_package_id: requirement.production_package_id,
          scene_id: requirement.scene_id,
          provider: generated.provider,
          model: generated.model,
          voice: VOICE_CONFIG.defaultVoice,
          speaking_style: requirement.voice_requirement || VOICE_CONFIG.defaultSpeakingStyle,
          planned_duration_seconds: plannedDuration,
          actual_duration_seconds: actualDuration,
          duration_deviation_seconds: deviationSeconds,
          sample_rate: generated.sampleRate,
          channels: generated.channels,
          text: narrationText,
        },
      });
    } catch (assetErr) {
      const msg = assetErr instanceof Error ? assetErr.message : 'Failed to record asset';
      console.error('[ContentOS] [Voice Agent] Asset recording failed:', msg);
      await updateProductionAudioRequirementStatus(client, requirement.id, {
        status: 'failed',
        notes: `Asset persistence failed: ${msg}`,
      });
      throw assetErr;
    }

    // 9. Update production_audio_requirements row
    console.log(`[ContentOS] [Voice Agent] Linking asset ${assetRow.id} to requirement ${requirement.id}`);
    const updatedRequirement = await updateProductionAudioRequirementStatus(client, requirement.id, {
      status: 'completed',
      contentAssetId: assetRow.id,
      storagePath,
      notes: `Generated with ${generated.provider} (${generated.model})`,
    });

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
          agent_name: 'Voice Generation Agent',
          status: 'completed',
          model: generated.model,
          input: {
            requirement_id: requirement.id,
            text_length: narrationText.length,
            planned_duration: plannedDuration,
            voice: VOICE_CONFIG.defaultVoice,
          },
          output: {
            asset_id: assetRow.id,
            storage_path: storagePath,
            actual_duration: actualDuration,
            deviation_seconds: deviationSeconds,
            bytes: generated.audioBuffer.byteLength,
            mime_type: generated.mimeType,
          },
          started_at: now,
          completed_at: now,
        })
        .select('id')
        .single();
      agentRunId = runRow?.id;
    } catch (runErr) {
      console.warn('[ContentOS] [Voice Agent] Notice recording agent_runs:', runErr);
    }

    // Update job_stages for voice_generation (falling back to audio_generation if constraint requires)
    try {
      let stageName = 'voice_generation';
      const { data: existingVoiceStage } = await client
        .from('job_stages')
        .select('id')
        .eq('job_id', jobId)
        .in('stage', ['voice_generation', 'audio_generation'])
        .maybeSingle();

      if (existingVoiceStage?.id) {
        jobStageId = existingVoiceStage.id;
        await client
          .from('job_stages')
          .update({
            status: 'completed',
            completed_at: now,
            output: {
              voice_requirement_id: requirement.id,
              asset_id: assetRow.id,
              storage_path: storagePath,
            },
          })
          .eq('id', existingVoiceStage.id);
      } else {
        // Try inserting as voice_generation first
        const { data: newStage, error: insertStageErr } = await client
          .from('job_stages')
          .insert({
            job_id: jobId,
            stage: stageName,
            status: 'completed',
            started_at: now,
            completed_at: now,
            output: {
              voice_requirement_id: requirement.id,
              asset_id: assetRow.id,
              storage_path: storagePath,
            },
          })
          .select('id')
          .single();

        if (insertStageErr && insertStageErr.message.includes('job_stages_stage_check')) {
          // Fall back to 'audio_generation' which is in the base check constraint
          stageName = 'audio_generation';
          const { data: fallbackStage } = await client
            .from('job_stages')
            .insert({
              job_id: jobId,
              stage: stageName,
              status: 'completed',
              started_at: now,
              completed_at: now,
              output: {
                voice_requirement_id: requirement.id,
                asset_id: assetRow.id,
                storage_path: storagePath,
              },
            })
            .select('id')
            .single();
          jobStageId = fallbackStage?.id;
        } else {
          jobStageId = newStage?.id;
        }
      }
    } catch (stageErr) {
      console.warn('[ContentOS] [Voice Agent] Notice updating job_stages:', stageErr);
    }

    // Update parent job current_stage and timestamp at media-generation frontier
    try {
      await client
        .from('jobs')
        .update({
          current_stage: 'audio_generation',
          updated_at: now,
        })
        .eq('id', jobId);
    } catch (jobErr) {
      console.warn('[ContentOS] [Voice Agent] Notice updating jobs:', jobErr);
    }

    console.log(
      `[ContentOS] [Voice Agent] Completed voice generation successfully for asset ${assetRow.id}`
    );

    return {
      success: true,
      isReused: false,
      asset: assetRow,
      requirementId: requirement.id,
      audioRequirement: updatedRequirement,
      audioMetadata: {
        mimeType: generated.mimeType,
        fileExtension: generated.fileExtension,
        durationSeconds: actualDuration,
        plannedDurationSeconds: plannedDuration,
        durationDeviationSeconds: deviationSeconds,
        fileSizeBytes: generated.audioBuffer.byteLength,
        provider: generated.provider,
        model: generated.model,
      },
      storagePath,
      agentRunId,
      jobStageId,
    };
  }
}
