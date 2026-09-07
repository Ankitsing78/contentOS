import React from 'react';
import { OperationJobItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface OperationCardProps {
  operation: OperationJobItem;
}

export function OperationCard({ operation }: OperationCardProps) {
  const isCompleted = operation.status === 'completed';

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Icons.YouTube key={platform} className="w-3.5 h-3.5 text-red-400" />;
      case 'instagram':
        return <Icons.Instagram key={platform} className="w-3.5 h-3.5 text-pink-400" />;
      case 'x':
        return <Icons.XTwitter key={platform} className="w-3.5 h-3.5 text-zinc-300" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Stage: {operation.stage}
            </span>
            {operation.platforms && (
              <div className="flex items-center gap-1.5 ml-auto">
                {operation.platforms.map(getPlatformIcon)}
              </div>
            )}
          </div>
          <h4 className="text-sm font-semibold text-zinc-100 truncate">
            {operation.title}
          </h4>
        </div>
        <span
          className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-full border ${
            isCompleted
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60'
              : 'bg-indigo-950/40 text-indigo-400 border-indigo-900/60'
          }`}
        >
          {isCompleted ? 'Completed' : `${operation.progress}%`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 mb-2.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
          }`}
          style={{ width: `${operation.progress}%` }}
        />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
        <span className="truncate">{operation.statusLabel || operation.status}</span>
        {operation.estimatedRemaining && (
          <span className="shrink-0 text-zinc-400 ml-2">
            {operation.estimatedRemaining}
          </span>
        )}
      </div>
    </div>
  );
}
