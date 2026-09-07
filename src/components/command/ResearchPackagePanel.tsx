import React from 'react';
import { ResearchPackage } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface ResearchPackagePanelProps {
  pkg: ResearchPackage;
  projectId: string;
  jobId?: string;
  onDismiss?: () => void;
  onGenerateScript?: () => void;
  isGeneratingScript?: boolean;
}

export function ResearchPackagePanel({
  pkg,
  projectId,
  jobId,
  onDismiss,
  onGenerateScript,
  isGeneratingScript = false,
}: ResearchPackagePanelProps) {
  const { plan, sources, evidence, unresolved_questions, overall_confidence, isMockData } = pkg;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-950/60 text-red-400 border-red-800/80';
      case 'medium':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/80';
      case 'low':
      default:
        return 'bg-blue-950/60 text-blue-400 border-blue-800/80';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80';
      case 'medium':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/80';
      case 'low':
      default:
        return 'bg-zinc-900 text-zinc-400 border-zinc-700';
    }
  };

  const getCredibilityBadge = (credibility: string) => {
    switch (credibility) {
      case 'high':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
      case 'medium':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800';
      case 'low':
      default:
        return 'bg-zinc-900 text-zinc-400 border-zinc-700';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-cyan-500/40 p-5 sm:p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800">
              🔎 Research Agent Package
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${getPriorityBadge(
                plan.research_priority
              )}`}
            >
              Priority: {plan.research_priority}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${getConfidenceBadge(
                overall_confidence
              )}`}
            >
              Confidence: {overall_confidence}
            </span>
            {isMockData ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700">
                [Dev Mock Retriever]
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                🌐 Real Web Research (Tavily)
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Structured Research & Verification Package
          </h3>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close research package"
          >
            <Icons.XClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Retrieval Mode Banner */}
      {isMockData ? (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2.5">
          <Icons.AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <strong className="font-semibold text-amber-200">Development Retrieval Harness:</strong> Research planning was executed live by Gemini; evidence collection currently uses deterministic test fixtures without fabricated external citations.
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              <strong>Verified Live Retrieval:</strong> Gathered from external web sources via Tavily. Evidence synthesized and validated against live document excerpts.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-emerald-400 shrink-0">
            <span>Sources: <strong>{sources.length}</strong></span>
            <span>•</span>
            <span>Evidence Items: <strong>{evidence.length}</strong></span>
          </div>
        </div>
      )}

      {/* Grid: Research Questions & Claims to Verify */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Research Questions */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5">
          <h4 className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Core Research Questions ({plan.research_questions.length})
          </h4>
          <ul className="space-y-2">
            {plan.research_questions.map((q, i) => (
              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                <span className="text-cyan-500 font-mono text-[10px] shrink-0 mt-0.5">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Claims to Verify */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5">
          <h4 className="text-xs font-mono uppercase text-amber-400 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Claims Requiring Verification ({plan.claims_to_verify.length})
          </h4>
          {plan.claims_to_verify.length > 0 ? (
            <ul className="space-y-2">
              {plan.claims_to_verify.map((c, i) => (
                <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                  <span className="text-amber-500 font-mono text-[10px] shrink-0 mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 italic">No contentious claims flagged.</p>
          )}
        </div>
      </div>

      {/* Grid: Facts Needed & Source Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facts Needed */}
        <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/60 space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
            Required Statistical / Empirical Facts
          </h4>
          {plan.facts_needed.length > 0 ? (
            <ul className="space-y-1.5">
              {plan.facts_needed.map((f, i) => (
                <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                  <span className="text-zinc-600 font-mono text-[10px] shrink-0 mt-0.5">↳</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 italic">Standard domain knowledge sufficient.</p>
          )}
        </div>

        {/* Source Requirements & Freshness */}
        <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/60 space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
            Target Sources & Freshness Window
          </h4>
          <div className="space-y-1.5 text-xs text-zinc-400">
            {plan.freshness_requirements && (
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="font-mono text-[10px] text-cyan-400 uppercase">Freshness:</span>
                <span>{plan.freshness_requirements}</span>
              </div>
            )}
            {plan.source_requirements.length > 0 && (
              <ul className="space-y-1 pt-1">
                {plan.source_requirements.map((sr, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-zinc-400">
                    <span className="text-cyan-600 font-mono text-[10px] shrink-0 mt-0.5">#</span>
                    <span>{sr}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Sources & Evidence if available */}
      {sources.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-2">
              <span>Retrieved Evidence Sources</span>
              <span className="px-2 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                {sources.length}
              </span>
            </h4>
            {!isMockData && (
              <span className="text-[10px] font-mono text-zinc-500">
                Ranked & validated
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {sources.map((src, i) => {
              const formattedDate = formatDate(src.published_at);
              return (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-100 flex items-center gap-2">
                      <span>{src.title}</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {src.source_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${getCredibilityBadge(
                          src.credibility
                        )}`}
                      >
                        Credibility: {src.credibility}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {src.publisher}
                      </span>
                    </div>
                  </div>

                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {src.evidence_summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-900 text-[10px] font-mono text-zinc-500">
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 transition-colors"
                      >
                        <span>{src.url}</span>
                        <span className="text-zinc-600">↗</span>
                      </a>
                    ) : (
                      <span className="italic text-zinc-600">[Internal Test Fixture]</span>
                    )}
                    {formattedDate && (
                      <span className="text-zinc-400">Published: {formattedDate}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Verified Claims & Evidence */}
      {evidence.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-2">
            <span>Verified Claims & Supporting Excerpts</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
              {evidence.length}
            </span>
          </h4>
          <div className="space-y-2.5">
            {evidence.map((ev, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/90 text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {ev.claim}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${getConfidenceBadge(
                        ev.confidence
                      )}`}
                    >
                      {ev.confidence} confidence
                    </span>
                    <span className="font-mono text-zinc-400 text-[10px]">
                      Source: {ev.source}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 italic text-[11px] leading-relaxed">
                  &ldquo;{ev.supporting_excerpt}&rdquo;
                </div>

                {ev.notes && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    <span className="text-zinc-500">Note:</span> {ev.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unresolved Questions */}
      {unresolved_questions.length > 0 && (
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80 text-xs space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-amber-400/90 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unresolved Questions / Gaps for Downstream Scripting ({unresolved_questions.length})
          </h4>
          <ul className="space-y-1.5">
            {unresolved_questions.map((uq, i) => (
              <li key={i} className="text-[11px] text-zinc-400 flex items-start gap-2">
                <span className="text-amber-500/70 font-mono text-[10px] shrink-0 mt-0.5">?</span>
                <span>{uq}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Pipeline Stage Action */}
      {onGenerateScript && (
        <div className="pt-2">
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-zinc-900/60 border border-cyan-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-left w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  Next Step: Script Generation
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Step 7
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Transform verified evidence into a timestamped Master Script + platform variants (YouTube, Instagram, X).
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-xs bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGeneratingScript ? (
                <>
                  <Icons.Loading className="w-4 h-4 animate-spin" />
                  <span>Script Agent Generating...</span>
                </>
              ) : (
                <>
                  <span>✍️ Generate Production Scripts</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
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
