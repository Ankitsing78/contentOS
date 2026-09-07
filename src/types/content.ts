/**
 * ContentOS - Core Content Types
 */

export type PlatformType = 'youtube' | 'instagram' | 'x';

export type ContentStatus =
  | 'draft'
  | 'researching'
  | 'scripting'
  | 'media_generating'
  | 'awaiting_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export interface ContentIdea {
  id: string;
  title: string;
  rawInput: string;
  sourceType: 'text' | 'audio';
  tags: string[];
  targetPlatforms: PlatformType[];
  createdAt: string;
  updatedAt: string;
}

export interface LegacyScriptSection {
  title: string;
  durationEstimateSeconds?: number;
  narration: string;
  visualNotes?: string;
}

export interface ContentScript {
  id: string;
  contentId: string;
  platform: PlatformType;
  title: string;
  caption?: string;
  hashtags: string[];
  sections: LegacyScriptSection[];
  version: number;
}

export interface ContentAsset {
  id: string;
  contentId: string;
  type: 'thumbnail' | 'image' | 'audio' | 'video';
  url: string;
  storagePath: string;
  platform?: PlatformType;
  metadata?: Record<string, unknown>;
}

export interface ContentItem {
  id: string;
  ideaId?: string;
  title: string;
  status: ContentStatus;
  targetPlatforms: PlatformType[];
  scripts?: ContentScript[];
  assets?: ContentAsset[];
  createdAt: string;
  updatedAt: string;
}
