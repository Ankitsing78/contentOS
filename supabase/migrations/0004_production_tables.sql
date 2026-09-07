-- =============================================================================
-- ContentOS - Production Layer Database Migration
-- Migration: 0004_production_tables.sql
-- Description: Creates normalized tables for Production Packages, Scenes,
--              Visual Requirements, Audio Requirements, and Synchronized Captions
--              with strict RLS policies consistent with the ContentOS security model.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Update check constraints to include 'production_planning'
-- -----------------------------------------------------------------------------
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_current_stage_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_current_stage_check CHECK (
  current_stage IN ('ideation', 'brief', 'research', 'script_generation', 'production_planning', 'media_generation', 'audio_generation', 'assembly', 'review', 'publishing', 'completed')
);

ALTER TABLE public.job_stages DROP CONSTRAINT IF EXISTS job_stages_stage_check;
ALTER TABLE public.job_stages ADD CONSTRAINT job_stages_stage_check CHECK (
  stage IN ('ideation', 'brief', 'research', 'script_generation', 'production_planning', 'media_generation', 'audio_generation', 'assembly', 'review', 'publishing', 'completed')
);

-- -----------------------------------------------------------------------------
-- 1. Production Packages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  script_id UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'x')),
  format TEXT NOT NULL CHECK (format IN ('short_video', 'long_video', 'thread', 'reel', 'post')),
  aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
  duration_seconds NUMERIC(6, 2) NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'high',
  is_mock_data BOOLEAN NOT NULL DEFAULT false,
  transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  overlays JSONB NOT NULL DEFAULT '[]'::jsonb,
  asset_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  production_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_production_packages_updated_at
BEFORE UPDATE ON public.production_packages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_production_packages_project_id ON public.production_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_production_packages_job_id ON public.production_packages(job_id);
CREATE INDEX IF NOT EXISTS idx_production_packages_script_id ON public.production_packages(script_id);
CREATE INDEX IF NOT EXISTS idx_production_packages_user_id ON public.production_packages(user_id);

-- -----------------------------------------------------------------------------
-- 2. Production Scenes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_package_id UUID NOT NULL REFERENCES public.production_packages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_order INTEGER NOT NULL,
  start_second NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  end_second NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  purpose TEXT NOT NULL,
  spoken_text TEXT NOT NULL DEFAULT '',
  visual_type TEXT NOT NULL,
  visual_prompt TEXT NOT NULL DEFAULT '',
  b_roll_requirement TEXT NOT NULL DEFAULT '',
  camera_direction TEXT NOT NULL DEFAULT '',
  composition TEXT NOT NULL DEFAULT '',
  on_screen_text TEXT,
  caption_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_scenes_package_id ON public.production_scenes(production_package_id);
CREATE INDEX IF NOT EXISTS idx_production_scenes_user_id ON public.production_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_production_scenes_order ON public.production_scenes(production_package_id, scene_order);

-- -----------------------------------------------------------------------------
-- 3. Production Visual Requirements (Specification Only: Pending Assets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_visual_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_package_id UUID NOT NULL REFERENCES public.production_packages(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.production_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  resolution TEXT NOT NULL,
  duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  source TEXT NOT NULL DEFAULT 'ai_generated',
  generation_required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'not_required')),
  storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_visual_reqs_package_id ON public.production_visual_requirements(production_package_id);
CREATE INDEX IF NOT EXISTS idx_production_visual_reqs_scene_id ON public.production_visual_requirements(scene_id);
CREATE INDEX IF NOT EXISTS idx_production_visual_reqs_user_id ON public.production_visual_requirements(user_id);

-- -----------------------------------------------------------------------------
-- 4. Production Audio Requirements (Narration, BGM, SFX)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_audio_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_package_id UUID NOT NULL REFERENCES public.production_packages(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.production_scenes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_type TEXT NOT NULL CHECK (audio_type IN ('voiceover', 'background_music', 'sound_effect', 'ambient')),
  description TEXT NOT NULL,
  text TEXT,
  voice_requirement TEXT,
  duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  generation_required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'not_required')),
  storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_audio_reqs_package_id ON public.production_audio_requirements(production_package_id);
CREATE INDEX IF NOT EXISTS idx_production_audio_reqs_scene_id ON public.production_audio_requirements(scene_id);
CREATE INDEX IF NOT EXISTS idx_production_audio_reqs_user_id ON public.production_audio_requirements(user_id);

-- -----------------------------------------------------------------------------
-- 5. Production Captions (Burned-in timed subtitle cards)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_package_id UUID NOT NULL REFERENCES public.production_packages(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.production_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_second NUMERIC(6, 2) NOT NULL,
  end_second NUMERIC(6, 2) NOT NULL,
  caption_text TEXT NOT NULL,
  emphasis_words JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_captions_package_id ON public.production_captions(production_package_id);
CREATE INDEX IF NOT EXISTS idx_production_captions_scene_id ON public.production_captions(scene_id);
CREATE INDEX IF NOT EXISTS idx_production_captions_user_id ON public.production_captions(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.production_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_visual_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_audio_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_captions ENABLE ROW LEVEL SECURITY;

-- 1. production_packages RLS
CREATE POLICY "Users can view their own production packages"
  ON public.production_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own production packages"
  ON public.production_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own production packages"
  ON public.production_packages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own production packages"
  ON public.production_packages FOR DELETE
  USING (auth.uid() = user_id);

-- 2. production_scenes RLS
CREATE POLICY "Users can view their own production scenes"
  ON public.production_scenes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own production scenes"
  ON public.production_scenes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own production scenes"
  ON public.production_scenes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own production scenes"
  ON public.production_scenes FOR DELETE
  USING (auth.uid() = user_id);

-- 3. production_visual_requirements RLS
CREATE POLICY "Users can view their own visual requirements"
  ON public.production_visual_requirements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visual requirements"
  ON public.production_visual_requirements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visual requirements"
  ON public.production_visual_requirements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visual requirements"
  ON public.production_visual_requirements FOR DELETE
  USING (auth.uid() = user_id);

-- 4. production_audio_requirements RLS
CREATE POLICY "Users can view their own audio requirements"
  ON public.production_audio_requirements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audio requirements"
  ON public.production_audio_requirements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio requirements"
  ON public.production_audio_requirements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio requirements"
  ON public.production_audio_requirements FOR DELETE
  USING (auth.uid() = user_id);

-- 5. production_captions RLS
CREATE POLICY "Users can view their own production captions"
  ON public.production_captions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own production captions"
  ON public.production_captions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own production captions"
  ON public.production_captions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own production captions"
  ON public.production_captions FOR DELETE
  USING (auth.uid() = user_id);
