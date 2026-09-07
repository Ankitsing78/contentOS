import React from 'react';
import { AgentStatusItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface AgentStatusCardProps {
  agent: AgentStatusItem;
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'compass':
        return <Icons.Compass className="w-3.5 h-3.5" />;
      case 'database':
        return <Icons.Database className="w-3.5 h-3.5" />;
      case 'pen-tool':
        return <Icons.PenTool className="w-3.5 h-3.5" />;
      case 'film':
        return <Icons.Film className="w-3.5 h-3.5" />;
      case 'check-circle-2':
        return <Icons.CheckCircle2 className="w-3.5 h-3.5" />;
      case 'share-2':
        return <Icons.Share2 className="w-3.5 h-3.5" />;
      case 'activity':
        return <Icons.Activity className="w-3.5 h-3.5" />;
      default:
        return <Icons.Bot className="w-3.5 h-3.5" />;
    }
  };

  const getStatusVisuals = (status: AgentStatusItem['status']) => {
    switch (status) {
      case 'working':
      case 'rendering':
        return {
          badge: 'bg-indigo-950/50 text-indigo-300 border-indigo-900/60',
          dot: 'bg-indigo-400 animate-pulse',
          label: status === 'rendering' ? 'Rendering' : 'Working',
        };
      case 'monitoring':
        return {
          badge: 'bg-cyan-950/50 text-cyan-300 border-cyan-900/60',
          dot: 'bg-cyan-400 animate-pulse',
          label: 'Monitoring',
        };
      case 'waiting':
        return {
          badge: 'bg-amber-950/50 text-amber-300 border-amber-900/60',
          dot: 'bg-amber-400',
          label: 'Waiting',
        };
      case 'idle':
      default:
        return {
          badge: 'bg-zinc-900 text-zinc-500 border-zinc-800',
          dot: 'bg-zinc-600',
          label: 'Idle',
        };
    }
  };

  const visuals = getStatusVisuals(agent.status);

  return (
    <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
              {getIcon(agent.iconName)}
            </div>
            <div>
              <h5 className="text-xs font-semibold text-zinc-200">{agent.name}</h5>
              <p className="text-[10px] text-zinc-500 font-mono">{agent.role}</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shrink-0 ${visuals.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${visuals.dot}`} />
            {visuals.label}
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/40">
          {agent.currentTask}
        </p>
      </div>

      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>Heartbeat:</span>
        <span className="text-zinc-400">{agent.lastActive}</span>
      </div>
    </div>
  );
}
