import React, { useState, useEffect, useCallback } from 'react';
import { ProductionPackage } from '@/types/production';
import { Icons } from '@/components/ui/Icons';
import { VideoPrototypeModal } from './VideoPrototypeModal';

interface ProductionPackagePanelProps {
  pkg: ProductionPackage;
  projectId: string;
  jobId?: string;
  onDismiss?: () => void;
  onRunPrototype?: () => void;
}

export function ProductionPackagePanel({
  pkg,
  projectId,
  jobId,
  onDismiss,
  onRunPrototype,
}: ProductionPackagePanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'audio' | 'checklist' | 'specs' | 'render'>('timeline');
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [showPrototypeModal, setShowPrototypeModal] = useState(false);

  const [generatedVisuals] = useState<
    Record<
      string,
      {
        id: string;
        storagePath: string;
        width: number;
        height: number;
        aspectRatio: string;
        provider: string;
        model: string;
        fileSize?: number;
        createdAt?: string;
      }
    >
  >({});
  const [visualPreviews, setVisualPreviews] = useState<Record<string, string>>({});
  const [visualError] = useState<string | null>(null);

  // Video Composition & Rendering State
  interface RenderReadinessState {
    canRender: boolean;
    totalScenes: number;
    totalDuration: number;
    missingVisualCount: number;
    missingAudioCount: number;
    missingRequirements: Array<{
      sceneNumber: number;
      type: 'visual' | 'audio';
      requirementId: string;
      description: string;
      detail: string;
    }>;
    existingVideoAsset?: {
      id: string;
      storagePath: string;
      durationSeconds?: number;
      fileSizeBytes?: number;
      mimeType?: string;
      width?: number;
      height?: number;
    } | null;
  }

  const [renderStatus, setRenderStatus] = useState<RenderReadinessState | null>(null);
  const [checkingRenderStatus, setCheckingRenderStatus] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderStep, setRenderStep] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<{
    id: string;
    storagePath: string;
    durationSeconds: number;
    fileSizeBytes: number;
    width: number;
    height: number;
    fps: number;
  } | null>(null);

  const fetchRenderStatus = useCallback(async () => {
    setCheckingRenderStatus(true);
    try {
      const res = await fetch(`/api/content/${projectId}/production/render/status`);
      if (res.ok) {
        const data = await res.json();
        setRenderStatus(data);
        if (data.existingVideoAsset) {
          setRenderedVideo({
            id: data.existingVideoAsset.id,
            storagePath: data.existingVideoAsset.storagePath,
            durationSeconds: data.existingVideoAsset.durationSeconds || pkg.duration_seconds,
            fileSizeBytes: data.existingVideoAsset.fileSizeBytes || 0,
            width: data.existingVideoAsset.width || 1080,
            height: data.existingVideoAsset.height || 1920,
            fps: 30,
          });
        }
      }
    } catch {
      // ignore network errors
    } finally {
      setCheckingRenderStatus(false);
    }
  }, [projectId, pkg.duration_seconds]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialStatus() {
      try {
        const res = await fetch(`/api/content/${projectId}/production/render/status`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRenderStatus(data);
          if (data.existingVideoAsset) {
            setRenderedVideo({
              id: data.existingVideoAsset.id,
              storagePath: data.existingVideoAsset.storagePath,
              durationSeconds: data.existingVideoAsset.durationSeconds || pkg.duration_seconds,
              fileSizeBytes: data.existingVideoAsset.fileSizeBytes || 0,
              width: data.existingVideoAsset.width || 1080,
              height: data.existingVideoAsset.height || 1920,
              fps: 30,
            });
          }
        }
      } catch {
        // ignore
      }
    }
    loadInitialStatus();
    return () => {
      cancelled = true;
    };
  }, [projectId, pkg.duration_seconds]);

  const handleTriggerRender = async () => {
    setIsRendering(true);
    setRenderError(null);
    setRenderStep('Checking asset readiness & scene boundaries...');

    try {
      setTimeout(() => {
        setRenderStep('Downloading verified audio & visual assets...');
      }, 700);
      setTimeout(() => {
        setRenderStep('Composing timeline & synchronizing captions...');
      }, 1500);
      setTimeout(() => {
        setRenderStep('Uploading compiled video to storage...');
      }, 2300);

      const res = await fetch(`/api/content/${projectId}/production/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data.readiness) {
          setRenderStatus(data.readiness);
        }
        throw new Error(data.error || 'Video rendering failed');
      }

      setRenderedVideo({
        id: data.videoAssetId,
        storagePath: data.storagePath,
        durationSeconds: data.durationSeconds,
        fileSizeBytes: data.fileSizeBytes,
        width: data.width,
        height: data.height,
        fps: data.fps,
      });
      setRenderStep('Video composition completed successfully');
      fetchRenderStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video rendering failed';
      setRenderError(msg);
      setRenderStep('Composition halted: Pending requirements');
    } finally {
      setIsRendering(false);
    }
  };

  const fetchVisualPreview = async (visualReqId: string) => {
    if (visualPreviews[visualReqId]) return;
    try {
      const res = await fetch(`/api/content/${projectId}/production/visuals/${visualReqId}/preview`);
      if (res.ok) {
        const data = await res.json();
        if (data.signedUrl) {
          setVisualPreviews((prev) => ({ ...prev, [visualReqId]: data.signedUrl }));
        }
      }
    } catch {
      // preview error ignored
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const currentScene = pkg.scenes[selectedSceneIndex] || pkg.scenes[0];

  const getVisualTypeBadge = (type: string) => {
    switch (type) {
      case 'talking_head':
        return 'bg-purple-950/70 text-purple-300 border-purple-800';
      case 'b_roll':
        return 'bg-blue-950/70 text-blue-300 border-blue-800';
      case 'code_visual':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800';
      case 'chart':
      case 'diagram':
        return 'bg-amber-950/70 text-amber-300 border-amber-800';
      case 'screen_recording':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-indigo-500/40 p-5 sm:p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center gap-1">
              🎬 Production & Media Blueprint
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
              {pkg.platform.toUpperCase()} ({pkg.aspect_ratio})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
              {pkg.scenes.length} Scenes · ~{pkg.duration_seconds}s
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Planning Spec (Assets Pending)
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Production Specification — {pkg.platform.toUpperCase()} {pkg.format}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (onRunPrototype ? onRunPrototype() : setShowPrototypeModal(true))}
            className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer"
            title="Run isolated 9:16 vertical video prototype test"
          >
            <Icons.Film className="w-3.5 h-3.5" />
            <span>Run Video Prototype</span>
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Dismiss panel"
            >
              <Icons.XClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🎬 Scene Timeline ({pkg.scenes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🎵 Audio & Voiceover ({pkg.audio_assets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📋 Asset Checklist ({pkg.asset_checklist.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'specs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ⚙️ Specs & Notes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('render')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'render'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icons.Film className="w-3.5 h-3.5" />
            🎞️ Video Composition
            {renderStatus && !renderStatus.canRender && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5 animate-pulse" title="Assets pending" />
            )}
            {renderedVideo && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" title="Render ready" />
            )}
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-500">
          Aspect Ratio: <span className="text-zinc-300 font-semibold">{pkg.aspect_ratio}</span>
        </div>
      </div>

      {/* Tab Content: Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Scene Selector Strip */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {pkg.scenes.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setSelectedSceneIndex(idx)}
                className={`px-3 py-2 rounded-xl border text-left flex-shrink-0 transition-all cursor-pointer ${
                  selectedSceneIndex === idx
                    ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                    : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800/60'
                }`}
              >
                <div className="text-[10px] font-mono uppercase text-zinc-500">
                  Scene #{scene.order}
                </div>
                <div className="text-xs font-semibold truncate max-w-[120px]">
                  {scene.purpose}
                </div>
                <div className="text-[10px] font-mono text-indigo-400">
                  {formatSeconds(scene.start_second)} - {formatSeconds(scene.end_second)}
                </div>
              </button>
            ))}
          </div>

          {/* Active Scene Detail View */}
          {currentScene && (
            <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-5">
              {/* Scene Title & Timing Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                    SCENE #{currentScene.order}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase border ${getVisualTypeBadge(currentScene.visual_type)}`}>
                    {currentScene.visual_type.replace('_', ' ')}
                  </span>
                  <h4 className="text-sm font-semibold text-zinc-200">
                    {currentScene.purpose}
                  </h4>
                </div>
                <div className="font-mono text-xs text-zinc-400">
                  ⏱️ {formatSeconds(currentScene.start_second)} → {formatSeconds(currentScene.end_second)} ({currentScene.duration_seconds}s)
                </div>
              </div>

              {/* Spoken Dialogue (Authoritative Script Quote) */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1.5">
                    <Icons.Play className="w-3 h-3 text-amber-400" />
                    Authoritative Spoken Script (Narration)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">Verbatim</span>
                </div>
                <p className="text-zinc-100 text-sm sm:text-base leading-relaxed font-sans font-medium">
                  &ldquo;{currentScene.spoken_text}&rdquo;
                </p>
              </div>

              {/* Visual Asset Requirement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const sceneVisualReq =
                    currentScene.visual_assets?.[0] ||
                    pkg.visual_assets?.find((v) => v.scene_id === currentScene.id);
                  const visualReqId = sceneVisualReq?.id || `vis-${currentScene.id}`;
                  const isCompleted =
                    sceneVisualReq?.status === 'completed' || !!generatedVisuals[visualReqId];
                  const visualData = generatedVisuals[visualReqId];

                  return (
                    <div
                      className={`p-4 rounded-xl border space-y-3 transition-all ${
                        isCompleted
                          ? 'bg-emerald-950/20 border-emerald-800/60 shadow-sm'
                          : 'bg-indigo-950/20 border-indigo-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-indigo-300 font-semibold flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCompleted ? 'bg-emerald-400' : 'bg-indigo-400'
                            }`}
                          />
                          Visual Asset Specification
                        </span>
                        {isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded text-[9px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            REAL GENERATED VISUAL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800">
                            Status: Pending Generation
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-zinc-400">Prompt: </span>
                          <span className="text-zinc-200 font-mono text-[11px] leading-relaxed block mt-1 p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
                            {currentScene.visual_prompt}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          <strong>B-roll Requirement:</strong> {currentScene.b_roll_requirement}
                        </div>
                      </div>

                      {/* Completed Visual Card */}
                      {isCompleted && (
                        <div className="p-3 rounded-lg bg-zinc-900/80 border border-emerald-800/40 text-[11px] font-mono text-zinc-300 space-y-2">
                          <div className="text-emerald-400 font-bold tracking-wide text-[10px] flex items-center justify-between">
                            <span>🎨 VISUAL ASSET RECORD</span>
                            <span className="text-[9px] font-normal text-zinc-400">Private Bucket (content-assets)</span>
                          </div>

                          {/* Signed URL Preview Image */}
                          {sceneVisualReq && (
                            <div>
                              {visualPreviews[sceneVisualReq.id] ? (
                                <div className="relative rounded overflow-hidden border border-zinc-700/60 bg-black/40 my-2 max-w-[200px] aspect-[9/16]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={visualPreviews[sceneVisualReq.id]}
                                    alt="Generated visual asset"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fetchVisualPreview(sceneVisualReq.id)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer py-1"
                                >
                                  Load Secure Preview
                                </button>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px] border-t border-zinc-800/60">
                            <div>Provider: <span className="text-zinc-100">{visualData?.provider ? visualData.provider.toUpperCase() : 'GEMINI'}</span></div>
                            <div>Model: <span className="text-zinc-100">{visualData?.model || 'gemini-3.1-flash-image'}</span></div>
                            <div>Dimensions: <span className="text-zinc-100">{visualData?.width || 1080} × {visualData?.height || 1920}</span></div>
                            <div>Aspect Ratio: <span className="text-zinc-100">{visualData?.aspectRatio || pkg.aspect_ratio}</span></div>
                            {visualData?.fileSize && (
                              <div>File Size: <span className="text-zinc-100">{(visualData.fileSize / 1024).toFixed(1)} KB</span></div>
                            )}
                            <div>Status: <span className="text-emerald-300">completed</span></div>
                          </div>

                          {(visualData?.storagePath || sceneVisualReq?.storage_path) && (
                            <div className="text-zinc-500 truncate text-[9px] pt-1 border-t border-zinc-800/40">
                              Path: {visualData?.storagePath || sceneVisualReq?.storage_path}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Visual Generation Status: PAUSED / ON HOLD */}
                      {!isCompleted && (
                        <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                          <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                Visual Generation Paused
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-amber-900/60 text-amber-200 border border-amber-700">
                                ON HOLD
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                              Automated visual generation is paused. Production requirement remains pending. Use <strong>Run Video Prototype</strong> to test the script with programmatic demo visuals.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              disabled={true}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-zinc-800/80 text-zinc-500 border border-zinc-700/60 cursor-not-allowed flex items-center gap-1.5"
                              title="Automated visual generation is currently paused per system policy."
                            >
                              <span>⏸️ Generation Paused</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => (onRunPrototype ? onRunPrototype() : setShowPrototypeModal(true))}
                              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-pink-600 hover:bg-pink-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Icons.Film className="w-3.5 h-3.5" />
                              <span>Test In Prototype</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {visualError && (
                        <div className="text-[11px] font-mono text-rose-400 p-2 rounded bg-rose-950/40 border border-rose-800">
                          {visualError}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Camera & Composition Direction */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2 text-xs">
                  <span className="font-mono text-[10px] uppercase text-cyan-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Camera & Composition
                  </span>
                  <div className="space-y-1.5 text-[11px] text-zinc-300">
                    <div>
                      <span className="text-zinc-500">Camera Framing:</span> {currentScene.camera_direction}
                    </div>
                    <div>
                      <span className="text-zinc-500">Safe-Zone Composition:</span> {currentScene.composition}
                    </div>
                    {currentScene.on_screen_text && (
                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-amber-400 font-mono text-[10px] uppercase block mb-0.5">On-Screen Graphic Callout:</span>
                        <span className="px-2 py-1 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 font-mono text-xs inline-block">
                          {currentScene.on_screen_text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Synchronized Subtitle / Caption Blocks */}
              {currentScene.captions && currentScene.captions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
                      Timed Caption Blocks ({currentScene.captions.length})
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Synchronized to dialogue
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {currentScene.captions.map((cap) => (
                      <div
                        key={cap.id}
                        className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>{formatSeconds(cap.start_second)}s</span>
                          <span>{formatSeconds(cap.end_second)}s</span>
                        </div>
                        <p className="text-zinc-200 font-medium leading-snug">
                          {cap.text}
                        </p>
                        {cap.emphasis_words && cap.emphasis_words.length > 0 && (
                          <div className="text-[9px] font-mono text-indigo-400">
                            Emphasis: {cap.emphasis_words.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Audio */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          {(() => {
            const voiceoverReqs = pkg.audio_assets.filter((a) => a.audio_type === 'voiceover');
            const completedVoice = voiceoverReqs.filter((a) => a.status === 'completed');
            return (
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase text-purple-400 font-semibold block mb-1">
                    🎙️ Voice Generation & Narration
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Voiceover generated using <span className="text-indigo-300 font-medium">Gemini TTS</span> (<code className="text-zinc-400">gemini-3.1-flash-tts-preview</code>).
                    Stored in private bucket <code className="text-zinc-400">content-assets</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 border border-zinc-700 text-zinc-300">
                    Voiceover: <strong className="text-indigo-400">{completedVoice.length}</strong> / {voiceoverReqs.length} Generated
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-900 border border-zinc-700 text-zinc-400">
                    Total Audio: {pkg.audio_assets.length}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 gap-3">
            {pkg.audio_assets.map((audio) => {
              const isVoice = audio.audio_type === 'voiceover';
              const isCompleted = audio.status === 'completed';

              return (
                <div
                  key={audio.id}
                  className={`p-4 rounded-xl border flex flex-wrap items-start justify-between gap-3 text-xs transition-all ${
                    isCompleted
                      ? 'bg-emerald-950/20 border-emerald-800/60 shadow-sm'
                      : 'bg-zinc-950/40 border-zinc-800/80'
                  }`}
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                          isVoice
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {audio.audio_type.replace('_', ' ')}
                      </span>
                      <h5 className="font-semibold text-zinc-200">
                        {audio.description}
                      </h5>
                    </div>
                    {audio.text && (
                      <p className="text-zinc-400 italic text-[11px] font-mono">
                        Narration: &ldquo;{audio.text}&rdquo;
                      </p>
                    )}
                    {audio.notes && (
                      <p className="text-zinc-500 text-[11px]">
                        Direction: {audio.notes}
                      </p>
                    )}

                    {isCompleted && (
                      <div className="mt-2 p-2.5 rounded-lg bg-zinc-900/80 border border-emerald-800/40 text-[11px] font-mono text-zinc-300 space-y-0.5">
                        <div className="text-emerald-400 font-bold tracking-wide text-[10px]">
                          VOICE GENERATED
                        </div>
                        <div>Provider: <span className="text-zinc-100">Gemini TTS</span></div>
                        <div>Model: <span className="text-zinc-100">gemini-3.1-flash-tts-preview</span></div>
                        <div>Status: <span className="text-emerald-300">completed</span></div>
                        <div>Storage: <span className="text-zinc-400">Private Bucket (content-assets)</span></div>
                        {audio.storage_path && (
                          <div className="text-zinc-500 truncate text-[10px]">Path: {audio.storage_path}</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-zinc-400">
                      ⏱️ ~{audio.duration_seconds}s
                    </span>
                    {isCompleted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/80 text-amber-300 border border-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: Checklist */}
      {activeTab === 'checklist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Total deliverables required for assembly: <strong className="text-zinc-200">{pkg.asset_checklist.length} items</strong>
            </span>
            <span className="font-mono text-[11px] text-amber-400">
              0 / {pkg.asset_checklist.length} Completed (Planning Specification)
            </span>
          </div>

          <div className="divide-y divide-zinc-800/60 rounded-xl bg-zinc-950/40 border border-zinc-800/80 overflow-hidden">
            {pkg.asset_checklist.map((item) => (
              <div
                key={item.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-zinc-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-500">
                    ○
                  </div>
                  <div>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase mr-2 bg-zinc-800 text-zinc-300">
                      {item.category}
                    </span>
                    <span className="text-zinc-200 font-medium">
                      {item.requirement}
                    </span>
                    {item.notes && (
                      <p className="text-zinc-500 text-[10px] font-mono truncate max-w-lg mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Specs */}
      {activeTab === 'specs' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-3">
            <h4 className="font-mono text-[11px] uppercase text-zinc-400 font-semibold">
              Platform & Technical Parameters
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px]">
              <div>
                <span className="text-zinc-500 block">Platform</span>
                <span className="text-zinc-200 font-semibold">{pkg.platform.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Aspect Ratio</span>
                <span className="text-zinc-200 font-semibold">{pkg.aspect_ratio}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Estimated Duration</span>
                <span className="text-zinc-200 font-semibold">{pkg.duration_seconds}s</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Confidence</span>
                <span className="text-emerald-400 font-semibold uppercase">{pkg.confidence}</span>
              </div>
            </div>
          </div>

          {pkg.production_notes && pkg.production_notes.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-2">
              <h4 className="font-mono text-[11px] uppercase text-zinc-400 font-semibold">
                Production Notes & Guidelines
              </h4>
              <ul className="space-y-1 text-zinc-400 text-[11px]">
                {pkg.production_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-indigo-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Video Composition & Rendering Engine */}
      {activeTab === 'render' && (
        <div className="space-y-5 text-xs">
          {/* Header Card */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                    <Icons.Film className="w-4 h-4 text-indigo-400" />
                    Video Composition & Rendering Engine
                  </span>
                  {renderedVideo ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                      <Icons.CheckCircle2 className="w-3 h-3" />
                      Video Compiled
                    </span>
                  ) : renderStatus?.canRender ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700">
                      Ready to Render
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Blocked ({renderStatus?.missingRequirements.length ?? 'Pending'} Assets)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  Composes audio, visual elements, and synchronized captions into an MP4 video stream.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchRenderStatus}
                disabled={checkingRenderStatus}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Icons.RefreshCw className={`w-3 h-3 ${checkingRenderStatus ? 'animate-spin' : ''}`} />
                Check Readiness
              </button>
            </div>

            {/* Experimental Video Prototype Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-zinc-900 border border-pink-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <Icons.Film className="w-4 h-4 text-pink-400" />
                    Isolated Video Prototype Test Mode
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-pink-950 text-pink-300 border border-pink-800 font-semibold">
                    READY TO TEST
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed max-w-xl">
                  Test the script with real narration audio and programmatic 9:16 vertical demo visuals. Evaluates video quality, pacing, and captions without modifying production asset state.
                </p>
              </div>

              <button
                type="button"
                onClick={() => (onRunPrototype ? onRunPrototype() : setShowPrototypeModal(true))}
                className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-600/30 transition-all cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Icons.Play className="w-3.5 h-3.5" />
                <span>Run Video Prototype</span>
              </button>
            </div>

            {/* Strict Non-Placeholder Notice */}
            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/60 text-[11px] text-indigo-200/90 leading-relaxed space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-indigo-300">
                <Icons.AlertCircle className="w-3.5 h-3.5" />
                Strict Non-Placeholder Architecture
              </div>
              <p className="text-zinc-400">
                ContentOS mandates full asset fidelity. The renderer will fail explicitly if any visual requirement or audio narration is missing, refusing to substitute synthetic placeholders, blank canvases, or mock graphics.
              </p>
            </div>
          </div>

          {/* Readiness Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px] font-mono uppercase">Contiguous Scenes</span>
              <span className="text-zinc-200 font-mono text-sm font-semibold">
                {pkg.scenes.length} Scenes ({pkg.duration_seconds}s)
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px] font-mono uppercase">Visual Assets</span>
              <span className={`font-mono text-sm font-semibold ${
                (renderStatus?.missingVisualCount ?? 1) === 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {renderStatus ? `${pkg.scenes.length - renderStatus.missingVisualCount} / ${pkg.scenes.length}` : 'Evaluating...'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px] font-mono uppercase">Audio Narrations</span>
              <span className={`font-mono text-sm font-semibold ${
                (renderStatus?.missingAudioCount ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {renderStatus ? `${renderStatus.missingAudioCount === 0 ? 'Synchronized' : `${renderStatus.missingAudioCount} Missing`}` : 'Evaluating...'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px] font-mono uppercase">Timed Captions</span>
              <span className="text-emerald-400 font-mono text-sm font-semibold">
                {pkg.captions.length} Segments
              </span>
            </div>
          </div>

          {/* Missing Requirements Breakdown if Blocked */}
          {renderStatus && !renderStatus.canRender && renderStatus.missingRequirements.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                  <Icons.AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  Composition Blocked: {renderStatus.missingRequirements.length} Missing Requirements
                </h4>
                <span className="text-[10px] font-mono text-amber-400/80">
                  Must be generated before rendering
                </span>
              </div>

              <div className="divide-y divide-zinc-800/80 max-h-56 overflow-y-auto pr-1">
                {renderStatus.missingRequirements.map((req, i) => (
                  <div key={i} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-zinc-800 text-zinc-300">
                          Scene #{req.sceneNumber}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                          req.type === 'visual' ? 'bg-purple-950/70 text-purple-300 border border-purple-800' : 'bg-blue-950/70 text-blue-300 border border-blue-800'
                        }`}>
                          {req.type}
                        </span>
                        <span className="text-zinc-200 font-medium">{req.description}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] font-mono mt-0.5 pl-1">
                        {req.detail}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Render Error Banner */}
          {renderError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 space-y-1">
              <div className="font-semibold text-[11px] flex items-center gap-1.5">
                <Icons.AlertCircle className="w-3.5 h-3.5" />
                Render Engine Exception
              </div>
              <p className="text-[10px] font-mono text-red-400">{renderError}</p>
            </div>
          )}

          {/* Render Action & Progress */}
          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-zinc-200 font-semibold block text-sm">
                  Render Video Output
                </span>
                <span className="text-zinc-500 text-[11px] font-mono">
                  Target Format: MP4 ({pkg.aspect_ratio}, 1080x1920, 30fps)
                </span>
              </div>

              <button
                type="button"
                onClick={handleTriggerRender}
                disabled={isRendering}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-all cursor-pointer ${
                  isRendering
                    ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    : renderStatus?.canRender
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                {isRendering ? (
                  <>
                    <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <Icons.Play className="w-3.5 h-3.5" />
                    <span>{renderedVideo ? 'Re-compose Video' : 'Compose & Render Video'}</span>
                  </>
                )}
              </button>
            </div>

            {/* In-Flight Step Tracker */}
            {isRendering && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    {renderStep}
                  </span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 animate-pulse rounded-full w-3/4" />
                </div>
              </div>
            )}

            {/* Rendered Video Details Card */}
            {renderedVideo && !isRendering && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Icons.CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Compiled Video Master
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700">
                    MP4 Container Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[9px]">Asset ID</span>
                    <span className="text-zinc-300 truncate block max-w-[140px]" title={renderedVideo.id}>
                      {renderedVideo.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">Storage Path</span>
                    <span className="text-zinc-300 truncate block max-w-[140px]" title={renderedVideo.storagePath}>
                      {renderedVideo.storagePath}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">Duration</span>
                    <span className="text-zinc-300">
                      {renderedVideo.durationSeconds}s
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">File Size</span>
                    <span className="text-zinc-300">
                      {Math.round(renderedVideo.fileSizeBytes / 1024)} KB
                    </span>
                  </div>
                </div>
              </div>
            )}
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

      {/* Video Prototype Viewer Modal */}
      <VideoPrototypeModal
        isOpen={showPrototypeModal}
        projectId={projectId}
        onClose={() => setShowPrototypeModal(false)}
      />
    </div>
  );
}
