import React from 'react';
import { ProjectPipeline } from '@/types';
import { PipelineStage } from './PipelineStage';
import { Icons } from '@/components/ui/Icons';

interface ContentPipelineProps {
  pipeline: ProjectPipeline;
}

export function ContentPipeline({ pipeline }: ContentPipelineProps) {
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
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5" aria-label="Content Pipeline">
      {/* Header with Sample Project Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
            <Icons.Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
                Active Pipeline Tracking
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                Stage 4 of 7
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
              {pipeline.projectTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            <span className="text-[11px] text-zinc-500">Targeting:</span>
            {pipeline.targetPlatforms.map(getPlatformIcon)}
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-indigo-950/50 text-indigo-300 border border-indigo-900/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Media Phase
          </span>
        </div>
      </div>

      {/* Horizontal Scrollable Stages Container */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        <div className="flex items-stretch gap-3 min-w-[780px] lg:min-w-full">
          {pipeline.stages.map((stage, idx) => (
            <PipelineStage
              key={stage.key}
              stage={stage}
              isLast={idx === pipeline.stages.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
