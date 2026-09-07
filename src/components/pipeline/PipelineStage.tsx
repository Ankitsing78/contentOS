import React from 'react';
import { PipelineStageItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface PipelineStageProps {
  stage: PipelineStageItem;
  isLast: boolean;
}

export function PipelineStage({ stage, isLast }: PipelineStageProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'lightbulb':
        return <Icons.Lightbulb className="w-4 h-4" />;
      case 'search':
        return <Icons.Search className="w-4 h-4" />;
      case 'file-text':
        return <Icons.FileText className="w-4 h-4" />;
      case 'video':
        return <Icons.Video className="w-4 h-4" />;
      case 'shield-check':
        return <Icons.ShieldCheck className="w-4 h-4" />;
      case 'user-check':
        return <Icons.UserCheck className="w-4 h-4" />;
      case 'send':
        return <Icons.Send className="w-4 h-4" />;
      default:
        return <Icons.CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: PipelineStageItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/60 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/50 text-indigo-300 border border-indigo-800/80 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping" />
            In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
            Pending
          </span>
        );
    }
  };

  const isCurrent = stage.status === 'in_progress';
  const isDone = stage.status === 'completed';

  return (
    <div className="flex-1 min-w-[150px] relative flex flex-col group">
      {/* Node Box */}
      <div
        className={`p-3.5 rounded-xl border transition-all duration-150 h-full flex flex-col justify-between ${
          isCurrent
            ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm shadow-indigo-950/50'
            : isDone
            ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
            : 'bg-zinc-950/40 border-zinc-900 text-zinc-600'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div
            className={`p-2 rounded-lg border ${
              isCurrent
                ? 'bg-indigo-600 text-white border-indigo-400'
                : isDone
                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/60'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            {getIcon(stage.iconName)}
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            #{stage.shortLabel}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <h5
              className={`text-xs font-semibold ${
                isCurrent
                  ? 'text-indigo-200'
                  : isDone
                  ? 'text-zinc-200'
                  : 'text-zinc-500'
              }`}
            >
              {stage.label}
            </h5>
          </div>

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed mb-2.5">
            {stage.description}
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
          {getStatusBadge(stage.status)}
        </div>
      </div>

      {/* Visual connector arrow for desktop progression */}
      {!isLast && (
        <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-zinc-700 pointer-events-none">
          <Icons.ArrowRight className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
