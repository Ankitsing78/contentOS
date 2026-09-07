/**
 * ContentOS - Caption Timing & Alignment Engine
 * 
 * Splits scene spoken text into naturally timed caption blocks (3-7 words per card)
 * guaranteed to sit contiguously within the scene's [start_second, end_second] window.
 */

import { CaptionBlock } from '@/types/production';
import { calculateWordCount } from '@/lib/script/timing';

export interface GenerateCaptionsInput {
  sceneId: string;
  spokenText: string;
  startSecond: number;
  endSecond: number;
  maxWordsPerBlock?: number;
}

/**
 * Splits spoken narration into synchronized, readable subtitle blocks
 */
export function generateCaptionBlocks(input: GenerateCaptionsInput): CaptionBlock[] {
  const {
    sceneId,
    spokenText,
    startSecond,
    endSecond,
    maxWordsPerBlock = 5,
  } = input;

  const sceneDuration = Math.max(0.5, endSecond - startSecond);
  if (!spokenText || spokenText.trim().length === 0) {
    return [];
  }

  // Tokenize words while preserving sentence pauses and commas
  const words = spokenText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return [];

  // Group words into bite-sized phrase blocks (3-7 words, ideally breaking at punctuation)
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentChunk.push(word);

    const hasEndingPunctuation = /[.,!?:;]$/.test(word);
    const reachedMaxWords = currentChunk.length >= maxWordsPerBlock;

    // Split if punctuation reached and chunk is at least 3 words, or if max reached
    if ((hasEndingPunctuation && currentChunk.length >= 3) || reachedMaxWords || i === words.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  // Calculate word counts and proportional durations
  const chunkWordCounts = chunks.map((c) => Math.max(1, calculateWordCount(c)));
  const totalWords = chunkWordCounts.reduce((acc, count) => acc + count, 0);

  const captions: CaptionBlock[] = [];
  let currentStart = startSecond;

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const wordRatio = totalWords > 0 ? chunkWordCounts[i] / totalWords : 1 / chunks.length;
    const chunkDuration = sceneDuration * wordRatio;

    const blockStart = Math.round(currentStart * 100) / 100;
    let blockEnd = isLast
      ? endSecond
      : Math.round((blockStart + chunkDuration) * 100) / 100;

    if (blockEnd > endSecond) blockEnd = endSecond;
    if (blockEnd <= blockStart) blockEnd = Math.min(endSecond, blockStart + 0.5);

    // Identify emphasis words (all caps, numbers, or key words)
    const emphasisWords = chunks[i]
      .split(/\s+/)
      .filter((w) => /^[A-Z0-9%+$#]+$/.test(w) || /\d+/.test(w))
      .map((w) => w.replace(/[.,!?:;]/g, ''));

    captions.push({
      id: `${sceneId}-cap-${i + 1}`,
      scene_id: sceneId,
      start_second: blockStart,
      end_second: blockEnd,
      text: chunks[i],
      emphasis_words: emphasisWords.length > 0 ? emphasisWords : [],
    });

    currentStart = blockEnd;
  }

  return captions;
}
