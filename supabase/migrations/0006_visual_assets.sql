-- =============================================================================
-- ContentOS - Visual & Image Asset Generation Migration
-- Migration: 0006_visual_assets.sql
-- Description: Adds content_asset_id link to production_visual_requirements,
--              updates stage check constraints to include 'visual_generation',
--              and ensures foreign key relationship to content_assets.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add content_asset_id Foreign Key to production_visual_requirements
-- -----------------------------------------------------------------------------
ALTER TABLE public.production_visual_requirements
  ADD COLUMN IF NOT EXISTS content_asset_id UUID REFERENCES public.content_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_visual_reqs_content_asset_id
  ON public.production_visual_requirements(content_asset_id);

-- -----------------------------------------------------------------------------
-- 2. Update Stage Constraints for visual_generation
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Update job_stages check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'job_stages_stage_check'
  ) THEN
    ALTER TABLE public.job_stages DROP CONSTRAINT job_stages_stage_check;
    ALTER TABLE public.job_stages ADD CONSTRAINT job_stages_stage_check CHECK (
      stage IN (
        'ideation',
        'research',
        'script_generation',
        'production_planning',
        'voice_generation',
        'audio_generation',
        'visual_generation',
        'asset_generation',
        'quality_check',
        'user_review',
        'publishing'
      )
    );
  END IF;
END $$;
