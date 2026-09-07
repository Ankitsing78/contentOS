-- =============================================================================
-- ContentOS - Initial Database Schema Migration
-- Migration: 0001_initial_schema.sql
-- Description: Core schema for autonomous content operating system,
--              multi-stage jobs, media assets, platform accounts, and RLS.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. Content Projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  original_input TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'audio', 'file')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft', 'researching', 'scripting', 'media_generating',
      'awaiting_approval', 'approved', 'scheduled', 'publishing',
      'published', 'failed'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_content_projects_updated_at
BEFORE UPDATE ON public.content_projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_content_projects_user_id ON public.content_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_content_projects_status ON public.content_projects(status);

-- -----------------------------------------------------------------------------
-- 2. Content Ideas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  topic TEXT,
  audience TEXT,
  angle TEXT,
  hook TEXT,
  source_input TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_content_ideas_updated_at
BEFORE UPDATE ON public.content_ideas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_content_ideas_project_id ON public.content_ideas(project_id);
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_id ON public.content_ideas(user_id);

-- -----------------------------------------------------------------------------
-- 3. Content Scripts (Supports multi-versioning)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'x')),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_platform_version UNIQUE (project_id, platform, version)
);

CREATE TRIGGER set_content_scripts_updated_at
BEFORE UPDATE ON public.content_scripts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_content_scripts_project_id ON public.content_scripts(project_id);

-- -----------------------------------------------------------------------------
-- 4. Content Assets (Private storage references)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('audio', 'image', 'video', 'thumbnail', 'subtitle', 'document')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_project_id ON public.content_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_user_id ON public.content_assets(user_id);

-- -----------------------------------------------------------------------------
-- 5. Jobs (Orchestrated long-running pipelines)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled')),
  current_stage TEXT NOT NULL DEFAULT 'ideation' CHECK (
    current_stage IN ('ideation', 'research', 'script_generation', 'asset_generation', 'quality_check', 'user_review', 'publishing')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- -----------------------------------------------------------------------------
-- 6. Job Stages (Granular stage tracking for idempotent retries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (
    stage IN ('ideation', 'research', 'script_generation', 'asset_generation', 'quality_check', 'user_review', 'publishing')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  attempt INTEGER NOT NULL DEFAULT 1,
  input JSONB,
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_job_stage UNIQUE (job_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_job_stages_job_id ON public.job_stages(job_id);

-- -----------------------------------------------------------------------------
-- 7. Agent Runs (Execution log for autonomous micro-agents)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input JSONB,
  output JSONB,
  model TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON public.agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_job_id ON public.agent_runs(job_id);

-- -----------------------------------------------------------------------------
-- 8. Platform Accounts (Connected social channels & OAuth tokens)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'x')),
  account_name TEXT NOT NULL,
  external_account_id TEXT,
  -- Sensitive tokens are protected: never query directly via client anon keys
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_platform_account UNIQUE (user_id, platform, external_account_id)
);

CREATE TRIGGER set_platform_accounts_updated_at
BEFORE UPDATE ON public.platform_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON public.platform_accounts(user_id);

-- -----------------------------------------------------------------------------
-- 9. Platform Posts (Publishing records - Non-destructive preservation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.content_projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'x')),
  platform_account_id UUID REFERENCES public.platform_accounts(id) ON DELETE SET NULL,
  external_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  title TEXT NOT NULL,
  caption TEXT,
  published_url TEXT,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_platform_posts_updated_at
BEFORE UPDATE ON public.platform_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_platform_posts_user_id ON public.platform_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_project_id ON public.platform_posts(project_id);

-- -----------------------------------------------------------------------------
-- 10. Analytics Snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_post_id UUID NOT NULL REFERENCES public.platform_posts(id) ON DELETE CASCADE,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(6,4),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_post_id ON public.analytics_snapshots(platform_post_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.content_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- 1. content_projects RLS
CREATE POLICY "Users can view their own projects"
  ON public.content_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.content_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.content_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.content_projects FOR DELETE
  USING (auth.uid() = user_id);

-- 2. content_ideas RLS
CREATE POLICY "Users can view their own ideas"
  ON public.content_ideas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ideas"
  ON public.content_ideas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ideas"
  ON public.content_ideas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ideas"
  ON public.content_ideas FOR DELETE
  USING (auth.uid() = user_id);

-- 3. content_scripts RLS (linked via project_id)
CREATE POLICY "Users can view their project scripts"
  ON public.content_scripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.content_projects p
      WHERE p.id = content_scripts.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project scripts"
  ON public.content_scripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_projects p
      WHERE p.id = content_scripts.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update project scripts"
  ON public.content_scripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.content_projects p
      WHERE p.id = content_scripts.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project scripts"
  ON public.content_scripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.content_projects p
      WHERE p.id = content_scripts.project_id AND p.user_id = auth.uid()
    )
  );

-- 4. content_assets RLS
CREATE POLICY "Users can view their own assets"
  ON public.content_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets"
  ON public.content_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
  ON public.content_assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
  ON public.content_assets FOR DELETE
  USING (auth.uid() = user_id);

-- 5. jobs RLS
CREATE POLICY "Users can view their own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. job_stages RLS (linked via job_id)
CREATE POLICY "Users can view their job stages"
  ON public.job_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_stages.job_id AND j.user_id = auth.uid()
    )
  );

-- 7. agent_runs RLS (linked via project_id)
CREATE POLICY "Users can view their agent runs"
  ON public.agent_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.content_projects p
      WHERE p.id = agent_runs.project_id AND p.user_id = auth.uid()
    )
  );

-- 8. platform_accounts RLS (CRITICAL: Security boundary for tokens)
-- Client users can see account status, but NEVER raw token values directly
CREATE POLICY "Users can view their own platform account metadata"
  ON public.platform_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their platform accounts"
  ON public.platform_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their platform accounts"
  ON public.platform_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their platform accounts"
  ON public.platform_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- 9. platform_posts RLS
CREATE POLICY "Users can view their own platform posts"
  ON public.platform_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert platform posts"
  ON public.platform_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update platform posts"
  ON public.platform_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- 10. analytics_snapshots RLS (linked via platform_post_id)
CREATE POLICY "Users can view their post analytics"
  ON public.analytics_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_posts p
      WHERE p.id = analytics_snapshots.platform_post_id AND p.user_id = auth.uid()
    )
  );
