/**
 * ContentOS - Modular Voice & Speech Provider Abstraction
 * Defines the vendor-agnostic contract for audio synthesis and speech generation.
 */

export interface VoiceGenerationRequest {
  text: string;
  language?: string;
  voice?: string;
  speaking_style?: string;
  pace?: number;
  format?: 'audio/wav' | 'audio/mp3';
  sampleRate?: number;
  expectedDurationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface GeneratedAudio {
  audioBuffer: Buffer;
  mimeType: string;
  fileExtension: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface IVoiceProvider {
  readonly id: string;

  /**
   * Synthesizes audio from text according to voice requirements.
   * Spoken text must be treated as authoritative and never paraphrased.
   */
  generateSpeech(request: VoiceGenerationRequest): Promise<GeneratedAudio>;
}
