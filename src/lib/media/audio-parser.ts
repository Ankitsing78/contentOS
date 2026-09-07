/**
 * ContentOS - Audio File Parser & Duration Analyzer
 * Lightweight, zero-dependency utility to inspect binary audio headers,
 * determine MIME type, file extension, and calculate exact audio duration.
 */

export interface ParsedAudioMetadata {
  mimeType: string;
  fileExtension: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  sizeBytes: number;
}

/**
 * Wraps raw linear PCM (L16) audio in a standard 44-byte RIFF/WAVE header
 * without lossy re-encoding, allowing playback in all standard web and media players.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8, 'ascii');

  // fmt subchunk
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Parses binary audio buffer and extracts audio characteristics and duration.
 */
export function parseAudioMetadata(
  buffer: Buffer,
  hintMimeType?: string
): ParsedAudioMetadata {
  const sizeBytes = buffer.byteLength;

  // 1. Inspect for RIFF / WAVE header
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    let offset = 12;
    let sampleRate: number | undefined;
    let channels: number | undefined;
    let bitsPerSample: number | undefined;
    let byteRate: number | undefined;
    let dataSize: number | undefined;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      offset += 8;

      if (chunkId === 'fmt ' && chunkSize >= 14 && offset + chunkSize <= buffer.length) {
        channels = buffer.readUInt16LE(offset + 2);
        sampleRate = buffer.readUInt32LE(offset + 4);
        byteRate = buffer.readUInt32LE(offset + 8);
        if (chunkSize >= 16) {
          bitsPerSample = buffer.readUInt16LE(offset + 14);
        }
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }

      offset += chunkSize;
      // Chunks are 2-byte aligned in RIFF
      if (chunkSize % 2 === 1) offset += 1;
    }

    let durationSeconds: number | undefined;
    if (dataSize && byteRate && byteRate > 0) {
      durationSeconds = Math.round((dataSize / byteRate) * 100) / 100;
    } else if (dataSize && sampleRate && channels && bitsPerSample && sampleRate > 0) {
      const bytesPerSec = sampleRate * channels * (bitsPerSample / 8);
      if (bytesPerSec > 0) {
        durationSeconds = Math.round((dataSize / bytesPerSec) * 100) / 100;
      }
    }

    return {
      mimeType: 'audio/wav',
      fileExtension: 'wav',
      durationSeconds,
      sampleRate,
      channels,
      bitsPerSample,
      sizeBytes,
    };
  }

  // 2. Inspect for L16 PCM (e.g. from Gemini TTS: "audio/l16; rate=24000; channels=1")
  if (hintMimeType?.includes('audio/l16')) {
    const rateMatch = hintMimeType.match(/rate=(\d+)/);
    const channelMatch = hintMimeType.match(/channels=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const channels = channelMatch ? parseInt(channelMatch[1], 10) : 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const durationSeconds = byteRate > 0 ? Math.round((sizeBytes / byteRate) * 100) / 100 : undefined;

    return {
      mimeType: 'audio/wav', // Stored as standard WAV container
      fileExtension: 'wav',
      durationSeconds,
      sampleRate,
      channels,
      bitsPerSample,
      sizeBytes,
    };
  }

  // 3. Inspect for MP3 (ID3 or MPEG frame sync)
  const isId3 = buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';
  const isMpegSync =
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    (buffer[1] & 0xe0) === 0xe0;

  if (isId3 || isMpegSync || hintMimeType === 'audio/mpeg' || hintMimeType === 'audio/mp3') {
    // Basic approximate duration for 128kbps or 192kbps if no full VBR scan
    const approxBitrate = 128000; // 128 kbps
    const durationSeconds = Math.round((sizeBytes * 8 / approxBitrate) * 100) / 100;

    return {
      mimeType: 'audio/mpeg',
      fileExtension: 'mp3',
      durationSeconds,
      sizeBytes,
    };
  }

  // 4. Fallback based on hint or generic audio
  const normalizedMime = hintMimeType || 'audio/wav';
  const ext = normalizedMime.includes('mpeg') || normalizedMime.includes('mp3') ? 'mp3' : 'wav';

  return {
    mimeType: normalizedMime,
    fileExtension: ext,
    sizeBytes,
  };
}

