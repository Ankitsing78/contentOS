import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isGeminiConfigured } from '@/lib/ai/config';
import { ContentUnderstandingAgent } from '@/lib/services/content-understanding';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';
import { ContentStatus } from '@/types';

export const dynamic = 'force-dynamic';

const ContentIntakeInputSchema = z.object({
  input: z
    .string()
    .min(1, 'Input must not be empty')
    .max(4000, 'Input must not exceed 4,000 characters')
    .refine((val) => val.trim().length > 0, 'Input must contain non-whitespace text'),
  inputType: z.enum(['text', 'audio', 'file']).default('text'),
  userContext: z.string().max(1000).optional(),
});

// Fallback user ID for local development before Supabase Auth is completed in Step 5
const DEV_FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  console.log('[ContentOS] content request received');

  try {
    // 1. Validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const parseResult = ContentIntakeInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: issue }, { status: 400 });
    }

    const { input, inputType, userContext } = parseResult.data;

    // 2. Check AI Provider configuration
    if (!isGeminiConfigured()) {
      console.warn('[ContentOS] AI provider not configured: GEMINI_API_KEY missing');
      return NextResponse.json(
        {
          success: false,
          error:
            'AI provider is not configured. Please set GEMINI_API_KEY in .env.local to enable autonomous content understanding.',
        },
        { status: 503 }
      );
    }

    // 3. Resolve Database Client & User identity
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    let dbClient = createServerClient(token);
    let userId = DEV_FALLBACK_USER_ID;

    if (token && dbClient) {
      const { data: userData } = await dbClient.auth.getUser();
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    } else if (isAdminConfigured()) {
      // In development / server-orchestrated mode, use privileged client to bypass RLS
      const admin = getAdminClient();
      dbClient = admin;
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (usersData?.users?.[0]?.id) {
          userId = usersData.users[0].id;
        }
      } catch (listErr) {
        console.warn(
          '[ContentOS] Notice fetching admin users:',
          listErr instanceof Error ? listErr.message : 'Unknown'
        );
      }
    }

    // Real persistence is possible when either an authenticated user session is provided OR admin service-role is configured
    const canPersist = Boolean(token && dbClient) || isAdminConfigured();
    let projectId: string | null = null;
    let jobId: string | null = null;
    let stageId: string | null = null;
    let agentRunId: string | null = null;

    // 4. Record project and job in Supabase if database connection is available
    if (canPersist && dbClient) {
      // A. Insert content_projects
      const { data: projectRow, error: projectError } = await dbClient
        .from('content_projects')
        .insert({
          user_id: userId,
          title: input.length > 50 ? `${input.substring(0, 47)}...` : input,
          original_input: input,
          input_type: inputType,
          status: 'draft' as ContentStatus,
        })
        .select('id')
        .single();

      if (projectError || !projectRow?.id) {
        const errMsg = projectError?.message || 'Unknown database error on project insertion';
        console.error('[ContentOS] Supabase project insertion failed:', errMsg);
        throw new Error(`Failed to persist project to Supabase: ${errMsg}`);
      }

      projectId = projectRow.id;
      console.log('[ContentOS] project created in database:', projectId);

      // B. Insert initial content_ideas
      const { error: ideaError } = await dbClient.from('content_ideas').insert({
        project_id: projectId,
        user_id: userId,
        title: 'Initial Concept',
        source_input: input,
      });

      if (ideaError) {
        console.error('[ContentOS] Supabase idea insertion failed:', ideaError.message);
        throw new Error(`Failed to persist idea to Supabase: ${ideaError.message}`);
      }

      // C. Insert job record
      const { data: jobRow, error: jobError } = await dbClient
        .from('jobs')
        .insert({
          project_id: projectId,
          user_id: userId,
          status: 'running',
          current_stage: 'ideation',
          attempt_count: 1,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError || !jobRow?.id) {
        const errMsg = jobError?.message || 'Unknown database error on job insertion';
        console.error('[ContentOS] Supabase job insertion failed:', errMsg);
        throw new Error(`Failed to persist job to Supabase: ${errMsg}`);
      }

      jobId = jobRow.id;

      // D. Insert job_stages record
      const { data: stageRow, error: stageError } = await dbClient
        .from('job_stages')
        .insert({
          job_id: jobId,
          stage: 'ideation',
          status: 'in_progress',
          attempt: 1,
          input: { originalInput: input, inputType },
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (stageError || !stageRow?.id) {
        const errMsg = stageError?.message || 'Unknown database error on job stage insertion';
        console.error('[ContentOS] Supabase job stage insertion failed:', errMsg);
        throw new Error(`Failed to persist job stage to Supabase: ${errMsg}`);
      }

      stageId = stageRow.id;

      // E. Record agent_runs
      const { data: agentRow, error: agentError } = await dbClient
        .from('agent_runs')
        .insert({
          job_id: jobId,
          project_id: projectId,
          agent_name: 'Content Understanding Agent',
          status: 'running',
          model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
          input: { userInput: input, inputType },
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (agentError || !agentRow?.id) {
        const errMsg = agentError?.message || 'Unknown database error on agent run insertion';
        console.error('[ContentOS] Supabase agent run insertion failed:', errMsg);
        throw new Error(`Failed to persist agent run to Supabase: ${errMsg}`);
      }

      agentRunId = agentRow.id;
    } else {
      // If database is not configured with valid credentials, generate explicit development IDs
      projectId = `local-prj-${Date.now()}`;
      jobId = `local-job-${Date.now()}`;
    }

    // 5. Execute Content Understanding Agent
    console.log('[ContentOS] content understanding started');
    let agentResult;
    try {
      const agent = new ContentUnderstandingAgent();
      agentResult = await agent.execute({
        userInput: input,
        inputType,
        userContext,
      });
      console.log('[ContentOS] content understanding completed');
    } catch (aiError: unknown) {
      const errorMessage =
        aiError instanceof Error ? aiError.message : 'AI Content Understanding failed';
      console.error('[ContentOS] AI processing error:', errorMessage);

      // Record failure state in Supabase if records were created
      if (canPersist && dbClient) {
        try {
          if (agentRunId) {
            await dbClient.from('agent_runs').update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            }).eq('id', agentRunId);
          }
          if (stageId) {
            await dbClient.from('job_stages').update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            }).eq('id', stageId);
          }
          if (jobId) {
            await dbClient.from('jobs').update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            }).eq('id', jobId);
          }
        } catch {
          // Swallow failure logging errors to ensure response returns
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: `AI analysis failed: ${errorMessage}`,
        },
        { status: 502 }
      );
    }

    const { brief, rawJson } = agentResult;

    // 6. Persist successful results in Supabase
    if (canPersist && dbClient) {
      try {
        const completedTime = new Date().toISOString();

        // Update content_projects title & status
        await dbClient.from('content_projects').update({
          title: brief.title,
          description: brief.summary,
          status: 'researching' as ContentStatus,
        }).eq('id', projectId);

        // Update content_ideas with enriched fields
        await dbClient.from('content_ideas').update({
          title: brief.title,
          summary: brief.summary,
          topic: brief.topic,
          audience: brief.audience,
          angle: brief.angle,
          hook: brief.hook,
        }).eq('project_id', projectId);

        // Mark agent_runs as completed
        if (agentRunId) {
          await dbClient.from('agent_runs').update({
            status: 'completed',
            output: JSON.parse(rawJson),
            completed_at: completedTime,
          }).eq('id', agentRunId);
        }

        // Mark job_stages as completed
        if (stageId) {
          await dbClient.from('job_stages').update({
            status: 'completed',
            output: brief as unknown as Record<string, unknown>,
            completed_at: completedTime,
          }).eq('id', stageId);
        }

        // Advance job stage
        if (jobId) {
          await dbClient.from('jobs').update({
            status: 'completed',
            current_stage: brief.needs_research ? 'research' : 'script_generation',
            completed_at: completedTime,
          }).eq('id', jobId);
        }

        console.log('[ContentOS] job completed');
      } catch (persistErr: unknown) {
        console.warn(
          '[ContentOS] Result persistence notice:',
          persistErr instanceof Error ? persistErr.message : 'Persistence error'
        );
      }
    }

    // 7. Return structured plan to client
    return NextResponse.json({
      success: true,
      projectId,
      jobId,
      brief,
      originalInput: input,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error processing content request';
    console.error('[ContentOS] Error in /api/content:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
