-- =============================================================================
-- ContentOS - Video Composition & Rendering Migration
-- Migration: 0007_video_rendering.sql
-- Description: Updates stage check constraints on job_stages to include 'video_rendering'.
-- =============================================================================

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
        'video_rendering',
        'quality_check',
        'user_review',
        'publishing'
      )
    );
  END IF;
END $$;
