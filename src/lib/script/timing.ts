/**
 * ContentOS - Script Timing & Pacing Engine
 * 
 * Provides deterministic spoken word-count analysis, duration estimation,
 * and section timestamp alignment across target platforms.
 */

import { ScriptSection } from '@/types';

export const DEFAULT_WORDS_PER_MINUTE = parseInt(
  process.env.SCRIPT_WORDS_PER_MINUTE || '150',
  10
);

/**
 * Accurately counts spoken words in a text block, ignoring punctuation and markdown formatting.
 */
export function calculateWordCount(text: string): number {
  if (typeof text !== 'string' || text.trim().length === 0) return 0;

  // Remove markdown symbols, stage direction tags, and special punctuation
  const sanitized = text
    .replace(/[#*_~`>[\]()]/g, ' ')
    .replace(/\[.*?\]/g, ' ') // stage directions in brackets
    .trim();

  const words = sanitized.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * Calculates estimated spoken duration in seconds based on word count and words per minute (WPM).
 */
export function estimateDurationSeconds(
  text: string,
  wpm = DEFAULT_WORDS_PER_MINUTE
): number {
  const words = calculateWordCount(text);
  if (words === 0) return 0;
  // (words / wpm) * 60 seconds
  const seconds = (words / wpm) * 60;
  return Math.max(1, Math.round(seconds));
}

/**
 * Aligns section timestamps sequentially so that start and end seconds are
 * strictly non-overlapping, contiguous, and based on spoken word counts.
 */
export function alignSectionTimestamps(
  sections: ScriptSection[],
  targetDurationSeconds?: number,
  wpm = DEFAULT_WORDS_PER_MINUTE
): ScriptSection[] {
  if (sections.length === 0) return [];

  let currentSecond = 0;
  const rawSectionsWithDurations = sections.map((sec) => {
    const calculatedSecs = estimateDurationSeconds(sec.spoken_text, wpm);
    const duration = Math.max(2, calculatedSecs); // Min 2 seconds per section
    return { sec, duration };
  });

  const totalRawDuration = rawSectionsWithDurations.reduce((acc, s) => acc + s.duration, 0);

  // If targetDurationSeconds is specified, scale proportionally so total exactly matches target
  const scale = targetDurationSeconds && totalRawDuration > 0
    ? targetDurationSeconds / totalRawDuration
    : 1.0;

  const aligned: ScriptSection[] = [];

  for (let i = 0; i < rawSectionsWithDurations.length; i++) {
    const item = rawSectionsWithDurations[i];
    const isLast = i === rawSectionsWithDurations.length - 1;

    let scaledDuration = Math.round(item.duration * scale * 10) / 10;
    scaledDuration = Math.max(1.5, scaledDuration);

    const start = Math.round(currentSecond * 10) / 10;
    let end = Math.round((start + scaledDuration) * 10) / 10;

    if (isLast && targetDurationSeconds) {
      end = targetDurationSeconds;
    }

    aligned.push({
      ...item.sec,
      order: i + 1,
      start_second: start,
      end_second: Math.max(start + 1, end),
    });

    currentSecond = end;
  }

  return aligned;
}

export interface TimingValidationResult {
  isValid: boolean;
  wordCount: number;
  estimatedDurationSeconds: number;
  targetDurationSeconds: number;
  varianceRatio: number;
  message?: string;
}

/**
 * Validates that estimated duration does not exceed target duration beyond allowable variance.
 */
export function validateScriptTiming(
  input: string | ScriptSection[],
  targetDurationSeconds: number,
  maxAllowedVarianceRatio = 0.3, // 30% allowable variance
  wpm = DEFAULT_WORDS_PER_MINUTE
): TimingValidationResult {
  const spokenText = typeof input === 'string'
    ? input
    : input.map((s) => s.spoken_text || '').join(' ');
  const wordCount = calculateWordCount(spokenText);
  const estimated = estimateDurationSeconds(spokenText, wpm);
  const variance = Math.abs(estimated - targetDurationSeconds);
  const varianceRatio = targetDurationSeconds > 0 ? variance / targetDurationSeconds : 0;

  const isValid = varianceRatio <= maxAllowedVarianceRatio;

  return {
    isValid,
    wordCount,
    estimatedDurationSeconds: estimated,
    targetDurationSeconds,
    varianceRatio,
    message: isValid
      ? undefined
      : `Estimated duration (${estimated}s) deviates significantly from target (${targetDurationSeconds}s) by ${Math.round(
          varianceRatio * 100
        )}%`,
  };
}
