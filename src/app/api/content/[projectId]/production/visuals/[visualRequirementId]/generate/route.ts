/**
 * ContentOS - Visual Generation Agent Execution Endpoint
 * POST /api/content/:projectId/production/visuals/:visualRequirementId/generate
 *
 * Synthesizes visual image assets for an approved production visual requirement
 * using Gemini image generation (gemini-3.1-flash-image), uploads to private storage,
 * records in content_assets, and updates production_visual_requirements status to completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { IMAGE_CONFIG } from '@/lib/media/image-config';
import { ImageAgent } from '@/lib/services/image-agent';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; visualRequirementId: string }> }
) {
  const { projectId, visualRequirementId } = await context.params;

  console.log(
    `[ContentOS] [Visual API] Generation request received for project: ${projectId}, requirement: ${visualRequirementId}`
  );

  try {
    // 1. Validate parameters
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    if (!visualRequirementId || visualRequirementId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid visualRequirementId parameter is required' },
        { status: 400 }
      );
    }

    // 2. Check if Automated Visual Generation is Paused
    if (IMAGE_CONFIG.isPaused) {
      console.log('[ContentOS] [Visual API] Automated visual generation is currently PAUSED / ON HOLD.');
      return NextResponse.json(
        {
          success: false,
          paused: true,
          error: 'Automated visual generation is temporarily PAUSED / ON HOLD. Production requirements remain pending.',
        },
        { status: 423 } // 423 Locked: Operation paused
      );
    }

    // 3. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] [Visual API] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable Visual Generation.',
        },
        { status: 503 }
      );
    }

    // 3. Resolve Database Client & User identity
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    let dbClient = createServerClient(token);
    let userId = '00000000-0000-0000-0000-000000000001';

    if (token && dbClient) {
      const { data: userData } = await dbClient.auth.getUser();
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    } else if (isAdminConfigured()) {
      const admin = getAdminClient();
      dbClient = admin;
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    // 4. Retrieve project record & verify ownership
    const { data: project, error: projectError } = await dbClient
      .from('content_projects')
      .select('id, user_id, title')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.warn('[ContentOS] [Visual API] Project not found in database:', projectId);
      return NextResponse.json(
        { success: false, error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    if (project.user_id) {
      userId = project.user_id;
    }

    // 5. Locate active job
    const { data: job } = await dbClient
      .from('jobs')
      .select('id, project_id, status, current_stage')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const jobId = job?.id || `job-${projectId}`;

    // 6. Execute Visual Generation Agent
    const agent = new ImageAgent();
    const result = await agent.execute({
      client: dbClient,
      projectId,
      userId,
      jobId,
      requirementId: visualRequirementId,
    });

    return NextResponse.json(
      {
        success: true,
        isReused: result.isReused,
        asset: {
          id: result.asset.id,
          project_id: result.asset.project_id,
          asset_type: result.asset.asset_type,
          storage_path: result.storagePath,
          mime_type: result.imageMetadata.mimeType,
          file_size: result.imageMetadata.fileSizeBytes,
          width: result.imageMetadata.width,
          height: result.imageMetadata.height,
          aspect_ratio: result.imageMetadata.aspectRatio,
          model: result.imageMetadata.model,
          provider: result.imageMetadata.provider,
          created_at: result.asset.created_at,
        },
        requirement: {
          id: result.requirementId,
          status: 'completed',
          storage_path: result.storagePath,
          content_asset_id: result.asset.id,
          generation_required: false,
        },
        agentRunId: result.agentRunId,
        jobStageId: result.jobStageId,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Visual generation failed';
    console.error('[ContentOS] [Visual API] Execution error:', errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
