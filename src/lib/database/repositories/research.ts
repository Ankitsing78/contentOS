/**
 * ContentOS - Research Persistence Repository
 * Manages database persistence for Research Plans, Sources, Evidence, and Pipeline Stages.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ResearchPackage } from '@/types';

export interface PersistResearchInput {
  client: SupabaseClient;
  projectId: string;
  jobId: string;
  userId: string;
  pkg: ResearchPackage;
  skipped: boolean;
  model?: string;
  rawJson?: string;
}

export interface PersistResearchResult {
  planId?: string;
  stageId?: string;
  agentRunId?: string;
}

export async function persistResearchExecution(
  input: PersistResearchInput
): Promise<PersistResearchResult> {
  const { client, projectId, jobId, userId, pkg, skipped, model = 'gemini-3.6-flash', rawJson } = input;
  const completedTime = new Date().toISOString();
  let planId: string | undefined;
  let stageId: string | undefined;
  let agentRunId: string | undefined;

  // 1. Persist to normalized research tables (if migration is applied)
  try {
    const { data: planRow, error: planError } = await client
      .from('research_plans')
      .insert({
        project_id: projectId,
        job_id: jobId,
        user_id: userId,
        research_questions: pkg.plan.research_questions,
        claims_to_verify: pkg.plan.claims_to_verify,
        facts_needed: pkg.plan.facts_needed,
        source_requirements: pkg.plan.source_requirements,
        freshness_requirements: pkg.plan.freshness_requirements,
        research_priority: pkg.plan.research_priority,
      })
      .select('id')
      .single();

    if (planRow?.id) {
      planId = planRow.id;
      console.log('[ContentOS] research plan recorded in database:', planId);

      // Persist sources if any
      if (pkg.sources.length > 0) {
        const sourceInserts = pkg.sources.map((s) => ({
          project_id: projectId,
          user_id: userId,
          title: s.title,
          url: s.url,
          publisher: s.publisher,
          published_at: s.published_at || null,
          retrieved_at: s.retrieved_at,
          source_type: s.source_type,
          relevance: s.relevance,
          credibility: s.credibility,
          evidence_summary: s.evidence_summary,
        }));

        const { data: insertedSources } = await client
          .from('research_sources')
          .insert(sourceInserts)
          .select('id, title');

        // Persist evidence if any
        if (pkg.evidence.length > 0) {
          const evidenceInserts = pkg.evidence.map((e) => {
            const matchedSource = insertedSources?.find((s) => s.title === e.source);
            return {
              project_id: projectId,
              user_id: userId,
              source_id: matchedSource?.id || null,
              claim: e.claim,
              source: e.source,
              supporting_excerpt: e.supporting_excerpt,
              confidence: e.confidence,
              notes: e.notes || null,
            };
          });

          await client.from('research_evidence').insert(evidenceInserts);
        }
      }
    } else if (planError) {
      console.warn('[ContentOS] Notice inserting research_plans:', planError.message);
    }
  } catch (err) {
    console.warn(
      '[ContentOS] Normalized research table insertion notice:',
      err instanceof Error ? err.message : 'Notice'
    );
  }

  // 2. Track in pipeline: job_stages
  try {
    // Check if research stage row already exists for this job
    const { data: existingStage } = await client
      .from('job_stages')
      .select('id')
      .eq('job_id', jobId)
      .eq('stage', 'research')
      .maybeSingle();

    if (existingStage?.id) {
      stageId = existingStage.id;
      await client
        .from('job_stages')
        .update({
          status: skipped ? 'skipped' : 'completed',
          output: pkg as unknown as Record<string, unknown>,
          completed_at: completedTime,
        })
        .eq('id', stageId);
    } else {
      const { data: newStage } = await client
        .from('job_stages')
        .insert({
          job_id: jobId,
          stage: 'research',
          status: skipped ? 'skipped' : 'completed',
          attempt: 1,
          input: { plan: pkg.plan },
          output: pkg as unknown as Record<string, unknown>,
          started_at: completedTime,
          completed_at: completedTime,
        })
        .select('id')
        .single();

      if (newStage?.id) stageId = newStage.id;
    }
  } catch (stageErr) {
    console.warn(
      '[ContentOS] Error tracking research job stage:',
      stageErr instanceof Error ? stageErr.message : 'Stage error'
    );
  }

  // 3. Track in agent_runs
  try {
    const { data: agentRow } = await client
      .from('agent_runs')
      .insert({
        job_id: jobId,
        project_id: projectId,
        agent_name: 'Research Agent',
        status: 'completed',
        model,
        input: { plan: pkg.plan },
        output: rawJson ? JSON.parse(rawJson) : pkg,
        started_at: completedTime,
        completed_at: completedTime,
      })
      .select('id')
      .single();

    if (agentRow?.id) agentRunId = agentRow.id;
  } catch (agentErr) {
    console.warn(
      '[ContentOS] Error recording Research Agent run:',
      agentErr instanceof Error ? agentErr.message : 'Agent run error'
    );
  }

  // 4. Advance job status and project status
  try {
    await client
      .from('jobs')
      .update({
        current_stage: 'script_generation',
        status: 'completed',
        completed_at: completedTime,
      })
      .eq('id', jobId);

    await client
      .from('content_projects')
      .update({
        status: 'researching',
        updated_at: completedTime,
      })
      .eq('id', projectId);
  } catch (jobErr) {
    console.warn(
      '[ContentOS] Error advancing job stage after research:',
      jobErr instanceof Error ? jobErr.message : 'Job update error'
    );
  }

  return { planId, stageId, agentRunId };
}
