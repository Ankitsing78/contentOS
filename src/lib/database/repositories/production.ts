/**
 * ContentOS - Production Persistence Repository
 * 
 * Manages database persistence for Production Packages, Production Scenes,
 * Visual Requirements, Audio Requirements, Captions, Pipeline Stages, and Agent Runs.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProductionPackage } from '@/types/production';

export interface PersistProductionInput {
  client: SupabaseClient;
  projectId: string;
  jobId: string;
  userId: string;
  scriptId?: string;
  productionPackage: ProductionPackage;
  model?: string;
  rawJson?: string;
}

export interface PersistProductionResult {
  productionPackageId?: string;
  stageId?: string;
  agentRunId?: string;
}

export async function persistProductionExecution(
  input: PersistProductionInput
): Promise<PersistProductionResult> {
  const {
    client,
    projectId,
    jobId,
    userId,
    scriptId,
    productionPackage,
    model = 'gemini-3.6-flash',
    rawJson,
  } = input;
  const completedTime = new Date().toISOString();

  let productionPackageId: string | undefined;
  let stageId: string | undefined;
  let agentRunId: string | undefined;

  // 1. Persist to normalized production tables
  try {
    const { data: pkgRow, error: pkgErr } = await client
      .from('production_packages')
      .insert({
        project_id: projectId,
        job_id: jobId,
        script_id: scriptId || null,
        user_id: userId,
        platform: productionPackage.platform,
        format: productionPackage.format,
        aspect_ratio: productionPackage.aspect_ratio,
        duration_seconds: productionPackage.duration_seconds,
        confidence: productionPackage.confidence,
        is_mock_data: productionPackage.is_mock_data,
        transitions: productionPackage.transitions,
        overlays: productionPackage.overlays,
        asset_checklist: productionPackage.asset_checklist,
        production_notes: productionPackage.production_notes,
        unresolved_requirements: productionPackage.unresolved_requirements,
      })
      .select('id')
      .single();

    if (pkgRow?.id) {
      productionPackageId = pkgRow.id;
      console.log('[ContentOS] [Repository] Production package persisted:', productionPackageId);

      // Persist Scenes
      for (const scene of productionPackage.scenes) {
        const { data: sceneRow, error: sceneErr } = await client
          .from('production_scenes')
          .insert({
            production_package_id: productionPackageId,
            user_id: userId,
            scene_order: scene.order,
            start_second: scene.start_second,
            end_second: scene.end_second,
            duration_seconds: scene.duration_seconds,
            purpose: scene.purpose,
            spoken_text: scene.spoken_text,
            visual_type: scene.visual_type,
            visual_prompt: scene.visual_prompt,
            b_roll_requirement: scene.b_roll_requirement,
            camera_direction: scene.camera_direction,
            composition: scene.composition,
            on_screen_text: scene.on_screen_text || null,
            caption_text: scene.caption_text,
          })
          .select('id')
          .single();

        if (sceneRow?.id) {
          const dbSceneId = sceneRow.id;

          // Visual requirements for this scene
          if (scene.visual_assets && scene.visual_assets.length > 0) {
            const visInserts = scene.visual_assets.map((v) => ({
              production_package_id: productionPackageId,
              scene_id: dbSceneId,
              user_id: userId,
              asset_type: v.asset_type,
              description: v.description,
              prompt: v.prompt,
              aspect_ratio: v.aspect_ratio,
              resolution: v.resolution,
              duration_seconds: v.duration_seconds,
              source: v.source || 'ai_generated',
              generation_required: v.generation_required ?? true,
              status: v.status || 'pending',
              notes: v.notes || null,
            }));
            await client.from('production_visual_requirements').insert(visInserts);
          }

          // Audio requirements for this scene (narration, scene sfx)
          if (scene.audio_assets && scene.audio_assets.length > 0) {
            const audInserts = scene.audio_assets.map((a) => ({
              production_package_id: productionPackageId,
              scene_id: dbSceneId,
              user_id: userId,
              audio_type: a.audio_type,
              description: a.description,
              text: a.text || null,
              voice_requirement: a.voice_requirement || null,
              duration_seconds: a.duration_seconds,
              generation_required: a.generation_required ?? true,
              status: a.status || 'pending',
              notes: a.notes || null,
            }));
            await client.from('production_audio_requirements').insert(audInserts);
          }

          // Timed Caption blocks for this scene
          if (scene.captions && scene.captions.length > 0) {
            const capInserts = scene.captions.map((c) => ({
              production_package_id: productionPackageId,
              scene_id: dbSceneId,
              user_id: userId,
              start_second: c.start_second,
              end_second: c.end_second,
              caption_text: c.text,
              emphasis_words: c.emphasis_words || [],
            }));
            await client.from('production_captions').insert(capInserts);
          }
        } else if (sceneErr) {
          console.warn('[ContentOS] [Repository] Failed to insert scene:', sceneErr.message);
        }
      }

      // Persist global audio assets (e.g. background music)
      const globalAudio = (productionPackage.audio_assets || []).filter(
        (a) => a.audio_type === 'background_music' || !a.scene_id
      );
      if (globalAudio.length > 0) {
        const globalAudInserts = globalAudio.map((a) => ({
          production_package_id: productionPackageId,
          scene_id: null,
          user_id: userId,
          audio_type: a.audio_type,
          description: a.description,
          text: a.text || null,
          voice_requirement: a.voice_requirement || null,
          duration_seconds: a.duration_seconds,
          generation_required: a.generation_required ?? true,
          status: a.status || 'pending',
          notes: a.notes || null,
        }));
        await client.from('production_audio_requirements').insert(globalAudInserts);
      }
    } else if (pkgErr) {
      console.warn('[ContentOS] [Repository] Notice inserting production_packages:', pkgErr.message);
    }
  } catch (err: unknown) {
    console.warn(
      '[ContentOS] [Repository] Normalized production tables notice:',
      err instanceof Error ? err.message : 'Notice'
    );
  }

  // 2. Pipeline tracking: Update job_stages for 'production_planning'
  try {
    const { data: existingStage } = await client
      .from('job_stages')
      .select('id')
      .eq('job_id', jobId)
      .eq('stage', 'production_planning')
      .maybeSingle();

    if (existingStage?.id) {
      stageId = existingStage.id;
      await client
        .from('job_stages')
        .update({
          status: 'completed',
          output: productionPackage as unknown as Record<string, unknown>,
          completed_at: completedTime,
        })
        .eq('id', stageId);
    } else {
      const { data: newStage } = await client
        .from('job_stages')
        .insert({
          job_id: jobId,
          stage: 'production_planning',
          status: 'completed',
          attempt: 1,
          input: {
            platform: productionPackage.platform,
            aspect_ratio: productionPackage.aspect_ratio,
            scenes_count: productionPackage.scenes.length,
          },
          output: productionPackage as unknown as Record<string, unknown>,
          started_at: completedTime,
          completed_at: completedTime,
        })
        .select('id')
        .single();
      stageId = newStage?.id;
    }
    console.log('[ContentOS] [Repository] production_planning stage tracked:', stageId);
  } catch (stageErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Notice updating production_planning stage:',
      stageErr instanceof Error ? stageErr.message : 'Notice'
    );
  }

  // 3. Audit history: Record in agent_runs
  try {
    const { data: runRow } = await client
      .from('agent_runs')
      .insert({
        job_id: jobId,
        project_id: projectId,
        agent_name: 'Production Agent',
        status: 'completed',
        model,
        input: {
          platform: productionPackage.platform,
          aspect_ratio: productionPackage.aspect_ratio,
          scenes_count: productionPackage.scenes.length,
        },
        output: {
          production_package_id: productionPackageId,
          scenes_count: productionPackage.scenes.length,
          visual_assets_count: productionPackage.visual_assets.length,
          audio_assets_count: productionPackage.audio_assets.length,
          captions_count: productionPackage.captions.length,
          is_mock_data: productionPackage.is_mock_data,
          raw_payload_length: rawJson?.length,
        },
        started_at: completedTime,
        completed_at: completedTime,
      })
      .select('id')
      .single();
    agentRunId = runRow?.id;
    console.log('[ContentOS] [Repository] Production Agent run recorded:', agentRunId);
  } catch (runErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Notice recording Production Agent run:',
      runErr instanceof Error ? runErr.message : 'Notice'
    );
  }

  // 4. Update parent jobs status and current_stage
  try {
    await client
      .from('jobs')
      .update({
        current_stage: 'production_planning',
        status: 'completed',
        updated_at: completedTime,
      })
      .eq('id', jobId);
  } catch (jobUpdateErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Notice updating job current_stage:',
      jobUpdateErr instanceof Error ? jobUpdateErr.message : 'Notice'
    );
  }

  return {
    productionPackageId,
    stageId,
    agentRunId,
  };
}

export async function getProductionAudioRequirementById(
  client: SupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('production_audio_requirements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get production audio requirement: ${error.message}`);
  }

  return data;
}

export async function getFirstEligiblePendingVoiceRequirement(
  client: SupabaseClient,
  productionPackageId: string
) {
  const { data, error } = await client
    .from('production_audio_requirements')
    .select('*')
    .eq('production_package_id', productionPackageId)
    .eq('audio_type', 'voiceover')
    .eq('generation_required', true)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query eligible pending voice requirement: ${error.message}`);
  }

  return data;
}

export async function updateProductionAudioRequirementStatus(
  client: SupabaseClient,
  id: string,
  params: {
    status: 'completed' | 'failed' | 'in_progress' | 'pending';
    contentAssetId?: string | null;
    storagePath?: string | null;
    notes?: string | null;
  }
) {
  // First attempt with content_asset_id if present
  const updatePayload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.storagePath !== undefined) {
    updatePayload.storage_path = params.storagePath;
  }
  if (params.notes !== undefined) {
    updatePayload.notes = params.notes;
  }
  if (params.contentAssetId !== undefined) {
    updatePayload.content_asset_id = params.contentAssetId;
  }

  const { data, error } = await client
    .from('production_audio_requirements')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // If error is because content_asset_id column doesn't exist yet, retry without content_asset_id
    if (error.message.includes('content_asset_id') && params.contentAssetId) {
      console.warn('[ContentOS] [Repository] content_asset_id column not present, falling back to note tagging');
      delete updatePayload.content_asset_id;
      updatePayload.notes = `${updatePayload.notes || ''} [Asset ID: ${params.contentAssetId}]`.trim();
      const { data: fallbackData, error: fallbackError } = await client
        .from('production_audio_requirements')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (fallbackError) {
        throw new Error(`Failed to update production audio requirement (fallback): ${fallbackError.message}`);
      }
      return fallbackData;
    }
    throw new Error(`Failed to update production audio requirement: ${error.message}`);
  }

  return data;
}

export async function getLatestProductionPackageByProject(
  client: SupabaseClient,
  projectId: string
) {
  const { data, error } = await client
    .from('production_packages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get latest production package: ${error.message}`);
  }

  return data;
}

export async function getProductionVisualRequirementById(
  client: SupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('production_visual_requirements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get production visual requirement: ${error.message}`);
  }

  return data;
}

export async function getFirstEligiblePendingVisualRequirement(
  client: SupabaseClient,
  productionPackageId: string
) {
  const { data, error } = await client
    .from('production_visual_requirements')
    .select('*')
    .eq('production_package_id', productionPackageId)
    .eq('generation_required', true)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query eligible pending visual requirement: ${error.message}`);
  }

  return data;
}

export async function updateProductionVisualRequirementStatus(
  client: SupabaseClient,
  id: string,
  params: {
    status: 'completed' | 'failed' | 'in_progress' | 'pending';
    contentAssetId?: string | null;
    storagePath?: string | null;
    notes?: string | null;
    generationRequired?: boolean;
  }
) {
  const updatePayload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.status === 'completed') {
    updatePayload.generation_required = params.generationRequired !== undefined ? params.generationRequired : false;
  } else if (params.generationRequired !== undefined) {
    updatePayload.generation_required = params.generationRequired;
  }

  if (params.storagePath !== undefined) {
    updatePayload.storage_path = params.storagePath;
  }
  if (params.notes !== undefined) {
    updatePayload.notes = params.notes;
  }
  if (params.contentAssetId !== undefined) {
    updatePayload.content_asset_id = params.contentAssetId;
  }

  const { data, error } = await client
    .from('production_visual_requirements')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // If error is because content_asset_id column doesn't exist yet, retry without content_asset_id
    if (error.message.includes('content_asset_id') && params.contentAssetId) {
      console.warn('[ContentOS] [Repository] content_asset_id column not present on production_visual_requirements, falling back to note tagging');
      delete updatePayload.content_asset_id;
      updatePayload.notes = `${updatePayload.notes || ''} [Asset ID: ${params.contentAssetId}]`.trim();
      const { data: fallbackData, error: fallbackError } = await client
        .from('production_visual_requirements')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (fallbackError) {
        throw new Error(`Failed to update production visual requirement (fallback): ${fallbackError.message}`);
      }
      return fallbackData;
    }
    throw new Error(`Failed to update production visual requirement: ${error.message}`);
  }

  return data;
}
