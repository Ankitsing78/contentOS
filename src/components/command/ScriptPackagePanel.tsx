import React, { useState } from 'react';
import { ScriptPackage, ScriptSection, PlatformScriptVariant } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface ScriptPackagePanelProps {
  pkg: ScriptPackage;
  projectId: string;
  jobId?: string;
  onDismiss?: () => void;
  onGenerateProduction?: (platform: string) => void;
  isGeneratingProduction?: boolean;
}

export function ScriptPackagePanel({
  pkg,
  projectId,
  jobId,
  onDismiss,
  onGenerateProduction,
  isGeneratingProduction = false,
}: ScriptPackagePanelProps) {
  const { master_script, platform_variants, consistency_notes, unsupported_claims, is_mock_data } = pkg;
  const [activeTab, setActiveTab] = useState<'master' | string>('master');
  const [copied, setCopied] = useState(false);

  // Determine which script/variant is currently selected
  const activeVariant: PlatformScriptVariant | undefined =
    activeTab !== 'master' ? platform_variants.find((v) => v.platform === activeTab) : undefined;

  const currentTitle = activeVariant ? activeVariant.title : master_script.title;
  const currentSections = activeVariant ? activeVariant.sections : master_script.sections;
  const currentDuration = activeVariant ? activeVariant.estimated_duration_seconds : master_script.estimated_duration_seconds;
  const targetDuration = activeVariant ? activeVariant.target_duration_seconds : master_script.target_duration_seconds;
  const currentWordCount = activeVariant ? activeVariant.word_count : master_script.word_count;
  const currentHook = activeVariant ? activeVariant.hook : master_script.hook;
  const currentCta = activeVariant ? activeVariant.cta : master_script.cta;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSectionBadge = (type: string) => {
    switch (type) {
      case 'hook':
        return 'bg-amber-950/70 text-amber-300 border-amber-800';
      case 'problem':
        return 'bg-red-950/70 text-red-300 border-red-800';
      case 'evidence':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800';
      case 'counter_argument':
        return 'bg-purple-950/70 text-purple-300 border-purple-800';
      case 'cta':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const handleCopy = () => {
    const text = currentSections.map((s) => s.spoken_text).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-amber-500/40 p-5 sm:p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800">
              ✍️ Script Agent Package
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
              ~{currentDuration}s (Target: {targetDuration}s)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
              {currentWordCount} words
            </span>
            {is_mock_data ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700">
                [Dev Mock Sourcing]
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                🌐 Real Research Sourced
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            {currentTitle}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onGenerateProduction && (
            <button
              type="button"
              onClick={() => onGenerateProduction(activeTab === 'master' ? 'instagram' : activeTab)}
              disabled={isGeneratingProduction}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
              title="Plan media & visual production blueprint"
            >
              {isGeneratingProduction ? (
                <>
                  <Icons.Spinner className="w-3.5 h-3.5 animate-spin" />
                  Planning Production...
                </>
              ) : (
                <>
                  🎬 Plan Production
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy script narration"
          >
            {copied ? '✓ Copied' : 'Copy Text'}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close script package"
            >
              <Icons.XClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Platform Variant Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'master'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <span>Master Script</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
            {master_script.sections.length} sec
          </span>
        </button>

        {platform_variants.map((variant) => (
          <button
            key={variant.platform}
            type="button"
            onClick={() => setActiveTab(variant.platform)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 capitalize ${
              activeTab === variant.platform
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <span>{variant.platform}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
              ~{variant.estimated_duration_seconds}s
            </span>
          </button>
        ))}
      </div>

      {/* Hook Banner */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs space-y-1">
        <div className="font-mono text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Primary Opening Hook (0:00 - 0:05)
        </div>
        <p className="text-amber-200/90 text-sm font-medium italic leading-relaxed">
          &ldquo;{currentHook}&rdquo;
        </p>
      </div>

      {/* Script Sections Timeline */}
      <div className="space-y-4">
        <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center justify-between">
          <span>Script Breakdown & Production Directions ({currentSections.length} sections)</span>
          <span className="text-[11px] text-zinc-500 font-normal">
            Sequenced timeline (150 WPM pacing)
          </span>
        </h4>

        <div className="space-y-3">
          {currentSections.map((sec: ScriptSection) => (
            <div
              key={sec.order}
              className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors space-y-3 text-xs"
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">#{sec.order}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${getSectionBadge(
                      sec.type
                    )}`}
                  >
                    {sec.type}
                  </span>
                  {sec.on_screen_text && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-cyan-300 border border-zinc-700">
                      Overlay: &ldquo;{sec.on_screen_text}&rdquo;
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-zinc-400 bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800">
                  {formatSeconds(sec.start_second)} &rarr; {formatSeconds(sec.end_second)}
                </div>
              </div>

              {/* Spoken Text */}
              <div className="text-zinc-100 text-sm leading-relaxed pl-2 border-l-2 border-amber-500/60">
                {sec.spoken_text}
              </div>

              {/* Visual Direction & B-Roll */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-900 text-[11px]">
                <div className="space-y-1 text-zinc-400">
                  <span className="font-mono text-[10px] text-zinc-500 uppercase">🎬 Visual Direction:</span>
                  <p className="text-zinc-300">{sec.visual_direction}</p>
                </div>
                {sec.b_roll_suggestions && sec.b_roll_suggestions.length > 0 && (
                  <div className="space-y-1 text-zinc-400">
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">🎥 B-Roll Suggestions:</span>
                    <ul className="list-disc list-inside text-zinc-400 space-y-0.5">
                      {sec.b_roll_suggestions.map((b, bi) => (
                        <li key={bi} className="truncate">{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Source References if attached */}
              {sec.source_references && sec.source_references.length > 0 && (
                <div className="pt-2 border-t border-zinc-900/80 space-y-1.5">
                  <span className="font-mono text-[10px] text-emerald-400 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Verified Evidence Citation:
                  </span>
                  {sec.source_references.map((ref, ri) => (
                    <div
                      key={ri}
                      className="p-2 rounded bg-emerald-950/20 border border-emerald-900/40 text-[11px] flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-emerald-300 font-medium">{ref.claim}</span>
                      {ref.source_url ? (
                        <a
                          href={ref.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[10px] inline-flex items-center gap-1"
                        >
                          <span>{ref.source_title}</span>
                          <span>↗</span>
                        </a>
                      ) : (
                        <span className="text-zinc-500 font-mono text-[10px]">{ref.source_title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action Footer */}
      <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
        <div className="font-mono text-[10px] uppercase text-cyan-400 font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Call To Action (Outro)
        </div>
        <p className="text-cyan-200/90 text-sm font-medium leading-relaxed">
          {currentCta}
        </p>
      </div>

      {/* Unsupported Claims or Gaps */}
      {unsupported_claims && unsupported_claims.length > 0 && (
        <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800 text-xs space-y-1.5">
          <h4 className="font-mono text-[11px] text-zinc-500 uppercase font-semibold">
            Unsupported Claims / Nuances Flagged ({unsupported_claims.length})
          </h4>
          <ul className="space-y-1 text-[11px] text-zinc-400">
            {unsupported_claims.map((uc, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-500 font-mono">!</span>
                <span>{uc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Consistency Notes */}
      {consistency_notes && (
        <div className="text-[11px] text-zinc-500 italic">
          <strong>Narrative Review:</strong> {consistency_notes}
        </div>
      )}

      {/* Footer System Info */}
      <div className="pt-3 border-t border-zinc-800/40 flex flex-wrap items-center justify-between text-[10px] font-mono text-zinc-500">
        <div>
          Target Project: <span className="text-zinc-400">{projectId}</span>
        </div>
        {jobId && (
          <div>
            Pipeline Job: <span className="text-zinc-400">{jobId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
