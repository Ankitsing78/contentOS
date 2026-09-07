/**
 * ContentOS - Video Composition & Rendering Execution Endpoint
 * POST /api/content/:projectId/production/render
 *
 * Assembles all real visual assets, narration audio, and synchronized captions
 * from the approved production package and renders the final video.
 * Fails strictly if any required media assets are still pending.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VideoRenderingAgent } from '@/lib/services/video-rendering-agent';
import { MissingAssetsError } from '@/lib/media/composition-validator';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  console.log(`[ContentOS] [Render API] Video render request received for project: ${projectId}`);

  try {
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    // Resolve Database Client & User identity
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

    // Retrieve project record
    const { data: project, error: projectError } = await dbClient
      .from('content_projects')
      .select('id, user_id, title')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    if (project.user_id) {
      userId = project.user_id;
    }

    // Locate active job
    const { data: job } = await dbClient
      .from('jobs')
      .select('id')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const jobId = job?.id || `job-${projectId}`;

    // Execute Video Rendering Agent
    const agent = new VideoRenderingAgent();
    const result = await agent.execute({
      client: dbClient,
      projectId,
      userId,
      jobId,
    });

    return NextResponse.json(
      {
        success: true,
        isReused: result.isReused,
        asset: {
          id: result.asset.id,
          asset_type: result.asset.asset_type,
          storage_path: result.storagePath,
          mime_type: result.videoMetadata.mimeType,
          file_size: result.videoMetadata.fileSizeBytes,
          width: result.videoMetadata.width,
          height: result.videoMetadata.height,
          duration_seconds: result.videoMetadata.durationSeconds,
          fps: result.videoMetadata.fps,
          renderer: result.videoMetadata.renderer,
          created_at: result.asset.created_at,
        },
        readiness: result.readiness,
        agentRunId: result.agentRunId,
        jobStageId: result.jobStageId,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof MissingAssetsError) {
      console.warn(`[ContentOS] [Render API] Halted due to missing assets: ${error.message}`);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          canRender: false,
          readiness: error.readiness,
        },
        { status: 422 } // Unprocessable Entity: missing prerequisite media assets
      );
    }

    const errorMsg = error instanceof Error ? error.message : 'Video rendering failed';
    console.error('[ContentOS] [Render API] Execution error:', errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
