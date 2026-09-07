/**
 * ContentOS - Dashboard UI and Mock Data Types
 */

import { PlatformType } from './content';

export type OperationStatus = 'working' | 'completed' | 'failed' | 'paused' | 'queued';

export interface OperationJobItem {
  id: string;
  title: string;
  stage: string;
  progress: number;
  status: OperationStatus;
  statusLabel?: string;
  estimatedRemaining?: string;
  platforms?: PlatformType[];
}

export type PipelineStageStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

export interface PipelineStageItem {
  key: string;
  label: string;
  shortLabel: string;
  status: PipelineStageStatus;
  description: string;
  iconName: string;
}

export interface ProjectPipeline {
  projectId: string;
  projectTitle: string;
  targetPlatforms: PlatformType[];
  currentStageKey: string;
  stages: PipelineStageItem[];
}

export type AgentWorkState = 'idle' | 'working' | 'rendering' | 'waiting' | 'monitoring' | 'completed';

export interface AgentStatusItem {
  id: string;
  name: string;
  role: string;
  status: AgentWorkState;
  currentTask: string;
  lastActive: string;
  iconName: string;
}

export interface PlatformConnectionItem {
  platform: PlatformType;
  name: string;
  isConnected: boolean;
  accountHandle?: string;
  followers?: string;
  notice: string;
}

export interface RecentContentItem {
  id: string;
  title: string;
  type: 'Reel' | 'YouTube Video' | 'Thread' | 'Carousel' | 'Short';
  platforms: PlatformType[];
  status: 'Published' | 'Processing' | 'Draft' | 'Scheduled' | 'Review';
  createdAt: string;
  duration?: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  promptTemplate: string;
  iconName: string;
  badge?: string;
}
