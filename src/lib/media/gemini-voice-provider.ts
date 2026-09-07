/**
 * ContentOS - Gemini Voice Provider Implementation
 * Server-only TTS provider using Google GenAI SDK and gemini-3.1-flash-tts-preview.
 */

import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { IVoiceProvider, VoiceGenerationRequest, GeneratedAudio } from './voice-provider';
import { VOICE_CONFIG } from './voice-config';
import { parseAudioMetadata, pcmToWav } from './audio-parser';

export class GeminiVoiceProvider implements IVoiceProvider {
  readonly id = 'gemini' as const;
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, modelName?: string) {
    const key =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!key || key.startsWith('YOUR_') || key.startsWith('your-')) {
      throw new Error(
        'GeminiVoiceProvider requires a valid GEMINI_API_KEY environment variable. Please set it in .env.local.'
      );
    }

    this.client = new GoogleGenAI({ apiKey: key });
    this.model = modelName || VOICE_CONFIG.model;
  }

  async generateSpeech(request: VoiceGenerationRequest): Promise<GeneratedAudio> {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Narration text cannot be empty for voice synthesis');
    }

    const voiceName = request.voice || VOICE_CONFIG.defaultVoice;
    const speakingStyle = request.speaking_style || VOICE_CONFIG.defaultSpeakingStyle;
    const pace = request.pace ?? VOICE_CONFIG.defaultPace;

    // Strict voice-performance prompt containing exact verbatim narration
    // Note: Developer instructions (systemInstruction) are not enabled on gemini-3.1-flash-tts-preview;
    // instructions must be provided directly in contents prompt.
    const prompt = [
      `Read the following text aloud with a ${speakingStyle} style at ${pace}x natural pace.`,
      'Do not add any greeting, preamble, intro, outro, commentary, or explanation.',
      'Speak the provided text verbatim:',
      '',
      request.text.trim(),
    ].join('\n');

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidate returned by Gemini TTS model');
      }

      const parts = candidate.content?.parts || [];
      const audioPart = parts.find((p) => p.inlineData && p.inlineData.data);

      if (!audioPart || !audioPart.inlineData?.data) {
        throw new Error('Gemini TTS response did not contain inline audio data');
      }

      const rawBase64 = audioPart.inlineData.data;
      const reportedMimeType = audioPart.inlineData.mimeType || 'audio/wav';
      const rawBuffer = Buffer.from(rawBase64, 'base64');

      if (rawBuffer.length === 0) {
        throw new Error('Decoded audio buffer is empty');
      }

      // Check if Gemini returned raw linear PCM (audio/l16) without a container header
      let audioBuffer: Buffer = rawBuffer;
      const isRawPcm =
        reportedMimeType.includes('audio/l16') ||
        rawBuffer.toString('ascii', 0, 4) !== 'RIFF';

      if (isRawPcm) {
        const rateMatch = reportedMimeType.match(/rate=(\d+)/);
        const channelMatch = reportedMimeType.match(/channels=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const channels = channelMatch ? parseInt(channelMatch[1], 10) : 1;
        // Package raw PCM with standard 44-byte WAV RIFF header for playback compatibility
        audioBuffer = pcmToWav(rawBuffer, sampleRate, channels, 16);
      }

      // Parse binary header for duration and audio specifications
      const parsed = parseAudioMetadata(audioBuffer, reportedMimeType);

      return {
        audioBuffer,
        mimeType: parsed.mimeType,
        fileExtension: parsed.fileExtension,
        durationSeconds: parsed.durationSeconds,
        sampleRate: parsed.sampleRate,
        channels: parsed.channels,
        provider: 'gemini',
        model: this.model,
        metadata: {
          voiceName,
          speakingStyle,
          pace,
          sizeBytes: parsed.sizeBytes,
          sampleRate: parsed.sampleRate,
          channels: parsed.channels,
          bitsPerSample: parsed.bitsPerSample,
          reportedMimeType,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown Gemini TTS error';
      // Sanitized error logging (no keys or tokens)
      console.error('[ContentOS] [GeminiVoiceProvider] Speech generation error:', msg);
      throw new Error(`Gemini TTS generation failed: ${msg}`);
    }
  }
}
