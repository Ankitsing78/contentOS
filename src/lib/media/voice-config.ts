/**
 * ContentOS - Voice & Speech Generation Configuration
 * Centralized settings for voice synthesis providers, default voices, and audio formats.
 */

export interface VoiceConfig {
  provider: 'gemini' | 'mock';
  model: string;
  defaultVoice: string;
  defaultLanguage: string;
  outputAudioFormat: 'audio/wav' | 'audio/mp3';
  defaultSpeakingStyle: string;
  defaultPace: number;
  maxDurationDeviationSeconds: number;
  maxDurationDeviationRatio: number;
  storageBucket: string;
}

export const VOICE_CONFIG: VoiceConfig = {
  provider: (process.env.VOICE_PROVIDER as 'gemini' | 'mock') || 'gemini',
  model: process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
  defaultVoice: process.env.VOICE_DEFAULT_NAME || 'Puck', // Google Gemini prebuilt voices: Puck, Charon, Kore, Fenrir, Aoede
  defaultLanguage: process.env.VOICE_DEFAULT_LANGUAGE || 'en',
  outputAudioFormat: 'audio/wav',
  defaultSpeakingStyle:
    process.env.VOICE_DEFAULT_STYLE || 'Punchy, pragmatic, authoritative, and encouraging tech narration',
  defaultPace: 1.0,
  maxDurationDeviationSeconds: 5.0, // Configurable tolerance for natural pacing variance
  maxDurationDeviationRatio: 0.5, // Max 50% relative deviation
  storageBucket: 'content-assets',
};

/**
 * Builds deterministic logical storage path for narration audio
 */
export function buildNarrationStoragePath(projectId: string, assetId: string, extension: string = 'wav'): string {
  const cleanExt = extension.replace(/^\./, '');
  return `projects/${projectId}/audio/narration/${assetId}.${cleanExt}`;
}
