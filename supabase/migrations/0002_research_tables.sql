-- =============================================================================
-- ContentOS - Research Layer Database Migration
-- Migration: 0002_research_tables.sql
-- Description: Creates normalized tables for Research Plans, Sources, and Evidence
--              with strict RLS policies consistent with the ContentOS security model.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Research Plans (Phase A output)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  claims_to_verify JSONB NOT NULL DEFAULT '[]'::jsonb,
  facts_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  freshness_requirements TEXT NOT NULL,
  research_priority TEXT NOT NULL CHECK (research_priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_research_plans_updated_at
BEFORE UPDATE ON public.research_plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_research_plans_project_id ON public.research_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_research_plans_job_id ON public.research_plans(job_id);
CREATE INDEX IF NOT EXISTS idx_research_plans_user_id ON public.research_plans(user_id);

-- -----------------------------------------------------------------------------
-- 2. Research Sources (Retrieved material)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL CHECK (
    source_type IN ('article', 'paper', 'news', 'documentation', 'report', 'mock_test_fixture')
  ),
  relevance TEXT NOT NULL CHECK (relevance IN ('low', 'medium', 'high')),
  credibility TEXT NOT NULL CHECK (credibility IN ('low', 'medium', 'high')),
  evidence_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_sources_project_id ON public.research_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_user_id ON public.research_sources(user_id);

-- -----------------------------------------------------------------------------
-- 3. Research Evidence (Claims linked to excerpts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.research_sources(id) ON DELETE SET NULL,
  claim TEXT NOT NULL,
  source TEXT NOT NULL,
  supporting_excerpt TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_evidence_project_id ON public.research_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_research_evidence_user_id ON public.research_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_research_evidence_source_id ON public.research_evidence(source_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.research_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_evidence ENABLE ROW LEVEL SECURITY;

-- 1. research_plans RLS
CREATE POLICY "Users can view their own research plans"
  ON public.research_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research plans"
  ON public.research_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research plans"
  ON public.research_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own research plans"
  ON public.research_plans FOR DELETE
  USING (auth.uid() = user_id);

-- 2. research_sources RLS
CREATE POLICY "Users can view their own research sources"
  ON public.research_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research sources"
  ON public.research_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research sources"
  ON public.research_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own research sources"
  ON public.research_sources FOR DELETE
  USING (auth.uid() = user_id);

-- 3. research_evidence RLS
CREATE POLICY "Users can view their own research evidence"
  ON public.research_evidence FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research evidence"
  ON public.research_evidence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research evidence"
  ON public.research_evidence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own research evidence"
  ON public.research_evidence FOR DELETE
  USING (auth.uid() = user_id);
