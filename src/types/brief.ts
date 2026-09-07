/**
 * ContentOS - Content Understanding Brief Types
 */

import { PlatformType } from './content';

export interface ContentBrief {
  title: string;
  summary: string;
  topic: string;
  audience: string;
  content_goal: string;
  angle: string;
  hook: string;
  tone: string;
  key_points: string[];
  suggested_formats: string[];
  platforms: PlatformType[];
  needs_research: boolean;
}

export interface ContentIntakeResult {
  success: boolean;
  projectId: string;
  jobId: string;
  brief: ContentBrief;
  originalInput: string;
  createdAt: string;
}
