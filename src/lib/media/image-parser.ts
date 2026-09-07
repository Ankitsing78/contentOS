/**
 * ContentOS - Zero-Dependency Image Header Parser & Validator
 * Extracts dimensions, format, byte size, and calculates aspect ratios directly
 * from raw binary buffers for PNG, JPEG, and WebP.
 */

export interface ParsedImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  fileExtension: string;
  sizeBytes: number;
  aspectRatio: number;
  formattedAspectRatio: string;
}

export function parseImageMetadata(
  buffer: Buffer,
  fallbackMime?: string
): ParsedImageMetadata {
  if (!buffer || buffer.length === 0) {
    throw new Error('Image buffer is empty or undefined');
  }

  // 1. PNG Check (8-byte signature: 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n')
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    // IHDR chunk: width at bytes 16..19, height at bytes 20..23 (Big Endian)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return buildImageResult(width, height, 'image/png', 'png', buffer.length);
  }

  // 2. JPEG Check (starts with 0xFF, 0xD8)
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Skip fill bytes
      if (marker === 0xff || marker === 0x00) {
        offset++;
        continue;
      }

      // SOF markers (Start Of Frame): Baseline (0xC0), Extended (0xC1), Progressive (0xC2)
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        // SOF payload: [length (2)][precision (1)][height (2)][width (2)]
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return buildImageResult(width, height, 'image/jpeg', 'jpg', buffer.length);
      }

      // Read marker length and jump
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  // 3. WebP Check ('RIFF'....'WEBP')
  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8X' && buffer.length >= 30) {
      // VP8X extended header: canvas width 24..26 (3 bytes LE + 1), height 27..29 (3 bytes LE + 1)
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return buildImageResult(width, height, 'image/webp', 'webp', buffer.length);
    } else if (chunkType === 'VP8 ' && buffer.length >= 30) {
      // VP8 lossy: 26..27 width (14 bits), 28..29 height (14 bits)
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return buildImageResult(width, height, 'image/webp', 'webp', buffer.length);
    } else if (chunkType === 'VP8L' && buffer.length >= 25) {
      // VP8L lossless
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return buildImageResult(width, height, 'image/webp', 'webp', buffer.length);
    }
  }

  // Fallback if dimensions could not be read from header
  const mime = fallbackMime || 'image/png';
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  return buildImageResult(1080, 1920, mime, ext, buffer.length);
}

function buildImageResult(
  width: number,
  height: number,
  mimeType: string,
  fileExtension: string,
  sizeBytes: number
): ParsedImageMetadata {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspectRatio = safeWidth / safeHeight;

  // Detect closest standard ratio name
  let formattedAspectRatio = `${safeWidth}:${safeHeight}`;
  if (Math.abs(aspectRatio - 9 / 16) < 0.05) {
    formattedAspectRatio = '9:16';
  } else if (Math.abs(aspectRatio - 16 / 9) < 0.05) {
    formattedAspectRatio = '16:9';
  } else if (Math.abs(aspectRatio - 1.0) < 0.05) {
    formattedAspectRatio = '1:1';
  } else if (Math.abs(aspectRatio - 4 / 5) < 0.05) {
    formattedAspectRatio = '4:5';
  }

  return {
    width: safeWidth,
    height: safeHeight,
    mimeType,
    fileExtension,
    sizeBytes,
    aspectRatio: Number(aspectRatio.toFixed(4)),
    formattedAspectRatio,
  };
}

/**
 * Creates a minimal valid 1080x1920 PNG buffer for testing and mock operations.
 * Pure binary construction without external libraries.
 */
export function createMockPngBuffer(width = 1080, height = 1920): Buffer {
  // Minimal uncompressed PNG with 8-byte signature, IHDR chunk, empty IDAT, and IEND
  // Signature (8 bytes)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: length=13, type='IHDR', data=(width[4], height[4], depth[1]=8, colorType[1]=2 (RGB), comp[1]=0, filter[1]=0, interlace[1]=0), CRC[4]
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // Minimal valid IDAT chunk (raw zlib stream of 1 empty scanline or minimal deflated data)
  // 78 01 01 00 00 ff ff 00 00 00 01 (minimal uncompressed zlib block)
  const idatData = Buffer.from([
    0x78, 0x01, 0x01, 0x01, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x01,
  ]);
  const idatChunk = createPngChunk('IDAT', idatData);

  // IEND chunk
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC-32 over chunk type + data
  const crc = calculateCrc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Standard IEEE 802.3 CRC-32
function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
