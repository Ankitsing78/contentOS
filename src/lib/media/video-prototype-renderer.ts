/**
 * ContentOS - Isolated Video Prototype Renderer
 *
 * Dedicated experimental pipeline for validating script pacing, visual layout,
 * and audio synchronization in 9:16 vertical video without mutating production asset records.
 *
 * Architecture:
 * - Uses persisted project scripts (Master script or variants)
 * - Uses existing real narration asset for Scene 1 if present
 * - Synthesizes test narration for downstream scenes via Gemini TTS in isolated prototype namespace
 * - Generates high-contrast, kinetic programmatic 1080x1920 demo visuals
 * - Compiles high-definition MP4 (H.264/AAC) using FFmpeg with burned-in subtitles and transitions
 * - Saves strictly to prototype/ namespace in storage and public/ for immediate browser playback
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SupabaseClient } from '@supabase/supabase-js';
import { GeminiVoiceProvider } from './gemini-voice-provider';
import { isGeminiConfigured } from '@/lib/ai/config';

const execFileAsync = promisify(execFile);

export interface PrototypeScene {
  order: number;
  title: string;
  purpose: string;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  spokenText: string;
  onScreenText?: string;
  visualDirection?: string;
}

export interface PrototypeRenderInput {
  projectId: string;
  testId?: string;
  client: SupabaseClient;
  preferredVariant?: 'master' | 'instagram' | 'youtube' | 'x';
  onStepProgress?: (step: string, percentage: number) => void;
}

export interface PrototypeRenderResult {
  testId: string;
  projectId: string;
  storagePath: string;
  publicUrl: string;
  localPath: string;
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
  scenes: PrototypeScene[];
  createdAt: string;
}

/**
 * Generates programmatic SVG visual cards for each scene (1080x1920 vertical 9:16).
 */
export function generateSceneSvg(scene: PrototypeScene, totalScenes: number = 5): string {
  const { order, purpose, spokenText, onScreenText } = scene;

  // Visual themes per scene
  let themeHeader = '';
  let themeVisualContent = '';
  let accentColor = '#00F0FF'; // Cyan default
  let badgeColor = '#38BDF8';

  if (order === 1) {
    // Hook scene: Glowing headline
    accentColor = '#00F0FF';
    badgeColor = '#38BDF8';
    themeHeader = 'HOOK &amp; PREMISE';
    themeVisualContent = `
      <g transform="translate(100, 520)">
        <circle cx="440" cy="180" r="140" fill="none" stroke="#00F0FF" stroke-width="2" stroke-opacity="0.2" />
        <circle cx="440" cy="180" r="90" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-dasharray="8 6" stroke-opacity="0.4" />
        <rect x="0" y="0" width="880" height="340" rx="24" fill="#0E172A" fill-opacity="0.8" stroke="#1E293B" stroke-width="2"/>
        <text x="440" y="80" fill="#38BDF8" font-size="28" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" letter-spacing="4">THE 2026 SHIFT</text>
        <text x="440" y="160" fill="#FFFFFF" font-size="52" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">WHY AI ELEVATES</text>
        <text x="440" y="230" fill="#00F0FF" font-size="52" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">GOOD DEVELOPERS</text>
        <text x="440" y="295" fill="#94A3B8" font-size="22" font-family="monospace" text-anchor="middle">SYNTAX IS SOLVED · ARCHITECTURE RULES</text>
      </g>
    `;
  } else if (order === 2) {
    // Problem scene: IDE / Terminal Mockup
    accentColor = '#F59E0B'; // Amber
    badgeColor = '#FBBF24';
    themeHeader = 'THE BOTTLENECK';
    themeVisualContent = `
      <g transform="translate(90, 480)">
        <!-- Terminal Card -->
        <rect x="0" y="0" width="900" height="460" rx="20" fill="#090D16" stroke="#1E293B" stroke-width="2"/>
        <!-- Window Controls -->
        <circle cx="35" cy="35" r="7" fill="#EF4444"/>
        <circle cx="60" cy="35" r="7" fill="#F59E0B"/>
        <circle cx="85" cy="35" r="7" fill="#10B981"/>
        <text x="450" y="40" fill="#64748B" font-size="18" font-family="monospace" text-anchor="middle">system_architect.ts</text>
        
        <!-- Code Visual Lines -->
        <text x="50" y="110" fill="#94A3B8" font-size="22" font-family="monospace">// Writing syntax != System Engineering</text>
        <text x="50" y="160" fill="#F59E0B" font-size="26" font-family="monospace"><tspan fill="#38BDF8">interface</tspan> SeniorEngineer {</text>
        <text x="90" y="210" fill="#E2E8F0" font-size="24" font-family="monospace">domainModeling: <tspan fill="#34D399">"irreplaceable"</tspan>;</text>
        <text x="90" y="260" fill="#E2E8F0" font-size="24" font-family="monospace">tradeOffAnalysis: <tspan fill="#34D399">"critical"</tspan>;</text>
        <text x="90" y="310" fill="#E2E8F0" font-size="24" font-family="monospace">boilerplateWriting: <tspan fill="#F87171">"automated"</tspan>;</text>
        <text x="50" y="360" fill="#F59E0B" font-size="26" font-family="monospace">}</text>
        
        <rect x="50" y="395" width="800" height="40" rx="8" fill="#1E293B" fill-opacity="0.6"/>
        <text x="450" y="422" fill="#FBBF24" font-size="18" font-family="monospace" font-weight="bold" text-anchor="middle">KEY TRUTH: ENGINEERING WAS NEVER ABOUT TYPING SYNTAX</text>
      </g>
    `;
  } else if (order === 3) {
    // Evidence scene: Metric Cards
    accentColor = '#10B981'; // Emerald
    badgeColor = '#34D399';
    themeHeader = 'EMPIRICAL RESEARCH';
    themeVisualContent = `
      <g transform="translate(90, 480)">
        <!-- Stat Card 1 -->
        <rect x="0" y="0" width="430" height="200" rx="18" fill="#0E172A" stroke="#10B981" stroke-width="1.5"/>
        <text x="215" y="75" fill="#10B981" font-size="60" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">+40.5%</text>
        <text x="215" y="125" fill="#FFFFFF" font-size="20" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">PR Velocity Boost</text>
        <text x="215" y="160" fill="#64748B" font-size="16" font-family="monospace" text-anchor="middle">GitClear 2025 Study</text>

        <!-- Stat Card 2 -->
        <rect x="470" y="0" width="430" height="200" rx="18" fill="#0E172A" stroke="#F43F5E" stroke-width="1.5"/>
        <text x="685" y="75" fill="#F43F5E" font-size="60" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">▲ 2.1x</text>
        <text x="685" y="125" fill="#FFFFFF" font-size="20" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">Spiking Code Churn</text>
        <text x="685" y="160" fill="#64748B" font-size="16" font-family="monospace" text-anchor="middle">Without Context Control</text>

        <!-- Synthesis Box -->
        <rect x="0" y="230" width="900" height="150" rx="18" fill="#0F172A" stroke="#1E293B" stroke-width="2"/>
        <text x="450" y="285" fill="#38BDF8" font-size="24" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">AI GENERATES CODE IN SECONDS</text>
        <text x="450" y="335" fill="#CBD5E1" font-size="20" font-family="monospace" text-anchor="middle">HUMANS MUST PREVENT SILENT ARCHITECTURAL DEBT</text>
      </g>
    `;
  } else if (order === 4) {
    // Paradigm Shift: Systems Architect
    accentColor = '#A855F7'; // Purple
    badgeColor = '#C084FC';
    themeHeader = 'THE NEW ADVANTAGE';
    themeVisualContent = `
      <g transform="translate(90, 480)">
        <rect x="0" y="0" width="900" height="420" rx="20" fill="#0E172A" stroke="#A855F7" stroke-width="1.5"/>
        <text x="450" y="70" fill="#C084FC" font-size="24" font-family="monospace" font-weight="bold" text-anchor="middle" letter-spacing="3">1 SENIOR ARCHITECT = FULL SQUAD</text>
        
        <!-- Node Diagram -->
        <circle cx="450" cy="180" r="50" fill="#581C87" stroke="#C084FC" stroke-width="3"/>
        <text x="450" y="188" fill="#FFFFFF" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle">DIRECTOR</text>

        <!-- Branches -->
        <line x1="450" y1="230" x2="250" y2="310" stroke="#7E22CE" stroke-width="3" stroke-dasharray="4 4"/>
        <line x1="450" y1="230" x2="450" y2="310" stroke="#7E22CE" stroke-width="3" stroke-dasharray="4 4"/>
        <line x1="450" y1="230" x2="650" y2="310" stroke="#7E22CE" stroke-width="3" stroke-dasharray="4 4"/>

        <rect x="170" y="310" width="160" height="60" rx="10" fill="#1E1B4B" stroke="#6366F1"/>
        <text x="250" y="347" fill="#E0E7FF" font-size="16" font-family="monospace" text-anchor="middle">Subagent 1</text>

        <rect x="370" y="310" width="160" height="60" rx="10" fill="#1E1B4B" stroke="#6366F1"/>
        <text x="450" y="347" fill="#E0E7FF" font-size="16" font-family="monospace" text-anchor="middle">Subagent 2</text>

        <rect x="570" y="310" width="160" height="60" rx="10" fill="#1E1B4B" stroke="#6366F1"/>
        <text x="650" y="347" fill="#E0E7FF" font-size="16" font-family="monospace" text-anchor="middle">Subagent 3</text>
      </g>
    `;
  } else {
    // CTA Outro
    accentColor = '#EC4899'; // Pink
    badgeColor = '#F472B6';
    themeHeader = 'ACTIONABLE TAKEAWAY';
    themeVisualContent = `
      <g transform="translate(90, 480)">
        <rect x="0" y="0" width="900" height="420" rx="20" fill="url(#outroGrad)" stroke="#EC4899" stroke-width="2"/>
        <text x="450" y="90" fill="#FFFFFF" font-size="44" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle">LEVEL UP YOUR CRAFT</text>
        
        <rect x="80" y="140" width="740" height="70" rx="12" fill="#18181B" stroke="#3F3F46"/>
        <text x="450" y="184" fill="#38BDF8" font-size="22" font-family="monospace" font-weight="bold" text-anchor="middle">1. MASTER HIGH-LEVEL SYSTEM DESIGN</text>

        <rect x="80" y="230" width="740" height="70" rx="12" fill="#18181B" stroke="#3F3F46"/>
        <text x="450" y="274" fill="#34D399" font-size="22" font-family="monospace" font-weight="bold" text-anchor="middle">2. REFINE CONTEXT ENGINEERING</text>

        <text x="450" y="360" fill="#F472B6" font-size="24" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">FOLLOW FOR PRAGMATIC ENGINEERING INSIGHTS</text>
      </g>
    `;
  }

  // XML Text sanitizer: decodes HTML-named entities to unicode and encodes pure XML entities
  const sanitizeXml = (str: string) => {
    return (str || '')
      .replace(/&rdquo;/g, '”')
      .replace(/&ldquo;/g, '“')
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, ' ')
      .replace(/&hellip;/g, '…')
      .replace(/&amp;/g, '&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .trim();
  };

  const cleanSpoken = sanitizeXml(spokenText);
  const cleanOverlay = sanitizeXml(onScreenText || purpose);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <!-- Background Gradients -->
    <linearGradient id="mainBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#070A12"/>
      <stop offset="50%" stop-color="#0B0F19"/>
      <stop offset="100%" stop-color="#05070D"/>
    </linearGradient>

    <linearGradient id="outroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B4B" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#31103F" stop-opacity="0.9"/>
    </linearGradient>

    <radialGradient id="topGlow" cx="50%" cy="10%" r="60%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#070A12" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="centerGlow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#070A12" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background Base -->
  <rect width="1080" height="1920" fill="url(#mainBg)"/>
  <rect width="1080" height="1920" fill="url(#topGlow)"/>
  <rect width="1080" height="1920" fill="url(#centerGlow)"/>

  <!-- Subtle Ambient Tech Grid (Top & Bottom) -->
  <g stroke="#334155" stroke-opacity="0.15" stroke-width="1">
    <line x1="90" y1="0" x2="90" y2="1920" />
    <line x1="990" y1="0" x2="990" y2="1920" />
    <line x1="0" y1="240" x2="1080" y2="240" />
    <line x1="0" y1="1680" x2="1080" y2="1680" />
  </g>

  <!-- Top Header / Watermark Bar -->
  <g transform="translate(90, 100)">
    <!-- Prototype Badge -->
    <rect x="0" y="0" width="310" height="42" rx="10" fill="#18181B" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="22" cy="21" r="5" fill="#EF4444"/>
    <text x="40" y="27" fill="#F43F5E" font-size="14" font-family="monospace" font-weight="bold" letter-spacing="1">[PROTOTYPE / DEMO VISUAL]</text>

    <!-- Scene Tracker -->
    <rect x="730" y="0" width="170" height="42" rx="10" fill="#0F172A" stroke="#1E293B" stroke-width="1.5"/>
    <text x="815" y="26" fill="${badgeColor}" font-size="16" font-family="monospace" font-weight="bold" text-anchor="middle">SCENE ${order} / ${totalScenes}</text>
  </g>

  <!-- Section Topic Tag -->
  <g transform="translate(90, 220)">
    <text x="450" y="0" fill="${accentColor}" font-size="20" font-family="monospace" font-weight="bold" text-anchor="middle" letter-spacing="4">${themeHeader}</text>
    <text x="450" y="55" fill="#FFFFFF" font-size="38" font-family="system-ui, sans-serif" font-weight="800" text-anchor="middle">${cleanOverlay}</text>
  </g>

  <!-- Center Stage Visual Graphics -->
  ${themeVisualContent}

  <!-- Dialogue Context Card (Safe Zone) -->
  <g transform="translate(90, 1060)">
    <rect x="0" y="0" width="900" height="240" rx="18" fill="#0B0F19" fill-opacity="0.9" stroke="#1E293B" stroke-width="1.5"/>
    <rect x="25" y="-12" width="200" height="24" rx="6" fill="#1E293B"/>
    <text x="125" y="4" fill="#38BDF8" font-size="11" font-family="monospace" font-weight="bold" text-anchor="middle">SPOKEN NARRATION</text>
    <foreignObject x="30" y="30" width="840" height="190">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color: #E2E8F0; font-family: system-ui, -apple-system, sans-serif; font-size: 24px; line-height: 1.5; font-weight: 500; text-align: center; padding: 10px;">
        “${cleanSpoken}”
      </div>
    </foreignObject>
  </g>

  <!-- Safe-Zone Footer Brand Bar -->
  <g transform="translate(90, 1720)">
    <line x1="0" y1="0" x2="900" y2="0" stroke="#1E293B" stroke-width="1.5"/>
    <text x="0" y="40" fill="#64748B" font-size="16" font-family="monospace">ContentOS 9:16 Prototype Engine</text>
    <text x="900" y="40" fill="#64748B" font-size="16" font-family="monospace" text-anchor="end">Auto-Timed Captions</text>
  </g>
</svg>
`;
}

/**
 * Creates an ASS subtitle script file for the prototype video.
 */
export function generateAssSubtitles(scenes: PrototypeScene[]): string {
  const header = `[Script Info]
Title: ContentOS Prototype Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,48,&H00FFFFFF,&H000000FF,&H000B0F19,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,2,2,100,100,420,1
Style: Highlight,DejaVu Sans,52,&H0000F0FF,&H000000FF,&H000B0F19,&H80000000,-1,0,0,0,100,100,0,0,1,4.0,2,2,100,100,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const formatTimestamp = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.floor((sec % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const lines: string[] = [];

  for (const scene of scenes) {
    const text = scene.spokenText.trim();
    // Break into readable ~5-8 word chunks for kinetic subtitle pacing
    const words = text.split(/\s+/);
    const chunkSize = 6;
    const numChunks = Math.ceil(words.length / chunkSize);
    const sceneDur = scene.endSecond - scene.startSecond;
    const chunkDur = sceneDur / Math.max(1, numChunks);

    for (let i = 0; i < numChunks; i++) {
      const start = scene.startSecond + i * chunkDur;
      const end = Math.min(scene.endSecond, start + chunkDur);
      const chunkWords = words.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkText = chunkWords.join(' ');

      lines.push(
        `Dialogue: 0,${formatTimestamp(start)},${formatTimestamp(end)},Default,,0,0,0,,${chunkText}`
      );
    }
  }

  return header + lines.join('\n') + '\n';
}

export const generateAssCaptions = generateAssSubtitles;

/**
 * Isolated Video Prototype Renderer Implementation
 */
export class VideoPrototypeRenderer {
  /**
   * Executes an end-to-end prototype video render.
   */
  async renderPrototype(input: PrototypeRenderInput): Promise<PrototypeRenderResult> {
    const { projectId, client, preferredVariant = 'master', onStepProgress } = input;
    const testId = input.testId || `proto-${Date.now()}`;

    console.log(
      `[ContentOS] [Video Prototype] Starting isolated prototype test ${testId} for project ${projectId}`
    );

    // 1. Fetch project and script
    onStepProgress?.('Preparing script', 10);
    const { data: project } = await client
      .from('content_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const { data: scripts } = await client
      .from('scripts')
      .select('*')
      .eq('project_id', projectId);

    if (!scripts || scripts.length === 0) {
      throw new Error(`No scripts found for project ${projectId}`);
    }

    // Select preferred script variant
    let selectedScript = scripts.find((s) => s.platform === preferredVariant);
    if (!selectedScript) {
      selectedScript = scripts.find((s) => s.platform === 'master') || scripts[0];
    }

    const scriptVariant = selectedScript.platform || 'master';
    console.log(
      `[ContentOS] [Video Prototype] Using script variant '${scriptVariant}' (ID: ${selectedScript.id})`
    );

    // 2. Fetch script sections from script_sections table
    onStepProgress?.('Preparing scenes', 25);
    const { data: sections } = await client
      .from('script_sections')
      .select('*')
      .eq('script_id', selectedScript.id)
      .order('section_order', { ascending: true });

    let scenes: PrototypeScene[] = [];

    if (sections && sections.length > 0) {
      scenes = sections.map((sec) => ({
        order: sec.section_order,
        title: sec.section_type.toUpperCase(),
        purpose: sec.section_type.replace('_', ' ').toUpperCase(),
        startSecond: Number(sec.start_second),
        endSecond: Number(sec.end_second),
        durationSeconds: Math.round((Number(sec.end_second) - Number(sec.start_second)) * 100) / 100,
        spokenText: sec.spoken_text,
        onScreenText: sec.on_screen_text || undefined,
        visualDirection: sec.visual_direction || undefined,
      }));
    } else {
      // Fallback to production_scenes if script_sections table was not populated
      const { data: prodScenes } = await client
        .from('production_scenes')
        .select('*')
        .order('scene_order', { ascending: true });

      if (prodScenes && prodScenes.length > 0) {
        scenes = prodScenes.map((sec) => ({
          order: sec.scene_order,
          title: sec.purpose,
          purpose: sec.purpose,
          startSecond: Number(sec.start_second),
          endSecond: Number(sec.end_second),
          durationSeconds: Number(sec.duration_seconds),
          spokenText: sec.spoken_text,
          onScreenText: sec.on_screen_text || undefined,
          visualDirection: sec.camera_direction || undefined,
        }));
      }
    }

    if (scenes.length === 0) {
      throw new Error('No scenes or script sections available to render prototype video.');
    }

    const totalDuration = scenes[scenes.length - 1].endSecond;
    console.log(
      `[ContentOS] [Video Prototype] Assembled ${scenes.length} scenes totaling ${totalDuration}s`
    );

    // 3. Create isolated working temp directory
    const tempDir = path.resolve(process.cwd(), '.tmp', 'prototype', testId);
    fs.mkdirSync(tempDir, { recursive: true });

    // 4. Generate Programmatic Demo Visuals
    onStepProgress?.('Preparing demo visuals', 40);
    const sceneVisualPaths: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const svgContent = generateSceneSvg(scene, scenes.length);
      const svgPath = path.join(tempDir, `scene_${scene.order}.svg`);
      const pngPath = path.join(tempDir, `scene_${scene.order}.png`);

      fs.writeFileSync(svgPath, svgContent, 'utf8');

      // Rasterize SVG to 1080x1920 PNG using FFmpeg
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', svgPath,
        '-frames:v', '1',
        pngPath,
      ]);

      sceneVisualPaths.push(pngPath);
    }

    // 5. Prepare Audio: Use real narration for Scene 1, synthesize test narration for remaining
    onStepProgress?.('Synchronizing narration audio', 55);
    const sceneAudioPaths: string[] = [];

    // Try to load existing real narration for Scene 1
    const { data: realAssets } = await client
      .from('content_assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('asset_type', 'audio')
      .limit(1);

    let realNarrationBuffer: Buffer | null = null;
    if (realAssets && realAssets.length > 0) {
      try {
        const downloadRes = await client.storage
          .from('content-assets')
          .download(realAssets[0].storage_path);
        if (downloadRes.data) {
          realNarrationBuffer = Buffer.from(await downloadRes.data.arrayBuffer());
          console.log(
            `[ContentOS] [Video Prototype] Successfully loaded real audio asset: ${realAssets[0].storage_path} (${realNarrationBuffer.length} bytes)`
          );
        }
      } catch (err) {
        console.warn('[ContentOS] [Video Prototype] Could not download real audio asset:', err);
      }
    }

    let voiceProvider: GeminiVoiceProvider | null = null;
    if (isGeminiConfigured()) {
      try {
        voiceProvider = new GeminiVoiceProvider();
      } catch {
        voiceProvider = null;
      }
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneAudioPath = path.join(tempDir, `scene_${scene.order}_audio.wav`);

      if (i === 0 && realNarrationBuffer) {
        // Scene 1: Real persisted narration
        fs.writeFileSync(sceneAudioPath, realNarrationBuffer);
      } else {
        // Scene 2..N: Synthesize prototype test audio using GeminiVoiceProvider or sine tone
        let audioWritten = false;
        if (voiceProvider) {
          try {
            const synth = await voiceProvider.generateSpeech({
              text: scene.spokenText,
              voice: 'Puck',
            });
            if (synth.audioBuffer && synth.audioBuffer.length > 0) {
              fs.writeFileSync(sceneAudioPath, synth.audioBuffer);
              audioWritten = true;
            }
          } catch (synthErr) {
            console.warn(
              `[ContentOS] [Video Prototype] Gemini TTS error for scene ${scene.order}, using ambient generator:`,
              synthErr instanceof Error ? synthErr.message : 'Unknown'
            );
          }
        }

        if (!audioWritten) {
          // Fallback clean silence/ambient track with exact scene duration
          await execFileAsync('ffmpeg', [
            '-y',
            '-f', 'lavfi',
            '-i', `anullsrc=r=24000:cl=mono`,
            '-t', `${scene.durationSeconds}`,
            sceneAudioPath,
          ]);
        }
      }

      // Ensure audio track matches scene duration exactly by padding or trimming cleanly
      const adjustedAudioPath = path.join(tempDir, `scene_${scene.order}_adjusted.wav`);
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', sceneAudioPath,
        '-af', `apad=whole_dur=${scene.durationSeconds}`,
        '-t', `${scene.durationSeconds}`,
        adjustedAudioPath,
      ]);

      sceneAudioPaths.push(adjustedAudioPath);
    }

    // 6. Concatenate audio tracks into a master timeline audio track
    const audioConcatListPath = path.join(tempDir, 'audio_concat.txt');
    const audioConcatContent = sceneAudioPaths.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(audioConcatListPath, audioConcatContent, 'utf8');

    const masterAudioPath = path.join(tempDir, 'master_audio.wav');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', audioConcatListPath,
      '-c:a', 'pcm_s16le',
      masterAudioPath,
    ]);

    // 7. Render Subtitles (.ass file)
    onStepProgress?.('Rendering subtitles and captions', 70);
    const assContent = generateAssSubtitles(scenes);
    const assPath = path.join(tempDir, 'captions.ass');
    fs.writeFileSync(assPath, assContent, 'utf8');

    // 8. Render individual scene video clips with subtle kinetic motion (zoompan)
    onStepProgress?.('Rendering video frames', 80);
    const sceneVideoPaths: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const visualPng = sceneVisualPaths[i];
      const sceneVideoPath = path.join(tempDir, `scene_${scene.order}_video.mp4`);

      // 30fps, 1080x1920, subtle zoom effect: zoom from 1.0 to 1.05 over the duration
      const totalFrames = Math.max(30, Math.round(scene.durationSeconds * 30));
      const zoomFilter = `zoompan=z='min(zoom+0.0004,1.05)':d=${totalFrames}:s=1080x1920:fps=30`;

      await execFileAsync('ffmpeg', [
        '-y',
        '-loop', '1',
        '-i', visualPng,
        '-vf', zoomFilter,
        '-t', `${scene.durationSeconds}`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        sceneVideoPath,
      ]);

      sceneVideoPaths.push(sceneVideoPath);
    }

    // 9. Concatenate scene videos
    const videoConcatListPath = path.join(tempDir, 'video_concat.txt');
    const videoConcatContent = sceneVideoPaths.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(videoConcatListPath, videoConcatContent, 'utf8');

    const concatenatedVideoPath = path.join(tempDir, 'concatenated_video.mp4');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', videoConcatListPath,
      '-c', 'copy',
      concatenatedVideoPath,
    ]);

    // 10. Final Assembly: Mux Master Video + Audio + Burned-in Subtitles
    onStepProgress?.('Finalizing and encoding MP4', 90);
    const outputVideoPath = path.join(tempDir, 'prototype_video.mp4');

    // Burn-in subtitles using libass
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', concatenatedVideoPath,
      '-i', masterAudioPath,
      '-vf', `ass=${assPath}`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      outputVideoPath,
    ]);

    const stat = fs.statSync(outputVideoPath);
    const videoBuffer = fs.readFileSync(outputVideoPath);
    console.log(
      `[ContentOS] [Video Prototype] Render complete: ${outputVideoPath} (${stat.size} bytes)`
    );

    // 11. Storage in isolated namespace: prototype/projects/{projectId}/video-tests/{testId}/
    const storageNamespacePath = `prototype/projects/${projectId}/video-tests/${testId}/prototype_video.mp4`;

    try {
      await client.storage
        .from('content-assets')
        .upload(storageNamespacePath, videoBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });
      console.log(
        `[ContentOS] [Video Prototype] Uploaded to isolated storage namespace: ${storageNamespacePath}`
      );
    } catch (storageErr) {
      console.warn(
        '[ContentOS] [Video Prototype] Supabase storage upload notice:',
        storageErr instanceof Error ? storageErr.message : 'Unknown'
      );
    }

    // 12. Copy to public directory for instant direct browser preview
    const publicPrototypeDir = path.resolve(process.cwd(), 'public', 'prototype', projectId, testId);
    fs.mkdirSync(publicPrototypeDir, { recursive: true });
    const publicVideoPath = path.join(publicPrototypeDir, 'prototype_video.mp4');
    fs.copyFileSync(outputVideoPath, publicVideoPath);

    const publicUrl = `/prototype/${projectId}/${testId}/prototype_video.mp4`;

    onStepProgress?.('Ready', 100);

    return {
      testId,
      projectId,
      storagePath: storageNamespacePath,
      publicUrl,
      localPath: publicVideoPath,
      durationSeconds: Math.round(totalDuration),
      width: 1080,
      height: 1920,
      fps: 30,
      fileSizeBytes: stat.size,
      mimeType: 'video/mp4',
      scriptVariant,
      audioIncluded: true,
      captionsIncluded: true,
      scenesCount: scenes.length,
      scenes,
      createdAt: new Date().toISOString(),
    };
  }
}
