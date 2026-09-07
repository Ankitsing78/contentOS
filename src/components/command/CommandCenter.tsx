'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '@/components/ui/Icons';
import { QuickActions } from './QuickActions';
import { ContentBriefPanel } from './ContentBriefPanel';
import { ResearchPackagePanel } from './ResearchPackagePanel';
import { ScriptPackagePanel } from './ScriptPackagePanel';
import { ProductionPackagePanel } from './ProductionPackagePanel';
import { VideoPrototypeModal } from './VideoPrototypeModal';
import { QUICK_ACTION_PRESETS } from '@/lib/mock';
import { ContentIntakeResult, ResearchPackage, ScriptPackage } from '@/types';
import { ProductionPackage } from '@/types/production';

type SubmissionStage =
  | 'idle'
  | 'submitting'
  | 'understanding'
  | 'creating_plan'
  | 'completed'
  | 'error';

interface AttachedDoc {
  name: string;
  size: number;
  content: string;
}

export function CommandCenter() {
  const [commandInput, setCommandInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [stage, setStage] = useState<SubmissionStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Project & Packages State
  const defaultProjectId = '87c7b326-377e-4df0-8ce3-6287233fed32';
  const [currentProjectId, setCurrentProjectId] = useState<string>(defaultProjectId);
  const [projectTitle, setProjectTitle] = useState<string>('Why AI Will Elevate Good Developers, Not Replace Them');
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  const [activeBriefResult, setActiveBriefResult] = useState<ContentIntakeResult | null>(null);
  const [activeResearchPackage, setActiveResearchPackage] = useState<ResearchPackage | null>(null);
  const [activeScriptPackage, setActiveScriptPackage] = useState<ScriptPackage | null>(null);
  const [activeProductionPackage, setActiveProductionPackage] = useState<ProductionPackage | null>(null);

  const [isResearching, setIsResearching] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isPlanningProduction, setIsPlanningProduction] = useState(false);
  const [showPrototypeModal, setShowPrototypeModal] = useState(false);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // 1. Load project data from database
  const loadProjectData = useCallback(async (targetProjectId: string) => {
    setIsLoadingProject(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/content/${targetProjectId}`);
      if (!res.ok) {
        throw new Error(`Failed to load project: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.project) {
        setCurrentProjectId(data.project.id);
        setProjectTitle(data.project.title || 'Untitled Project');

        if (data.brief) {
          setActiveBriefResult({
            success: true,
            projectId: data.project.id,
            jobId: data.jobId,
            brief: data.brief,
            originalInput: data.project.original_input || '',
            createdAt: data.project.created_at,
          });
        }
        if (data.researchPackage) {
          setActiveResearchPackage(data.researchPackage as ResearchPackage);
        }
        if (data.scriptPackage) {
          setActiveScriptPackage(data.scriptPackage as ScriptPackage);
        }
        if (data.productionPackage) {
          setActiveProductionPackage(data.productionPackage as ProductionPackage);
        }
      }
    } catch (err: unknown) {
      console.warn('[CommandCenter] Notice loading project:', err);
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  // Auto-load default active project on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjectData(defaultProjectId);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProjectData, defaultProjectId]);

  // 2. Quick Actions Preset Selection
  const handleSelectQuickAction = (template: string) => {
    setCommandInput(template);
    setErrorMessage(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // 3. Live Speech Recognition (Microphone Action)
  const handleVoiceToggle = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      setVoiceNotice(null);
      return;
    }

    // Check browser SpeechRecognition support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice('Voice dictation requires Web Speech API support (Chrome, Edge, Safari). You can type or paste your idea.');
      setTimeout(() => setVoiceNotice(null), 5000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setCommandInput((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setVoiceNotice('Microphone access denied. Please allow microphone permissions to dictate.');
        } else if (event.error !== 'no-speech') {
          setVoiceNotice(`Speech recognition notice: ${event.error}. You can type directly.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setVoiceNotice('🎙️ Listening... Speak your content concept clearly.');
    } catch (err: unknown) {
      setIsRecording(false);
      setVoiceNotice(err instanceof Error ? err.message : 'Speech recognition could not be started.');
    }
  };

  // 4. File Attachment Handler
  const handleFileAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Attached file exceeds 2MB limit. Please attach smaller notes or documents.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setAttachedDoc({
        name: file.name,
        size: file.size,
        content,
      });
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read attached file content.');
    };
    reader.readAsText(file);
  };

  const handleRemoveAttachment = () => {
    setAttachedDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 5. Submit New Content Workflow
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = commandInput.trim();
    if (!trimmedInput || stage !== 'idle') return;

    // Stop voice recording if still active
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      setVoiceNotice(null);
    }

    setErrorMessage(null);
    setStage('submitting');

    const understandingTimer = setTimeout(() => {
      setStage('understanding');
    }, 600);

    const planTimer = setTimeout(() => {
      setStage('creating_plan');
    }, 1800);

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: trimmedInput,
          inputType: attachedDoc ? 'file' : isRecording ? 'audio' : 'text',
          userContext: attachedDoc ? `Attached Reference (${attachedDoc.name}):\n${attachedDoc.content.slice(0, 800)}` : undefined,
        }),
      });

      clearTimeout(understandingTimer);
      clearTimeout(planTimer);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStage('error');
        setErrorMessage(
          data.error || 'Failed to analyze content idea. Please check your configuration.'
        );
        return;
      }

      setStage('completed');
      setCurrentProjectId(data.projectId);
      setProjectTitle(data.brief?.title || trimmedInput);
      setActiveBriefResult(data as ContentIntakeResult);
      setActiveResearchPackage(null);
      setActiveScriptPackage(null);
      setActiveProductionPackage(null);
    } catch (err: unknown) {
      clearTimeout(understandingTimer);
      clearTimeout(planTimer);
      setStage('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Network communication error.'
      );
    }
  };

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 6. Pipeline Agents Actions
  const handleRunResearch = async (projectId: string) => {
    setIsResearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/content/${projectId}/research`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to execute Research Agent.');
        return;
      }
      setActiveResearchPackage(data.researchPackage as ResearchPackage);
      setActiveScriptPackage(null);
      setActiveProductionPackage(null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Network communication error during research.'
      );
    } finally {
      setIsResearching(false);
    }
  };

  const handleGenerateScript = async (
    projectId: string,
    options?: {
      platforms?: ('youtube' | 'instagram' | 'x')[];
      format?: 'short_video' | 'long_video' | 'post';
      duration_seconds?: number;
    }
  ) => {
    setIsGeneratingScript(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/content/${projectId}/script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          options || {
            platforms: ['instagram', 'youtube', 'x'],
            format: 'short_video',
            duration_seconds: 60,
          }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to execute Script Agent.');
        return;
      }
      setActiveScriptPackage(data.scriptPackage as ScriptPackage);
      setActiveProductionPackage(null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Network communication error during script generation.'
      );
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handlePlanProduction = async (
    projectId: string,
    platform: string = 'instagram'
  ) => {
    setIsPlanningProduction(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/content/${projectId}/production`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          format: 'short_video',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to execute Production Agent.');
        return;
      }
      setActiveProductionPackage(data.productionPackage as ProductionPackage);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Network communication error during production planning.'
      );
    } finally {
      setIsPlanningProduction(false);
    }
  };

  const getStageFeedback = () => {
    switch (stage) {
      case 'submitting':
        return 'Submitting idea to intake orchestrator...';
      case 'understanding':
        return 'Content Understanding Agent is analyzing thesis and angles...';
      case 'creating_plan':
        return 'Synthesizing structured content brief with Gemini...';
      default:
        return null;
    }
  };

  const isLoading = stage === 'submitting' || stage === 'understanding' || stage === 'creating_plan';

  return (
    <section className="w-full space-y-6" aria-label="Command Center">
      {/* Hidden File Input for Real Document Attachments */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".txt,.md,.json,.csv"
        className="hidden"
        aria-hidden="true"
      />

      {/* Active Project Status Strip */}
      <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 font-mono text-xs">
            🎬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Active Project
              </span>
              <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px] sm:max-w-[200px]" title={currentProjectId}>
                {currentProjectId}
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-zinc-200 truncate max-w-sm sm:max-w-md">
              {projectTitle}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Action: Run Video Prototype */}
          <button
            type="button"
            onClick={() => setShowPrototypeModal(true)}
            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer active:scale-98"
            title="Run isolated 9:16 video prototype test"
          >
            <Icons.Film className="w-3.5 h-3.5" />
            <span>Run Video Prototype</span>
          </button>

          {/* Reload Project Button */}
          <button
            type="button"
            onClick={() => loadProjectData(currentProjectId)}
            disabled={isLoadingProject}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
            title="Reload active project blueprint"
          >
            <Icons.RefreshCw className={`w-4 h-4 ${isLoadingProject ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Greetings & Subtitle */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            Autonomous Content Terminal
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
          Good evening
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 mt-1">
          What are we creating today?
        </p>
      </div>

      {/* Main Command Console Card */}
      <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl p-4 sm:p-5 transition-all focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/30">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Textarea Input with Keyboard shortcut */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="contentos-command-input"
              value={commandInput}
              disabled={isLoading}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell ContentOS what you want to create... (e.g., 'Create a 60 second reel explaining why AI won\'t replace good developers') — Press Enter to create"
              rows={3}
              className="w-full bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 resize-none outline-none leading-relaxed disabled:opacity-60"
              aria-label="Natural language command input"
            />
          </div>

          {/* Active Voice & Attachment Chips */}
          {(isRecording || attachedDoc || voiceNotice) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
              {isRecording && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-red-950/60 border border-red-800/80 text-red-300 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Live Voice Dictation Active
                </span>
              )}

              {voiceNotice && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-indigo-950/60 border border-indigo-800 text-indigo-300">
                  {voiceNotice}
                </span>
              )}

              {attachedDoc && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-300">
                  <Icons.Paperclip className="w-3 h-3 text-indigo-400" />
                  {attachedDoc.name} ({(attachedDoc.size / 1024).toFixed(1)} KB)
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="ml-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Console Controls Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Voice / Mic Button */}
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={isLoading}
                className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                  isRecording
                    ? 'bg-red-900/50 border-red-600 text-red-300 ring-2 ring-red-500/30'
                    : 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                }`}
                title={isRecording ? 'Stop voice dictation' : 'Start live voice dictation'}
                aria-label="Toggle voice dictation"
              >
                <Icons.Mic className="w-4 h-4" />
              </button>

              {/* Document File Attachment Button */}
              <button
                type="button"
                onClick={handleFileAttachClick}
                disabled={isLoading}
                className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                  attachedDoc
                    ? 'bg-indigo-900/50 border-indigo-600 text-indigo-300'
                    : 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Attach source document (.txt, .md, .json)"
                aria-label="Attach file"
              >
                <Icons.Paperclip className="w-4 h-4" />
              </button>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                <Icons.Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Gemini 2.5 Flash</span>
              </div>
            </div>

            {/* Create / Submit Button */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isLoading || !commandInput.trim()}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm transition-all duration-150 shadow-md hover:shadow-lg active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Create content workflow"
              >
                {isLoading ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Create</span>
                    <Icons.ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Live Loading Progress Bar / Indicator */}
        {isLoading && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/50 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-mono text-indigo-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                {getStageFeedback()}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-indigo-400/80">
                {stage === 'submitting'
                  ? 'Step 1/3'
                  : stage === 'understanding'
                  ? 'Step 2/3'
                  : 'Step 3/3'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
              <div
                className="h-1 bg-indigo-500 transition-all duration-500"
                style={{
                  width:
                    stage === 'submitting'
                      ? '33%'
                      : stage === 'understanding'
                      ? '66%'
                      : '90%',
                }}
              />
            </div>
          </div>
        )}

        {/* Configuration or Execution Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-950/40 border border-red-900/60 text-xs font-mono text-red-300 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Icons.AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-red-200 font-semibold mb-0.5">
                  Content Intake Notice
                </strong>
                <p>{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setStage('idle');
              }}
              className="text-red-400 hover:text-red-200 text-xs shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Quick Action Presets */}
      <QuickActions
        presets={QUICK_ACTION_PRESETS}
        onSelectAction={handleSelectQuickAction}
      />

      {/* Real AI Content Understanding Result Panel */}
      {activeBriefResult && (
        <div className="pt-2 space-y-4">
          <ContentBriefPanel
            brief={activeBriefResult.brief}
            projectId={activeBriefResult.projectId}
            jobId={activeBriefResult.jobId}
            onDismiss={() => {
              setActiveBriefResult(null);
              setActiveResearchPackage(null);
              setActiveScriptPackage(null);
            }}
            onRunResearch={() => handleRunResearch(activeBriefResult.projectId)}
            isResearching={isResearching}
            onGenerateScript={() => handleGenerateScript(activeBriefResult.projectId)}
            isGeneratingScript={isGeneratingScript}
          />

          {/* Real Research Package Result Panel */}
          {activeResearchPackage && (
            <ResearchPackagePanel
              pkg={activeResearchPackage}
              projectId={activeBriefResult.projectId}
              jobId={activeBriefResult.jobId}
              onDismiss={() => {
                setActiveResearchPackage(null);
                setActiveScriptPackage(null);
              }}
              onGenerateScript={() => handleGenerateScript(activeBriefResult.projectId)}
              isGeneratingScript={isGeneratingScript}
            />
          )}

          {/* Real Script Package Result Panel */}
          {activeScriptPackage && (
            <ScriptPackagePanel
              pkg={activeScriptPackage}
              projectId={activeBriefResult.projectId}
              jobId={activeBriefResult.jobId}
              onDismiss={() => {
                setActiveScriptPackage(null);
                setActiveProductionPackage(null);
              }}
              onGenerateProduction={(platform) =>
                handlePlanProduction(activeBriefResult.projectId, platform)
              }
              isGeneratingProduction={isPlanningProduction}
            />
          )}

          {/* Real Production Package Result Panel */}
          {activeProductionPackage && (
            <ProductionPackagePanel
              pkg={activeProductionPackage}
              projectId={activeBriefResult.projectId}
              jobId={activeBriefResult.jobId}
              onDismiss={() => setActiveProductionPackage(null)}
              onRunPrototype={() => setShowPrototypeModal(true)}
            />
          )}
        </div>
      )}

      {/* Global Video Prototype Modal */}
      <VideoPrototypeModal
        isOpen={showPrototypeModal}
        projectId={currentProjectId}
        onClose={() => setShowPrototypeModal(false)}
      />
    </section>
  );
}
