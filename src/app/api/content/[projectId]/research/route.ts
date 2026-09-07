/**
 * ContentOS - Research Agent Execution Endpoint
 * POST /api/content/:projectId/research
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { ResearchAgent } from '@/lib/services/research-agent';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
  persistResearchExecution,
} from '@/lib/database';
import { ContentBrief } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  console.log(`[ContentOS] research request received for project: ${projectId}`);

  try {
    // 1. Validate parameter
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    // 2. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable the Research Agent.',
        },
        { status: 503 }
      );
    }

    // 2b. Verify Research Provider configuration if tavily is requested
    const requestedProvider = process.env.RESEARCH_PROVIDER || 'tavily';
    if (requestedProvider === 'tavily' && !process.env.TAVILY_API_KEY) {
      console.warn('[ContentOS] Research provider configured as "tavily" but TAVILY_API_KEY is missing');
      return NextResponse.json(
        {
          success: false,
          error:
            'Tavily Research Provider is selected, but TAVILY_API_KEY is missing in .env.local. ' +
            'Please add TAVILY_API_KEY or set RESEARCH_PROVIDER="mock" for development testing.',
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
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (usersData?.users?.[0]?.id) {
          userId = usersData.users[0].id;
        }
      } catch (listErr) {
        console.warn(
          '[ContentOS] Notice reading admin users for research:',
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

    // 4. Retrieve project and associated job & brief from Supabase
    const { data: project, error: projectError } = await dbClient
      .from('content_projects')
      .select('id, user_id, title, original_input, input_type, status')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.warn('[ContentOS] Project not found in database:', projectId);
      return NextResponse.json(
        { success: false, error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Use project user_id if valid UUID
    if (project.user_id) {
      userId = project.user_id;
    }

    // Find the latest active job for this project
    const { data: job } = await dbClient
      .from('jobs')
      .select('id, project_id, status, current_stage')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const jobId = job?.id || `job-${projectId}`;

    // Retrieve the latest ContentBrief from job_stages or agent_runs
    let brief: ContentBrief | null = null;

    const { data: ideationStage } = await dbClient
      .from('job_stages')
      .select('output')
      .eq('job_id', jobId)
      .eq('stage', 'ideation')
      .maybeSingle();

    if (ideationStage?.output) {
      brief = ideationStage.output as ContentBrief;
    } else {
      // Fallback: retrieve from content_ideas
      const { data: idea } = await dbClient
        .from('content_ideas')
        .select('title, summary, topic, audience, angle, hook')
        .eq('project_id', projectId)
        .maybeSingle();

      if (idea?.title) {
        brief = {
          title: idea.title,
          summary: idea.summary || '',
          topic: idea.topic || 'General',
          audience: idea.audience || 'General Audience',
          content_goal: 'Educate and engage',
          angle: idea.angle || '',
          hook: idea.hook || '',
          tone: 'Engaging',
          key_points: [idea.title],
          suggested_formats: ['Short-form Reel'],
          platforms: ['youtube', 'instagram', 'x'],
          needs_research: true,
        };
      }
    }

    if (!brief) {
      return NextResponse.json(
        { success: false, error: 'No Content Brief found for this project. Please run intake first.' },
        { status: 404 }
      );
    }

    // 5. Execute Research Agent
    console.log('[ContentOS] executing Research Agent for project:', projectId);
    const agent = new ResearchAgent();
    let agentResult;

    try {
      agentResult = await agent.execute({
        brief,
        projectId,
        jobId,
      });
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : 'Research Agent execution failed';
      console.error('[ContentOS] Research Agent execution error:', errMsg);
      return NextResponse.json(
        { success: false, error: `Research Agent failed: ${errMsg}` },
        { status: 502 }
      );
    }

    const { package: researchPackage, rawJson, skipped } = agentResult;

    // 6. Persist research execution to Supabase
    console.log('[ContentOS] persisting research execution to Supabase');
    await persistResearchExecution({
      client: dbClient,
      projectId,
      jobId,
      userId,
      pkg: researchPackage,
      skipped,
      rawJson,
    });

    console.log('[ContentOS] research stage completed successfully');

    // 7. Return structured ResearchPackage
    return NextResponse.json({
      success: true,
      projectId,
      jobId,
      researchPackage,
      skipped,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[ContentOS] Unexpected error in /api/content/[projectId]/research:', errorMsg);
    return NextResponse.json(
      { success: false, error: `Internal error in research endpoint: ${errorMsg}` },
      { status: 500 }
    );
  }
}
