/**
 * ContentOS - Voice Generation Agent Execution Endpoint
 * POST /api/content/:projectId/production/voice
 * 
 * Synthesizes real speech narration for an approved production audio requirement
 * using Gemini TTS, uploads to private storage, records in content_assets,
 * and updates production_audio_requirements status to completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { VoiceAgent } from '@/lib/services/voice-agent';
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

  console.log(`[ContentOS] [Voice API] Narration generation request received for project: ${projectId}`);

  try {
    // 1. Validate projectId
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    // 2. Parse request body if provided
    let body: {
      requirementId?: string;
      productionPackageId?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // 3. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] [Voice API] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable Voice Generation.',
        },
        { status: 503 }
      );
    }

    // 4. Resolve Database Client & User identity
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
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (usersData?.users?.[0]?.id) {
          userId = usersData.users[0].id;
        }
      } catch (listErr) {
        console.warn(
          '[ContentOS] [Voice API] Notice reading admin users:',
          listErr instanceof Error ? listErr.message : 'Unknown'
        );
      }
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    // 5. Retrieve project record
    const { data: project, error: projectError } = await dbClient
      .from('content_projects')
      .select('id, user_id, title')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.warn('[ContentOS] [Voice API] Project not found in database:', projectId);
      return NextResponse.json(
        { success: false, error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    if (project.user_id) {
      userId = project.user_id;
    }

    // 6. Locate active job
    const { data: job } = await dbClient
      .from('jobs')
      .select('id, project_id, status, current_stage')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const jobId = job?.id || `job-${projectId}`;

    // 7. Execute Voice Agent
    const agent = new VoiceAgent();
    const result = await agent.execute({
      client: dbClient,
      projectId,
      userId,
      jobId,
      requirementId: body.requirementId,
      productionPackageId: body.productionPackageId,
    });

    console.log(
      `[ContentOS] [Voice API] Voice generation completed successfully. Asset: ${result.asset.id}`
    );

    return NextResponse.json({
      success: true,
      projectId,
      jobId,
      requirementId: result.requirementId,
      isReused: result.isReused,
      assetId: result.asset.id,
      storagePath: result.storagePath,
      audioMetadata: result.audioMetadata,
      audioRequirement: result.audioRequirement,
      agentRunId: result.agentRunId,
      jobStageId: result.jobStageId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[ContentOS] [Voice API] Unexpected error in /api/content/[projectId]/production/voice:', errorMsg);
    return NextResponse.json(
      { success: false, error: `Internal error in voice generation endpoint: ${errorMsg}` },
      { status: 500 }
    );
  }
}
