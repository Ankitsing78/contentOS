/**
 * ContentOS - Image Generation Agent Execution Endpoint
 * POST /api/content/:projectId/production/image
 * 
 * Synthesizes visual graphic and background assets for an approved production
 * visual requirement using Gemini image generation, uploads to private storage,
 * records in content_assets, and updates production_visual_requirements status to completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { ImageAgent } from '@/lib/services/image-agent';
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

  console.log(`[ContentOS] [Image API] Visual generation request received for project: ${projectId}`);

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
      visualRequirementId?: string;
      visual_requirement_id?: string;
      requirementId?: string;
      productionPackageId?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const targetRequirementId =
      body.visualRequirementId || body.visual_requirement_id || body.requirementId;

    // 3. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] [Image API] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable Image Generation.',
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
          '[ContentOS] [Image API] Notice reading admin users:',
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
      console.warn('[ContentOS] [Image API] Project not found in database:', projectId);
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

    // 7. Execute Image Agent
    const agent = new ImageAgent();
    const result = await agent.execute({
      client: dbClient,
      projectId,
      userId,
      jobId,
      requirementId: targetRequirementId,
      productionPackageId: body.productionPackageId,
    });

    console.log(
      `[ContentOS] [Image API] Visual generation completed successfully. Asset: ${result.asset.id}`
    );

    return NextResponse.json(
      {
        success: true,
        projectId,
        jobId,
        isReused: result.isReused,
        requirementId: result.requirementId,
        asset: {
          id: result.asset.id,
          assetType: result.asset.asset_type,
          storagePath: result.storagePath,
          mimeType: result.imageMetadata.mimeType,
          fileSize: result.imageMetadata.fileSizeBytes,
          width: result.imageMetadata.width,
          height: result.imageMetadata.height,
          aspectRatio: result.imageMetadata.aspectRatio,
          provider: result.imageMetadata.provider,
          model: result.imageMetadata.model,
        },
        visualRequirement: result.visualRequirement,
        agentRunId: result.agentRunId,
        jobStageId: result.jobStageId,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown image generation error';
    console.error('[ContentOS] [Image API] Visual generation route failed:', errorMsg);

    const status = errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') ? 429 : 500;
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status }
    );
  }
}
