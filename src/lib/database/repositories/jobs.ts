/**
 * ContentOS - Jobs & Workflow Repository
 * Manages multi-stage execution and allows retrying failed stages idempotently.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  JobRow,
  JobInsert,
  JobStageRow,
  JobStage,
  JobStageStatus,
} from '@/types';

export const PIPELINE_STAGES: JobStage[] = [
  'ideation',
  'research',
  'script_generation',
  'asset_generation',
  'user_review',
  'publishing',
];

export async function createJobWithStages(
  client: SupabaseClient,
  jobInput: JobInsert,
  stagesToRun: JobStage[] = PIPELINE_STAGES
): Promise<{ job: JobRow; stages: JobStageRow[] }> {
  // 1. Insert Job
  const { data: job, error: jobError } = await client
    .from('jobs')
    .insert(jobInput)
    .select()
    .single();

  if (jobError || !job) {
    throw new Error(`Failed to create job: ${jobError?.message || 'Unknown error'}`);
  }

  // 2. Insert Stages
  const stageInserts = stagesToRun.map((stage) => ({
    job_id: job.id,
    stage,
    status: (stage === stagesToRun[0] ? 'in_progress' : 'pending') as JobStageStatus,
    attempt: 1,
  }));

  const { data: stages, error: stagesError } = await client
    .from('job_stages')
    .insert(stageInserts)
    .select();

  if (stagesError || !stages) {
    throw new Error(`Failed to initialize job stages: ${stagesError?.message || 'Unknown error'}`);
  }

  return {
    job: job as JobRow,
    stages: stages as JobStageRow[],
  };
}

export async function getJobWithStages(
  client: SupabaseClient,
  jobId: string
): Promise<{ job: JobRow; stages: JobStageRow[] } | null> {
  const { data: job, error: jobError } = await client
    .from('jobs')
    .select()
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) {
    return null;
  }

  const { data: stages, error: stagesError } = await client
    .from('job_stages')
    .select()
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (stagesError) {
    throw new Error(`Failed to fetch job stages: ${stagesError.message}`);
  }

  return {
    job: job as JobRow,
    stages: (stages || []) as JobStageRow[],
  };
}

export async function updateJobStageResult(
  client: SupabaseClient,
  jobId: string,
  stage: JobStage,
  status: JobStageStatus,
  output?: Record<string, unknown>,
  errorMessage?: string
): Promise<JobStageRow> {
  const { data, error } = await client
    .from('job_stages')
    .update({
      status,
      output: output ?? null,
      error_message: errorMessage ?? null,
      completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    })
    .eq('job_id', jobId)
    .eq('stage', stage)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update stage ${stage}: ${error?.message || 'Unknown error'}`);
  }

  return data as JobStageRow;
}

export async function retryFailedStage(
  client: SupabaseClient,
  jobId: string,
  stage: JobStage
): Promise<JobStageRow> {
  // Fetch current stage record to increment attempt count
  const { data: currentStage, error: fetchErr } = await client
    .from('job_stages')
    .select()
    .eq('job_id', jobId)
    .eq('stage', stage)
    .single();

  if (fetchErr || !currentStage) {
    throw new Error(`Stage not found to retry: ${fetchErr?.message || 'Unknown error'}`);
  }

  const newAttempt = (currentStage.attempt || 1) + 1;

  const { data, error } = await client
    .from('job_stages')
    .update({
      status: 'in_progress',
      attempt: newAttempt,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    })
    .eq('job_id', jobId)
    .eq('stage', stage)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to retry stage: ${error?.message || 'Unknown error'}`);
  }

  // Also reset job status to running
  await client
    .from('jobs')
    .update({ status: 'running', current_stage: stage, error_message: null })
    .eq('id', jobId);

  return data as JobStageRow;
}
