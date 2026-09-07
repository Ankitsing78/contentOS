import React from 'react';
import { ContentBrief } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface ContentBriefPanelProps {
  brief: ContentBrief;
  projectId: string;
  jobId: string;
  onDismiss?: () => void;
  onRunResearch?: () => void;
  isResearching?: boolean;
  onGenerateScript?: () => void;
  isGeneratingScript?: boolean;
}

export function ContentBriefPanel({
  brief,
  projectId,
  jobId,
  onDismiss,
  onRunResearch,
  isResearching = false,
  onGenerateScript,
  isGeneratingScript = false,
}: ContentBriefPanelProps) {
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
    <div className="rounded-2xl bg-zinc-900 border border-indigo-500/40 p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-800">
              Content Brief Generated
            </span>
            <span className="text-xs font-mono text-zinc-500">
              Topic: <strong className="text-zinc-300">{brief.topic}</strong>
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            {brief.title}
          </h3>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close brief"
          >
            <Icons.XClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Summary & Goal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Executive Summary
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
            {brief.summary}
          </p>
        </div>

        <div className="space-y-3 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/60 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
              Content Goal
            </span>
            <p className="text-xs text-zinc-200 font-medium">{brief.content_goal}</p>
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
              Tone & Voice
            </span>
            <span className="inline-block text-xs px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
              {brief.tone}
            </span>
          </div>
        </div>
      </div>

      {/* Angle, Hook & Audience */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
            Target Audience
          </span>
          <p className="text-xs text-zinc-200 leading-normal">{brief.audience}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block mb-1">
            Unique Angle
          </span>
          <p className="text-xs text-zinc-200 leading-normal">{brief.angle}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-indigo-900/40 bg-gradient-to-br from-indigo-950/20 to-transparent">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block mb-1">
            Opening Hook (3 sec)
          </span>
          <p className="text-xs text-amber-200/90 font-medium italic leading-normal">
            &ldquo;{brief.hook}&rdquo;
          </p>
        </div>
      </div>

      {/* Key Arguments & Outline Points */}
      <div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-2">
          Key Narrative Points
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {brief.key_points.map((pt, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-300"
            >
              <span className="text-indigo-400 font-mono text-[10px] mt-0.5">
                0{idx + 1}.
              </span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formats, Platforms & Research Requirement */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500">Formats:</span>
            {brief.suggested_formats.map((fmt) => (
              <span
                key={fmt}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
              >
                {fmt}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500">Channels:</span>
            <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
              {brief.platforms.map(getPlatformIcon)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-mono px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
              brief.needs_research
                ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                : 'bg-emerald-950/50 text-emerald-400 border-emerald-900/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                brief.needs_research ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            {brief.needs_research ? 'Research Required' : 'Ready for Scripting'}
          </span>

          {brief.needs_research && onRunResearch && (
            <button
              type="button"
              onClick={onRunResearch}
              disabled={isResearching}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              {isResearching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <span>🔎 Run Research Agent</span>
                </>
              )}
            </button>
          )}

          {!brief.needs_research && onGenerateScript && (
            <button
              type="button"
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              {isGeneratingScript ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Script...</span>
                </>
              ) : (
                <>
                  <span>✍️ Generate Script</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer System Identifiers */}
      <div className="pt-2 border-t border-zinc-800/40 flex flex-wrap items-center justify-between text-[10px] font-mono text-zinc-500">
        <div>
          Project ID: <span className="text-zinc-400">{projectId}</span>
        </div>
        <div>
          Job ID: <span className="text-zinc-400">{jobId}</span>
        </div>
      </div>
    </div>
  );
}
