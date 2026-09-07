/**
 * ContentOS - Job and Task Orchestration Types
 */

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled';

export type JobStage =
  | 'ideation'
  | 'research'
  | 'script_generation'
  | 'production_planning'
  | 'asset_generation'
  | 'voice_generation'
  | 'audio_generation'
  | 'visual_generation'
  | 'video_rendering'
  | 'user_review'
  | 'publishing';

export interface JobStageResult {
  stage: JobStage;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface JobRecord {
  id: string;
  contentId: string;
  currentStage: JobStage;
  status: JobStatus;
  stages: Record<JobStage, JobStageResult>;
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  contentId: string;
  stages: JobStage[];
  payload?: Record<string, unknown>;
}
