/**
 * ContentOS - Supabase Database Types & Table Entities
 */

import { PlatformType, ContentStatus } from './content';
import { JobStatus, JobStage } from './job';

export type AssetType = 'audio' | 'image' | 'video' | 'thumbnail' | 'subtitle' | 'document';

export type JobStageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type PostPublishStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

// -----------------------------------------------------------------------------
// Table Row Definitions
// -----------------------------------------------------------------------------

export interface ContentProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  original_input: string;
  input_type: 'text' | 'audio' | 'file';
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface ContentIdeaRow {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  summary: string | null;
  topic: string | null;
  audience: string | null;
  angle: string | null;
  hook: string | null;
  source_input: string;
  created_at: string;
  updated_at: string;
}

export interface ContentScriptRow {
  id: string;
  project_id: string;
  platform: PlatformType;
  version: number;
  content: string; // script text or structured JSON
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContentAssetRow {
  id: string;
  project_id: string;
  user_id: string;
  asset_type: AssetType;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JobRow {
  id: string;
  project_id: string;
  user_id: string;
  status: JobStatus;
  current_stage: JobStage;
  attempt_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobStageRow {
  id: string;
  job_id: string;
  stage: JobStage;
  status: JobStageStatus;
  attempt: number;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentRunRow {
  id: string;
  job_id: string;
  project_id: string;
  agent_name: string;
  status: AgentRunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  model: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface PlatformAccountRow {
  id: string;
  user_id: string;
  platform: PlatformType;
  account_name: string;
  external_account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlatformPostRow {
  id: string;
  project_id: string;
  user_id: string;
  platform: PlatformType;
  platform_account_id: string | null;
  external_post_id: string | null;
  status: PostPublishStatus;
  title: string;
  caption: string | null;
  published_url: string | null;
  published_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSnapshotRow {
  id: string;
  platform_post_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number | null;
  snapshot_at: string;
  metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Database Helper Input Types (Inserts / Updates)
// -----------------------------------------------------------------------------

export type ContentProjectInsert = Omit<ContentProjectRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ContentProjectUpdate = Partial<Omit<ContentProjectRow, 'id' | 'user_id' | 'created_at'>>;

export type ContentIdeaInsert = Omit<ContentIdeaRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ContentScriptInsert = Omit<ContentScriptRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ContentAssetInsert = Omit<ContentAssetRow, 'id' | 'created_at'> & {
  id?: string;
};

export type JobInsert = Omit<JobRow, 'id' | 'created_at' | 'updated_at' | 'started_at' | 'completed_at'> & {
  id?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type JobStageInsert = Omit<JobStageRow, 'id' | 'created_at' | 'started_at' | 'completed_at'> & {
  id?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type AgentRunInsert = Omit<AgentRunRow, 'id' | 'completed_at'> & {
  id?: string;
  completed_at?: string | null;
};
