/**
 * ContentOS - Project State & Packages Query Endpoint
 * GET /api/content/:projectId
 *
 * Retrieves the full persisted state for a content project:
 * - Project metadata
 * - Content Brief (ideation)
 * - Research Package (evidence & sources)
 * - Script Package (master script + platform variants)
 * - Production Package (scenes, visual requirements, audio, captions)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    let dbClient = createServerClient(token);
    if ((!token || !dbClient) && isAdminConfigured()) {
      dbClient = getAdminClient();
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    // 1. Fetch project record
    const { data: project, error: projectError } = await dbClient
      .from('content_projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // 2. Fetch latest active job
    const { data: job } = await dbClient
      .from('jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const jobId = job?.id || `job-${projectId}`;

    // 3. Fetch job stages outputs
    const { data: stages } = await dbClient
      .from('job_stages')
      .select('stage, status, output, completed_at')
      .eq('job_id', jobId);

    const ideationStage = stages?.find((s) => s.stage === 'ideation');
    const researchStage = stages?.find((s) => s.stage === 'research');
    const scriptStage = stages?.find((s) => s.stage === 'script_generation');
    const productionStage = stages?.find((s) => s.stage === 'production_planning');

    // 4. Fetch Scripts from scripts table
    const { data: scriptsList } = await dbClient
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    // 5. Fetch Production Package & scenes
    const { data: prodPkg } = await dbClient
      .from('production_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let fullProductionPackage = productionStage?.output || null;

    if (prodPkg) {
      const { data: scenes } = await dbClient
        .from('production_scenes')
        .select('*')
        .eq('production_package_id', prodPkg.id)
        .order('scene_order', { ascending: true });

      const { data: visualReqs } = await dbClient
        .from('production_visual_requirements')
        .select('*')
        .eq('production_package_id', prodPkg.id);

      const { data: audioReqs } = await dbClient
        .from('production_audio_requirements')
        .select('*')
        .eq('production_package_id', prodPkg.id);

      const { data: captions } = await dbClient
        .from('production_captions')
        .select('*')
        .eq('production_package_id', prodPkg.id);

      // Build structured package if output was not in job_stages
      if (!fullProductionPackage && scenes) {
        fullProductionPackage = {
          id: prodPkg.id,
          project_id: projectId,
          job_id: jobId,
          platform: prodPkg.platform,
          format: prodPkg.format,
          duration_seconds: prodPkg.duration_seconds,
          aspect_ratio: prodPkg.aspect_ratio,
          confidence: prodPkg.confidence,
          is_mock_data: prodPkg.is_mock_data,
          transitions: prodPkg.transitions || [],
          overlays: prodPkg.overlays || [],
          asset_checklist: prodPkg.asset_checklist || [],
          production_notes: prodPkg.production_notes || [],
          unresolved_requirements: prodPkg.unresolved_requirements || [],
          scenes: scenes.map((s) => ({
            id: s.id,
            order: s.scene_order,
            start_second: s.start_second,
            end_second: s.end_second,
            duration_seconds: s.duration_seconds,
            purpose: s.purpose,
            spoken_text: s.spoken_text,
            visual_type: s.visual_type,
            visual_prompt: s.visual_prompt,
            b_roll_requirement: s.b_roll_requirement,
            camera_direction: s.camera_direction,
            composition: s.composition,
            on_screen_text: s.on_screen_text,
            caption_text: s.caption_text,
            visual_assets: (visualReqs || []).filter((v) => v.scene_id === s.id),
            audio_assets: (audioReqs || []).filter((a) => a.scene_id === s.id),
            captions: (captions || [])
              .filter((c) => c.scene_id === s.id)
              .map((c) => ({
                id: c.id,
                start_second: c.start_second,
                end_second: c.end_second,
                text: c.caption_text,
                emphasis_words: c.emphasis_words || [],
              })),
          })),
          visual_assets: visualReqs || [],
          audio_assets: audioReqs || [],
          captions: (captions || []).map((c) => ({
            id: c.id,
            start_second: c.start_second,
            end_second: c.end_second,
            text: c.caption_text,
            emphasis_words: c.emphasis_words || [],
          })),
        };
      }
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        original_input: project.original_input,
        created_at: project.created_at,
      },
      jobId,
      brief: ideationStage?.output || null,
      researchPackage: researchStage?.output || null,
      scriptPackage: scriptStage?.output || null,
      scripts: scriptsList || [],
      productionPackage: fullProductionPackage,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve project data';
    console.error('[ContentOS] [Project API] Query error:', errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
