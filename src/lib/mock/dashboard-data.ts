/**
 * ContentOS - Centralized Dashboard Mock Data
 * Clean local mock datasets for the Command Center presentation layer.
 */

import {
  OperationJobItem,
  ProjectPipeline,
  AgentStatusItem,
  PlatformConnectionItem,
  RecentContentItem,
  QuickActionItem,
} from '@/types';

export const MOCK_ACTIVE_OPERATIONS: OperationJobItem[] = [
  {
    id: 'op-101',
    title: 'AI Careers Video',
    stage: 'Video Rendering',
    progress: 72,
    status: 'working',
    statusLabel: 'Rendering frame 1,240 / 1,800',
    estimatedRemaining: '~2 min remaining',
    platforms: ['youtube'],
  },
  {
    id: 'op-102',
    title: 'Startup Automation Reel',
    stage: 'Publishing',
    progress: 100,
    status: 'completed',
    statusLabel: 'Completed',
    estimatedRemaining: 'Published 4m ago',
    platforms: ['instagram', 'youtube'],
  },
  {
    id: 'op-103',
    title: 'AI Trends Research',
    stage: 'Research',
    progress: 38,
    status: 'working',
    statusLabel: 'Synthesizing 14 industry reports',
    estimatedRemaining: '~45 sec remaining',
    platforms: ['x'],
  },
];

export const MOCK_PIPELINE_PROJECT: ProjectPipeline = {
  projectId: 'prj-dev-jobs-2026',
  projectTitle: 'AI and the Future of Developer Jobs',
  targetPlatforms: ['youtube', 'instagram', 'x'],
  currentStageKey: 'media',
  stages: [
    {
      key: 'idea',
      label: 'Idea',
      shortLabel: '01',
      status: 'completed',
      description: 'Extracted core thesis from voice note; angle validated.',
      iconName: 'lightbulb',
    },
    {
      key: 'research',
      label: 'Research',
      shortLabel: '02',
      status: 'completed',
      description: 'Grounded in 2026 developer salary & AI tool adoption data.',
      iconName: 'search',
    },
    {
      key: 'script',
      label: 'Script',
      shortLabel: '03',
      status: 'completed',
      description: '3-hook retention structure & multi-platform caption variants.',
      iconName: 'file-text',
    },
    {
      key: 'media',
      label: 'Media',
      shortLabel: '04',
      status: 'in_progress',
      description: 'Synthesizing 4K visual b-roll and generating thumbnail options.',
      iconName: 'video',
    },
    {
      key: 'quality',
      label: 'Quality Check',
      shortLabel: '05',
      status: 'pending',
      description: 'Automated fact-checking, cadence audit, and platform spec checks.',
      iconName: 'shield-check',
    },
    {
      key: 'review',
      label: 'Review',
      shortLabel: '06',
      status: 'pending',
      description: 'Creator approval gate before publication.',
      iconName: 'user-check',
    },
    {
      key: 'publish',
      label: 'Publish',
      shortLabel: '07',
      status: 'pending',
      description: 'Scheduled dispatch to YouTube, Instagram & X.',
      iconName: 'send',
    },
  ],
};

export const MOCK_AI_AGENTS: AgentStatusItem[] = [
  {
    id: 'agent-strategy',
    name: 'Strategy Agent',
    role: 'Editorial & Topic Strategy',
    status: 'working',
    currentTask: 'Analyzing high-performing dev topics',
    lastActive: 'Active now',
    iconName: 'compass',
  },
  {
    id: 'agent-research',
    name: 'Research Agent',
    role: 'Web & Literature Discovery',
    status: 'working',
    currentTask: 'Extracting citations on AI code generation',
    lastActive: 'Active now',
    iconName: 'database',
  },
  {
    id: 'agent-content',
    name: 'Content Agent',
    role: 'Hook & Script Synthesis',
    status: 'idle',
    currentTask: 'Standby for new topic briefs',
    lastActive: '3m ago',
    iconName: 'pen-tool',
  },
  {
    id: 'agent-media',
    name: 'Media Agent',
    role: 'Visuals & Video Production',
    status: 'rendering',
    currentTask: 'Compositing b-roll layers for Reel #104',
    lastActive: 'Active now',
    iconName: 'film',
  },
  {
    id: 'agent-quality',
    name: 'Quality Agent',
    role: 'Fact-checking & Polish',
    status: 'waiting',
    currentTask: 'Awaiting Media Agent completion',
    lastActive: '12m ago',
    iconName: 'check-circle-2',
  },
  {
    id: 'agent-publishing',
    name: 'Publishing Agent',
    role: 'Multi-platform Dispatch',
    status: 'idle',
    currentTask: 'Queue empty, awaiting review approvals',
    lastActive: '1h ago',
    iconName: 'share-2',
  },
  {
    id: 'agent-analytics',
    name: 'Analytics Agent',
    role: 'Performance & Optimization',
    status: 'monitoring',
    currentTask: 'Tracking 24h retention on recent Shorts',
    lastActive: 'Active now',
    iconName: 'activity',
  },
];

export const MOCK_CONNECTED_PLATFORMS: PlatformConnectionItem[] = [
  {
    platform: 'youtube',
    name: 'YouTube',
    isConnected: true,
    accountHandle: '@ContentOS_Creator',
    followers: '14.2K subscribers',
    notice: 'OAuth token active (Visual Placeholder)',
  },
  {
    platform: 'instagram',
    name: 'Instagram',
    isConnected: true,
    accountHandle: '@contentos.ai',
    followers: '28.6K followers',
    notice: 'Meta Graph API active (Visual Placeholder)',
  },
  {
    platform: 'x',
    name: 'X (Twitter)',
    isConnected: false,
    notice: 'API v2 OAuth connection pending in Stage 4',
  },
];

export const MOCK_RECENT_CONTENT: RecentContentItem[] = [
  {
    id: 'rec-1',
    title: "AI Won't Replace Developers",
    type: 'Reel',
    platforms: ['instagram', 'youtube'],
    status: 'Published',
    createdAt: 'Today, 2:30 PM',
    duration: '0:58',
  },
  {
    id: 'rec-2',
    title: '5 AI Tools Developers Should Know',
    type: 'YouTube Video',
    platforms: ['youtube'],
    status: 'Processing',
    createdAt: 'Today, 11:15 AM',
    duration: '8:45',
  },
  {
    id: 'rec-3',
    title: 'Future of Software Jobs',
    type: 'Thread',
    platforms: ['x'],
    status: 'Draft',
    createdAt: 'Yesterday',
    duration: '6 posts',
  },
];

export const QUICK_ACTION_PRESETS: QuickActionItem[] = [
  {
    id: 'qa-reel',
    label: 'Create a Reel',
    promptTemplate: 'Create a 60-second high-energy Instagram Reel about: ',
    iconName: 'film',
  },
  {
    id: 'qa-yt',
    label: 'Create YouTube Video',
    promptTemplate: 'Plan an 8-minute comprehensive YouTube breakdown titled: ',
    iconName: 'youtube',
  },
  {
    id: 'qa-ideas',
    label: 'Generate Content Ideas',
    promptTemplate: 'Generate 5 viral content angles and hooks in the niche of: ',
    iconName: 'sparkles',
  },
  {
    id: 'qa-research',
    label: 'Research a Topic',
    promptTemplate: 'Deep dive and gather fresh stats, benchmarks, and key arguments regarding: ',
    iconName: 'search',
  },
  {
    id: 'qa-repurpose',
    label: 'Repurpose Content',
    promptTemplate: 'Take this transcript and convert it into a thread for X and a short script: ',
    iconName: 'repeat',
  },
];
