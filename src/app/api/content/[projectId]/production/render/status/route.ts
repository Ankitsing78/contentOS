/**
 * ContentOS - Video Composition Readiness & Status Endpoint
 * GET /api/content/:projectId/production/render/status
 *
 * Checks if all real visual assets and audio narration required for video composition
 * are present, returning granular status and preventing premature rendering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VideoRenderingAgent } from '@/lib/services/video-rendering-agent';
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
    if (!dbClient && isAdminConfigured()) {
      dbClient = getAdminClient();
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    // 1. Evaluate readiness
    const agent = new VideoRenderingAgent();
    const { readiness, packageId } = await agent.checkReadiness(dbClient, projectId);

    // 2. Check if an existing rendered video asset is already in database
    const { data: existingVideo } = await dbClient
      .from('content_assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('asset_type', 'video')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      packageId,
      canRender: readiness.canRender,
      readiness,
      existingVideo: existingVideo || null,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to evaluate render status';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
