/**
 * ContentOS - Production / Media Planning Agent Execution Endpoint
 * POST /api/content/:projectId/production
 * 
 * Generates an end-to-end production specification (scenes, visual requirements,
 * audio requirements, burned-in captions, asset checklist) from an approved script.
 * All media requirements are marked pending; no media generation occurs in this step.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured } from '@/lib/ai/config';
import { ProductionAgent } from '@/lib/services/production-agent';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
  persistProductionExecution,
} from '@/lib/database';
import { ContentBrief, ResearchPackage, PlatformType, ScriptFormat } from '@/types';
import { ScriptPackage, Script, PlatformScriptVariant } from '@/types/script';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  console.log(`[ContentOS] [Production API] Production planning request received for project: ${projectId}`);

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
      platform?: PlatformType;
      format?: ScriptFormat;
      scriptId?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const requestedPlatform: PlatformType = body.platform || 'instagram';

    // 3. Verify AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] [Production API] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable the Production Agent.',
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
          '[ContentOS] [Production API] Notice reading admin users:',
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
      console.warn('[ContentOS] [Production API] Project not found in database:', projectId);
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
          error: 'No Research Package found for this project. Please run the Research Agent first before production planning.',
        },
        { status: 404 }
      );
    }

    // 9. Retrieve persisted Script or ScriptPackage
    let scriptPackage: ScriptPackage | null = null;
    let targetScript: (Script | PlatformScriptVariant) | null = null;
    let resolvedScriptId: string | undefined = body.scriptId;

    // Check job_stages for script_generation output
    const { data: scriptStage } = await dbClient
      .from('job_stages')
      .select('output')
      .eq('job_id', jobId)
      .eq('stage', 'script_generation')
      .maybeSingle();

    if (scriptStage?.output) {
      scriptPackage = scriptStage.output as ScriptPackage;
      // Select the variant matching the requested platform, or default to instagram variant or master script
      const variant = scriptPackage.platform_variants?.find((pv) => pv.platform === requestedPlatform);
      targetScript = variant || scriptPackage.platform_variants?.[0] || scriptPackage.master_script;
    }

    // If not found in job_stages output, query normalized scripts table
    if (!targetScript) {
      let scriptQuery = dbClient
        .from('scripts')
        .select('*')
        .eq('project_id', projectId);

      if (resolvedScriptId) {
        scriptQuery = scriptQuery.eq('id', resolvedScriptId);
      } else {
        scriptQuery = scriptQuery
          .eq('platform', requestedPlatform)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      let { data: scriptRow } = await scriptQuery.maybeSingle();

      // If specific platform variant not found, fall back to master script
      if (!scriptRow && !resolvedScriptId) {
        const { data: masterRow } = await dbClient
          .from('scripts')
          .select('*')
          .eq('project_id', projectId)
          .eq('platform', 'master')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        scriptRow = masterRow;
      }

      if (scriptRow) {
        resolvedScriptId = scriptRow.id;
        const { data: sectionRows } = await dbClient
          .from('script_sections')
          .select('*')
          .eq('script_id', scriptRow.id)
          .order('section_order', { ascending: true });

        targetScript = {
          id: scriptRow.id,
          project_id: scriptRow.project_id,
          job_id: scriptRow.job_id,
          title: scriptRow.title,
          format: scriptRow.format,
          platform: scriptRow.platform,
          target_duration_seconds: scriptRow.target_duration_seconds,
          estimated_duration_seconds: scriptRow.estimated_duration_seconds,
          word_count: scriptRow.word_count,
          language: scriptRow.language,
          tone: scriptRow.tone,
          hook: scriptRow.hook,
          cta: scriptRow.cta,
          version: scriptRow.version,
          is_mock_data: scriptRow.is_mock_data,
          sections: (sectionRows || []).map((sec) => ({
            order: sec.section_order,
            type: sec.section_type,
            start_second: Number(sec.start_second),
            end_second: Number(sec.end_second),
            spoken_text: sec.spoken_text,
            visual_direction: sec.visual_direction,
            b_roll_suggestions: sec.b_roll_suggestions || [],
            on_screen_text: sec.on_screen_text,
            source_references: [],
          })),
          source_references: [],
          unresolved_claims: [],
          generated_at: scriptRow.created_at,
        };
      }
    }

    if (!targetScript) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Script found for this project. Please run the Script Agent first before planning production.',
        },
        { status: 404 }
      );
    }

    // 10. Execute Production / Media Planning Agent
    console.log(
      `[ContentOS] [Production API] Executing ProductionAgent for ${requestedPlatform} on project ${projectId}`
    );
    const agent = new ProductionAgent();
    let agentResult;

    try {
      agentResult = await agent.execute({
        brief,
        researchPackage,
        script: targetScript,
        scriptPackage: scriptPackage || undefined,
        platform: requestedPlatform,
        format: body.format || targetScript.format,
        projectId,
        jobId,
        scriptId: resolvedScriptId,
      });
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : 'Production Agent execution failed';
      console.error('[ContentOS] [Production API] Production Agent error:', errMsg);
      return NextResponse.json(
        { success: false, error: `Production Agent failed: ${errMsg}` },
        { status: 502 }
      );
    }

    const { package: productionPackage, rawJson, config } = agentResult;

    // 11. Persist Production Package to Supabase
    console.log('[ContentOS] [Production API] Persisting production package to Supabase');
    const persistResult = await persistProductionExecution({
      client: dbClient,
      projectId,
      jobId,
      userId,
      scriptId: resolvedScriptId,
      productionPackage,
      rawJson,
    });

    console.log('[ContentOS] [Production API] Production planning completed successfully');

    // 12. Return structured response
    return NextResponse.json({
      success: true,
      projectId,
      jobId,
      productionPackageId: persistResult.productionPackageId,
      productionPackage,
      config,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[ContentOS] [Production API] Unexpected error in /api/content/[projectId]/production:', errorMsg);
    return NextResponse.json(
      { success: false, error: `Internal error in production endpoint: ${errorMsg}` },
      { status: 500 }
    );
  }
}
