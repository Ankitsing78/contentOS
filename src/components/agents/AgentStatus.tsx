import React from 'react';
import { AgentStatusItem } from '@/types';
import { AgentStatusCard } from './AgentStatusCard';
import { Icons } from '@/components/ui/Icons';

interface AgentStatusProps {
  agents: AgentStatusItem[];
}

export function AgentStatus({ agents }: AgentStatusProps) {
  const workingCount = agents.filter(
    (a) => a.status === 'working' || a.status === 'rendering' || a.status === 'monitoring'
  ).length;

  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5" aria-label="AI Agents Swarm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
            <Icons.Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">AI Agents Status</h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Autonomous micro-agents swarm orchestration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-950/50 text-indigo-300 border border-indigo-900/60">
            {workingCount} Active
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
            {agents.length} Total
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <AgentStatusCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}
