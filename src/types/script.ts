/**
 * ContentOS - Script Domain Models & Contracts
 */

import { PlatformType } from './content';

export type ScriptFormat = 'short_video' | 'long_video' | 'thread' | 'reel' | 'post';

export type ScriptSectionType =
  | 'hook'
  | 'intro'
  | 'problem'
  | 'evidence'
  | 'counter_argument'
  | 'resolution'
  | 'cta';

export type VisualDirectionType =
  | 'talking_head'
  | 'screen_recording'
  | 'chart_graphic'
  | 'b_roll'
  | 'text_overlay'
  | 'diagram'
  | 'code_visual';

/**
 * Validated mapping of a claim in the script to a research source
 */
export interface ScriptSourceReference {
  source_id?: string;
  claim: string;
  source_title: string;
  source_url: string;
  usage_note?: string;
}

/**
 * Individual timed section of a script
 */
export interface ScriptSection {
  id?: string;
  order: number;
  type: ScriptSectionType;
  start_second: number;
  end_second: number;
  spoken_text: string;
  visual_direction: string;
  b_roll_suggestions: string[];
  on_screen_text?: string;
  source_references: ScriptSourceReference[];
}

/**
 * Complete, standalone script
 */
export interface Script {
  id?: string;
  project_id: string;
  job_id?: string;
  title: string;
  format: ScriptFormat;
  platform: PlatformType | 'master';
  target_duration_seconds: number;
  estimated_duration_seconds: number;
  word_count: number;
  language: string;
  tone: string;
  hook: string;
  sections: ScriptSection[];
  cta: string;
  source_references: ScriptSourceReference[];
  unresolved_claims: string[];
  generated_at: string;
  version: number;
  is_mock_data: boolean;
}

/**
 * Platform-tailored variant of the master script
 */
export interface PlatformScriptVariant {
  platform: PlatformType;
  title: string;
  format: ScriptFormat;
  target_duration_seconds: number;
  estimated_duration_seconds: number;
  word_count: number;
  hook: string;
  cta: string;
  sections: ScriptSection[];
  source_references: ScriptSourceReference[];
  platform_adjustments: string;
}

/**
 * Complete consolidated script package returned by Script Agent
 */
export interface ScriptPackage {
  master_script: Script;
  platform_variants: PlatformScriptVariant[];
  consistency_notes: string;
  unsupported_claims: string[];
  overall_confidence: 'low' | 'medium' | 'high';
  generated_at: string;
  is_mock_data: boolean;
}

/**
 * Phase 1: Script Planning intermediate representation
 */
export interface ScriptPlan {
  narrative_goal: string;
  audience: string;
  opening_strategy: string;
  key_sections: Array<{
    title: string;
    section_type: ScriptSectionType;
    estimated_duration_seconds: number;
    evidence_points: string[];
    visual_idea: string;
  }>;
  cta_strategy: string;
  platform_adjustments: Record<string, string>;
}
