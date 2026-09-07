/**
 * ContentOS - Mock Video Renderer
 * Deterministic synthetic MP4 provider for unit testing and offline composition verification.
 */

import {
  IVideoRenderer,
  VideoCompositionSpecification,
  RenderedVideo,
} from './video-renderer';

/**
 * Generates a valid minimal MP4 binary header structure with 'ftyp' and 'moov' atoms.
 */
export function createMockMp4Buffer(durationSeconds = 60): Buffer {
  // 1. 'ftyp' box (32 bytes)
  const ftyp = Buffer.alloc(32);
  ftyp.writeUInt32BE(32, 0); // box size
  ftyp.write('ftyp', 4, 4, 'ascii'); // box type
  ftyp.write('isom', 8, 4, 'ascii'); // major brand
  ftyp.writeUInt32BE(512, 12); // minor version
  ftyp.write('isom', 16, 4, 'ascii'); // compatible brands
  ftyp.write('iso2', 20, 4, 'ascii');
  ftyp.write('mp41', 24, 4, 'ascii');
  ftyp.write('mp42', 28, 4, 'ascii');

  // 2. 'moov' header box (24 bytes)
  const moov = Buffer.alloc(24);
  moov.writeUInt32BE(24, 0); // box size
  moov.write('moov', 4, 4, 'ascii'); // box type
  moov.write('mvhd', 8, 4, 'ascii'); // movie header sub-atom
  moov.writeUInt32BE(Math.round(durationSeconds * 1000), 12); // simulated duration in ms
  moov.write('trak', 16, 4, 'ascii');

  // 3. 'mdat' media data atom with simulated frame payloads
  const payload = Buffer.from(
    `ContentOS Video Stream | Duration: ${durationSeconds}s | Created: ${new Date().toISOString()}`
  );
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(payload.length + 8, 0);
  mdatHeader.write('mdat', 4, 4, 'ascii');

  return Buffer.concat([ftyp, moov, mdatHeader, payload]);
}

export class MockVideoRenderer implements IVideoRenderer {
  readonly id = 'mock-video-renderer';
  public callCount = 0;
  public lastSpec?: VideoCompositionSpecification;
  public shouldFail = false;
  public customError?: string;

  async renderVideo(spec: VideoCompositionSpecification): Promise<RenderedVideo> {
    this.callCount++;
    this.lastSpec = spec;

    if (this.shouldFail) {
      throw new Error(this.customError || 'Simulated video rendering failure');
    }

    // Strict validation: every scene must have a visual asset
    for (const scene of spec.scenes) {
      if (!scene.visualAsset || !scene.visualAsset.buffer || scene.visualAsset.buffer.length === 0) {
        throw new Error(
          `Render failed: Scene ${scene.order} (${scene.sceneId}) is missing required visual asset buffer.`
        );
      }
    }

    const videoBuffer = createMockMp4Buffer(spec.totalDurationSeconds);

    return {
      videoBuffer,
      mimeType: 'video/mp4',
      fileExtension: 'mp4',
      width: spec.dimensions.width,
      height: spec.dimensions.height,
      durationSeconds: spec.totalDurationSeconds,
      fps: spec.fps,
      renderer: 'mock-video-renderer',
      metadata: {
        sceneCount: spec.scenes.length,
        aspectRatio: spec.aspectRatio,
        platform: spec.platform,
        renderedAt: new Date().toISOString(),
      },
    };
  }
}
