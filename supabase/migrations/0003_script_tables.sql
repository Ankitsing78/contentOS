-- =============================================================================
-- ContentOS - Script Layer Database Migration
-- Migration: 0003_script_tables.sql
-- Description: Creates normalized tables for Scripts, Sections, and Source References
--              with strict RLS policies consistent with the ContentOS security model.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Scripts (Master scripts and platform variants)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short_video', 'long_video', 'thread', 'reel', 'post')),
  platform TEXT NOT NULL CHECK (platform IN ('master', 'youtube', 'instagram', 'x')),
  target_duration_seconds INTEGER NOT NULL,
  estimated_duration_seconds INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  tone TEXT NOT NULL,
  hook TEXT NOT NULL,
  cta TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_mock_data BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_scripts_updated_at
BEFORE UPDATE ON public.scripts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON public.scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_job_id ON public.scripts(job_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_platform ON public.scripts(platform);

-- -----------------------------------------------------------------------------
-- 2. Script Sections (Sequentially ordered, timed segments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.script_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_order INTEGER NOT NULL,
  section_type TEXT NOT NULL CHECK (
    section_type IN ('hook', 'intro', 'problem', 'evidence', 'counter_argument', 'resolution', 'cta')
  ),
  start_second NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  end_second NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  spoken_text TEXT NOT NULL,
  visual_direction TEXT,
  b_roll_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  on_screen_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_sections_script_id ON public.script_sections(script_id);
CREATE INDEX IF NOT EXISTS idx_script_sections_user_id ON public.script_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_script_sections_order ON public.script_sections(script_id, section_order);

-- -----------------------------------------------------------------------------
-- 3. Script Source References (Validated claims mapped to research sources)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.script_source_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.script_sections(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.research_sources(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  usage_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_source_references_section_id ON public.script_source_references(section_id);
CREATE INDEX IF NOT EXISTS idx_script_source_references_source_id ON public.script_source_references(source_id);
CREATE INDEX IF NOT EXISTS idx_script_source_references_user_id ON public.script_source_references(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_source_references ENABLE ROW LEVEL SECURITY;

-- 1. scripts RLS
CREATE POLICY "Users can view their own scripts"
  ON public.scripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scripts"
  ON public.scripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts"
  ON public.scripts FOR DELETE
  USING (auth.uid() = user_id);

-- 2. script_sections RLS
CREATE POLICY "Users can view their own script sections"
  ON public.script_sections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own script sections"
  ON public.script_sections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own script sections"
  ON public.script_sections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own script sections"
  ON public.script_sections FOR DELETE
  USING (auth.uid() = user_id);

-- 3. script_source_references RLS
CREATE POLICY "Users can view their own script source references"
  ON public.script_source_references FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own script source references"
  ON public.script_source_references FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own script source references"
  ON public.script_source_references FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own script source references"
  ON public.script_source_references FOR DELETE
  USING (auth.uid() = user_id);
