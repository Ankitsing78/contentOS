/**
 * ContentOS - Video Composition Validator
 * Strict readiness inspector ensuring no video is rendered with missing visual or audio assets.
 * Strictly prevents silent placeholder or black screen substitution.
 */

export interface MissingVisualDetail {
  sceneId: string;
  sceneOrder: number;
  requirementId: string;
  prompt: string;
  status: string;
}

export interface MissingAudioDetail {
  sceneId?: string;
  sceneOrder?: number;
  requirementId: string;
  audioType: string;
  status: string;
}

export interface CompositionReadiness {
  canRender: boolean;
  totalScenes: number;
  completedScenes: number;
  missingVisuals: MissingVisualDetail[];
  missingAudios: MissingAudioDetail[];
  timingErrors: string[];
  readyAssets: {
    visuals: number;
    audios: number;
    captions: number;
  };
}

export class MissingAssetsError extends Error {
  readonly readiness: CompositionReadiness;

  constructor(message: string, readiness: CompositionReadiness) {
    super(message);
    this.name = 'MissingAssetsError';
    this.readiness = readiness;
  }
}

export class InvalidSceneTimingError extends Error {
  readonly timingErrors: string[];

  constructor(message: string, timingErrors: string[] = []) {
    super(message);
    this.name = 'InvalidSceneTimingError';
    this.timingErrors = timingErrors;
  }
}

export interface ValidateCompositionInput {
  scenes: Array<{
    id: string;
    order: number;
    start_second: number;
    end_second: number;
  }>;
  visualRequirements: Array<{
    id: string;
    scene_id: string;
    status: string;
    prompt: string;
    content_asset_id?: string | null;
    generation_required: boolean;
    storage_path?: string | null;
  }>;
  audioRequirements: Array<{
    id: string;
    scene_id?: string | null;
    audio_type: string;
    status: string;
    content_asset_id?: string | null;
    generation_required: boolean;
    storage_path?: string | null;
  }>;
  captions?: Array<{
    id: string;
    scene_id: string;
    start_second: number;
    end_second: number;
    text: string;
  }>;
  existingAssetIds?: Set<string>;
}

export function validateCompositionReadiness(
  input: ValidateCompositionInput
): CompositionReadiness {
  const { scenes, visualRequirements, audioRequirements, captions = [], existingAssetIds } = input;

  const missingVisuals: MissingVisualDetail[] = [];
  const missingAudios: MissingAudioDetail[] = [];

  let readyVisualCount = 0;
  let readyAudioCount = 0;

  // Map scenes by ID for fast lookup
  const sceneMap = new Map<string, { id: string; order: number; start_second: number; end_second: number }>();
  for (const scene of scenes) {
    sceneMap.set(scene.id, scene);
  }

  // 1. Validate Visual Requirements
  for (const req of visualRequirements) {
    const scene = sceneMap.get(req.scene_id);
    const sceneOrder = scene ? scene.order : 0;

    const isCompleted = req.status === 'completed';
    const hasAssetId = !!req.content_asset_id;
    const assetExistsInDb = existingAssetIds ? (req.content_asset_id ? existingAssetIds.has(req.content_asset_id) : false) : true;

    if (!isCompleted || !hasAssetId || !assetExistsInDb) {
      missingVisuals.push({
        sceneId: req.scene_id,
        sceneOrder,
        requirementId: req.id,
        prompt: req.prompt || '',
        status: req.status,
      });
    } else {
      readyVisualCount++;
    }
  }

  // 2. Validate Audio Requirements (especially voiceover narration)
  for (const audioReq of audioRequirements) {
    // Check required audio items (narration voiceover is mandatory for scenes)
    if (audioReq.audio_type === 'voiceover') {
      const scene = audioReq.scene_id ? sceneMap.get(audioReq.scene_id) : undefined;
      const sceneOrder = scene ? scene.order : undefined;

      const isCompleted = audioReq.status === 'completed';
      const hasAssetId = !!audioReq.content_asset_id;
      const assetExistsInDb = existingAssetIds ? (audioReq.content_asset_id ? existingAssetIds.has(audioReq.content_asset_id) : false) : true;

      if (!isCompleted || !hasAssetId || !assetExistsInDb) {
        missingAudios.push({
          sceneId: audioReq.scene_id || undefined,
          sceneOrder,
          requirementId: audioReq.id,
          audioType: audioReq.audio_type,
          status: audioReq.status,
        });
      } else {
        readyAudioCount++;
      }
    } else if (audioReq.status === 'completed' && audioReq.content_asset_id) {
      readyAudioCount++;
    }
  }

  // 3. Validate Scene Timing & Contiguity
  const timingErrors: string[] = [];
  if (scenes.length === 0) {
    timingErrors.push('No scenes defined in composition specification');
  } else {
    const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
    if (sortedScenes[0].start_second !== 0) {
      timingErrors.push(
        `First scene must start at 0s, but starts at ${sortedScenes[0].start_second}s`
      );
    }

    for (let i = 0; i < sortedScenes.length; i++) {
      const s = sortedScenes[i];
      if (s.end_second <= s.start_second) {
        timingErrors.push(
          `Scene #${s.order} (${s.id}) has invalid duration: start=${s.start_second}s, end=${s.end_second}s`
        );
      }

      if (i > 0) {
        const prev = sortedScenes[i - 1];
        if (Math.abs(s.start_second - prev.end_second) > 0.05) {
          timingErrors.push(
            `Timing gap or overlap between Scene #${prev.order} (ends ${prev.end_second}s) and Scene #${s.order} (starts ${s.start_second}s)`
          );
        }
      }
    }
  }

  // 4. Count fully ready scenes (every scene must have its visual asset complete)
  const missingSceneIds = new Set(missingVisuals.map((v) => v.sceneId));
  const completedScenes = scenes.filter((s) => !missingSceneIds.has(s.id)).length;

  const canRender =
    missingVisuals.length === 0 &&
    missingAudios.length === 0 &&
    timingErrors.length === 0;

  return {
    canRender,
    totalScenes: scenes.length,
    completedScenes,
    missingVisuals,
    missingAudios,
    timingErrors,
    readyAssets: {
      visuals: readyVisualCount,
      audios: readyAudioCount,
      captions: captions.length,
    },
  };
}
