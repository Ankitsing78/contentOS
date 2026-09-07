/**
 * ContentOS - Script Agent Execution Endpoint
 * POST /api/content/:projectId/script
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { ScriptAgent } from '@/lib/services/script-agent';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
  persistScriptExecution,
} from '@/lib/database';
import { ContentBrief, ResearchPackage, PlatformType, ScriptFormat } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  console.log(`[ContentOS] [Script API] script generation request received for project: ${projectId}`);

  try {
    // 1. Validate parameter
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    // 2. Parse request body if provided
    let body: {
      platforms?: PlatformType[];
      format?: ScriptFormat;
      duration_seconds?: number;
    } = {};

    try {
      body = await req.json();
    } catch {
      // Body is optional; default parameters will be used
      body = {};
    }

    // 3. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] [Script API] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable the Script Agent.',
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
          '[ContentOS] [Script API] Notice reading admin users:',
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
      .select('id, user_id, title, original_input, input_type, status')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.warn('[ContentOS] [Script API] Project not found in database:', projectId);
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

    // 7. Retrieve persisted ContentBrief
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
          platforms: ['instagram', 'youtube', 'x'],
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

    // 8. Retrieve persisted ResearchPackage
    let researchPackage: ResearchPackage | null = null;
    const { data: researchStage } = await dbClient
      .from('job_stages')
      .select('output')
      .eq('job_id', jobId)
      .eq('stage', 'research')
      .maybeSingle();

    if (researchStage?.output) {
      researchPackage = researchStage.output as ResearchPackage;
    } else {
      // Fallback: Check normalized research tables
      const { data: planRow } = await dbClient
        .from('research_plans')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planRow) {
        const { data: sourcesRows } = await dbClient
          .from('research_sources')
          .select('*')
          .eq('project_id', projectId);

        const { data: evidenceRows } = await dbClient
          .from('research_evidence')
          .select('*')
          .eq('project_id', projectId);

        researchPackage = {
          plan: {
            research_questions: planRow.research_questions || [],
            claims_to_verify: planRow.claims_to_verify || [],
            facts_needed: planRow.facts_needed || [],
            source_requirements: planRow.source_requirements || [],
            freshness_requirements: planRow.freshness_requirements || 'Recent',
            research_priority: planRow.research_priority || 'medium',
          },
          sources: (sourcesRows || []).map((s) => ({
            title: s.title,
            url: s.url,
            publisher: s.publisher,
            published_at: s.published_at,
            retrieved_at: s.retrieved_at,
            source_type: s.source_type,
            relevance: s.relevance,
            credibility: s.credibility,
            evidence_summary: s.evidence_summary,
          })),
          evidence: (evidenceRows || []).map((e) => ({
            claim: e.claim,
            source: e.source,
            supporting_excerpt: e.supporting_excerpt,
            confidence: e.confidence,
            notes: e.notes,
          })),
          unresolved_questions: [],
          overall_confidence: 'medium',
          isMockData: false,
        };
      }
    }

    if (!researchPackage) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Research Package found for this project. Please run the Research Agent first before generating a script.',
        },
        { status: 404 }
      );
    }

    // 9. Execute Script Agent
    console.log('[ContentOS] [Script API] executing Script Agent for project:', projectId);
    const agent = new ScriptAgent();
    let agentResult;

    try {
      agentResult = await agent.execute({
        brief,
        researchPackage,
        projectId,
        jobId,
        platforms: body.platforms,
        format: body.format,
        durationSeconds: body.duration_seconds,
      });
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : 'Script Agent execution failed';
      console.error('[ContentOS] [Script API] Script Agent execution error:', errMsg);
      return NextResponse.json(
        { success: false, error: `Script Agent failed: ${errMsg}` },
        { status: 502 }
      );
    }

    const { package: scriptPackage, plan: scriptPlan, rawJson } = agentResult;

    // 10. Persist script package to Supabase
    console.log('[ContentOS] [Script API] persisting script package to Supabase');
    const persistResult = await persistScriptExecution({
      client: dbClient,
      projectId,
      jobId,
      userId,
      scriptPackage,
      rawJson,
    });

    console.log('[ContentOS] [Script API] script stage completed successfully');

    // 11. Return structured response
    return NextResponse.json({
      success: true,
      projectId,
      jobId,
      masterScriptId: persistResult.masterScriptId,
      scriptPackage,
      scriptPlan,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[ContentOS] [Script API] Unexpected error in /api/content/[projectId]/script:', errorMsg);
    return NextResponse.json(
      { success: false, error: `Internal error in script endpoint: ${errorMsg}` },
      { status: 500 }
    );
  }
}
