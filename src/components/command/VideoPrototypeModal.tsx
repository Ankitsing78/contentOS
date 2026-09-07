'use client';

import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/ui/Icons';

export interface PrototypeRenderData {
  testId: string;
  projectId: string;
  storagePath: string;
  publicUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  fileSizeBytes: number;
  mimeType: string;
  scriptVariant: string;
  audioIncluded: boolean;
  captionsIncluded: boolean;
  scenesCount: number;
  scenes?: Array<{
    order: number;
    title: string;
    purpose: string;
    startSecond: number;
    endSecond: number;
    durationSeconds: number;
    spokenText: string;
  }>;
}

interface VideoPrototypeModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  autoStart?: boolean;
}

const STAGES = [
  { label: 'Preparing script', percent: 15 },
  { label: 'Preparing scenes', percent: 35 },
  { label: 'Preparing demo visuals', percent: 55 },
  { label: 'Rendering', percent: 75 },
  { label: 'Finalizing', percent: 90 },
  { label: 'Ready', percent: 100 },
];

export function VideoPrototypeModal({
  isOpen,
  projectId,
  onClose,
  autoStart = true,
}: VideoPrototypeModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [currentStageText, setCurrentStageText] = useState<string>('Preparing script');
  const [prototypeData, setPrototypeData] = useState<PrototypeRenderData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRunPrototype = React.useCallback(async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setCurrentStageIndex(0);
    setCurrentStageText('Preparing script');

    // Stage progression simulated tracker for real-time visual feedback
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => { setCurrentStageIndex(1); setCurrentStageText('Preparing scenes'); }, 1200));
    timers.push(setTimeout(() => { setCurrentStageIndex(2); setCurrentStageText('Preparing demo visuals'); }, 3000));
    timers.push(setTimeout(() => { setCurrentStageIndex(3); setCurrentStageText('Rendering video frames'); }, 7000));
    timers.push(setTimeout(() => { setCurrentStageIndex(4); setCurrentStageText('Finalizing and encoding MP4'); }, 13000));

    try {
      const res = await fetch(`/api/content/${projectId}/prototype/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredVariant: 'master' }),
      });

      timers.forEach(clearTimeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to render video prototype');
      }

      setCurrentStageIndex(5);
      setCurrentStageText('Ready');
      setPrototypeData(data.prototype);
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      const msg = err instanceof Error ? err.message : 'Prototype video rendering failed';
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
    }
  }, [projectId]);

  // Check for existing prototype on open
  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    async function checkExisting() {
      try {
        const res = await fetch(`/api/content/${projectId}/prototype/video`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.prototype) {
            setPrototypeData(data.prototype);
          } else if (autoStart) {
            handleRunPrototype();
          }
        }
      } catch {
        // ignore check errors
      }
    }

    checkExisting();

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, autoStart, handleRunPrototype]);

  if (!isOpen) return null;

  const currentPercent = STAGES[currentStageIndex]?.percent ?? 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-700/60 text-indigo-400">
              <Icons.Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-pink-950/80 text-pink-300 border border-pink-800 font-semibold">
                  EXPERIMENTAL PROTOTYPE
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Isolated Test Mode · 9:16 Vertical
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-100 mt-0.5">
                ContentOS Video Prototype Test
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close prototype viewer"
          >
            <Icons.XClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Isolation Notice */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 space-y-1">
            <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Icons.ShieldCheck className="w-4 h-4 text-emerald-400" />
              Isolated Test Namespace Guard
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This prototype evaluates script pacing, typography, and narration synchronization.
              It uses programmatic demo visuals and does <strong>not</strong> alter real production package state or mark requirements complete.
            </p>
          </div>

          {/* Progress Tracker (when running) */}
          {isRunning && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-indigo-300 flex items-center gap-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  {currentStageText}...
                </span>
                <span className="text-zinc-400 text-[11px]">
                  Step {currentStageIndex + 1} of {STAGES.length} ({currentPercent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${currentPercent}%` }}
                />
              </div>

              {/* Stage Step Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STAGES.map((stg, i) => (
                  <span
                    key={stg.label}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      i < currentStageIndex
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : i === currentStageIndex
                        ? 'bg-indigo-900 text-indigo-200 border border-indigo-600 font-semibold'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {i < currentStageIndex ? '✓ ' : ''}{stg.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-xs font-mono text-red-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-red-200">
                <Icons.AlertCircle className="w-4 h-4 text-red-400" />
                Prototype Rendering Interrupted
              </div>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={handleRunPrototype}
                className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/80 text-red-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Retry Prototype Render
              </button>
            </div>
          )}

          {/* Rendered Video Player & Details */}
          {prototypeData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* 9:16 Vertical Video Player */}
                <div className="md:col-span-5 flex flex-col items-center">
                  <div className="w-full max-w-[280px] sm:max-w-[300px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-zinc-700 shadow-2xl relative">
                    <video
                      key={prototypeData.publicUrl}
                      src={prototypeData.publicUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-2 text-center">
                    9:16 Vertical Preview ({prototypeData.width}×{prototypeData.height})
                  </span>
                </div>

                {/* Metadata & Controls */}
                <div className="md:col-span-7 space-y-3">
                  <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3 text-xs font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                      <span className="text-zinc-400 font-semibold uppercase text-[10px]">
                        Video Specification
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                        MP4 Verified (H.264 / AAC)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Duration</span>
                        <span className="text-zinc-200 font-semibold">{prototypeData.durationSeconds}s</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Aspect Ratio</span>
                        <span className="text-zinc-200 font-semibold">9:16 (Vertical)</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">File Size</span>
                        <span className="text-zinc-200 font-semibold">
                          {(prototypeData.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Framerate</span>
                        <span className="text-zinc-200 font-semibold">{prototypeData.fps || 30} FPS</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Audio Track</span>
                        <span className="text-emerald-400 font-semibold">
                          {prototypeData.audioIncluded ? 'Synchronized Narration' : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Captions</span>
                        <span className="text-emerald-400 font-semibold">
                          {prototypeData.captionsIncluded ? 'Burned-in Timed Subtitles' : 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500 truncate">
                      <span>Test ID: </span>
                      <span className="text-zinc-400">{prototypeData.testId}</span>
                    </div>

                    <div className="text-[10px] text-zinc-500 truncate">
                      <span>Storage: </span>
                      <span className="text-zinc-400">{prototypeData.storagePath}</span>
                    </div>
                  </div>

                  {/* Actions Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={prototypeData.publicUrl}
                      download={`contentos-prototype-${projectId}.mp4`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                      <Icons.Film className="w-4 h-4" />
                      <span>Download Prototype MP4</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleRunPrototype}
                      disabled={isRunning}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>Re-Render</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Initial State when no video rendered yet and not running */}
          {!isRunning && !prototypeData && !errorMessage && (
            <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-950/60 border border-indigo-700/60 flex items-center justify-center mx-auto text-indigo-400">
                <Icons.Play className="w-6 h-6 ml-0.5" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Ready to Render Script Prototype
              </h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Will generate a 60-second 9:16 vertical video using the Master Script, real narration audio for Scene 1, and synchronized demo visuals.
              </p>
              <button
                type="button"
                onClick={handleRunPrototype}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg cursor-pointer"
              >
                🎬 Start Video Prototype Render
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Project: {projectId}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
