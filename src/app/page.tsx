'use client';

import React from 'react';
import {
  AppShell,
  CommandCenter,
  ActiveOperations,
  ContentPipeline,
  PlatformStatus,
  AgentStatus,
  RecentContent,
} from '@/components';
import {
  MOCK_ACTIVE_OPERATIONS,
  MOCK_PIPELINE_PROJECT,
  MOCK_CONNECTED_PLATFORMS,
  MOCK_AI_AGENTS,
  MOCK_RECENT_CONTENT,
} from '@/lib/mock';

export default function Home() {
  return (
    <AppShell>
      {/* 1. Primary Focus: Command Center Console */}
      <section className="space-y-3">
        <CommandCenter />
      </section>

      {/* 2. Active Operations */}
      <section>
        <ActiveOperations operations={MOCK_ACTIVE_OPERATIONS} />
      </section>

      {/* 3. Content Pipeline Progression */}
      <section id="pipeline">
        <ContentPipeline pipeline={MOCK_PIPELINE_PROJECT} />
      </section>

      {/* 4. AI Agents Swarm Status */}
      <section id="agents">
        <AgentStatus agents={MOCK_AI_AGENTS} />
      </section>

      {/* 5. Distribution & Recent Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="publishing">
        {/* Connected Platforms (4 cols on lg) */}
        <div className="lg:col-span-4">
          <PlatformStatus platforms={MOCK_CONNECTED_PLATFORMS} />
        </div>

        {/* Recent Content Table/Cards (8 cols on lg) */}
        <div className="lg:col-span-8" id="projects">
          <RecentContent items={MOCK_RECENT_CONTENT} />
        </div>
      </div>
    </AppShell>
  );
}
