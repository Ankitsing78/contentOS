/**
 * ContentOS - Isolated Video Prototype Execution Endpoint
 * POST /api/content/:projectId/prototype/video
 * GET  /api/content/:projectId/prototype/video
 *
 * Triggers and inspects isolated video prototype renders.
 * Does NOT alter real production package or requirement records.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';
import { VideoPrototypeRenderer } from '@/lib/media/video-prototype-renderer';

export const dynamic = 'force-dynamic';

// In-memory cache of latest prototype results per project for fast recall
const prototypeCache: Record<string, unknown> = {};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  console.log(
    `[ContentOS] [Prototype Video API] Render request received for project: ${projectId}`
  );

  try {
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    let dbClient = createServerClient(token);
    if ((!token || !dbClient) && isAdminConfigured()) {
      dbClient = getAdminClient();
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    let body: { preferredVariant?: 'master' | 'instagram' | 'youtube' | 'x' } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const renderer = new VideoPrototypeRenderer();
    const result = await renderer.renderPrototype({
      projectId,
      client: dbClient,
      preferredVariant: body.preferredVariant || 'master',
    });

    prototypeCache[projectId] = result;

    return NextResponse.json(
      {
        success: true,
        prototype: result,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'Prototype video rendering failed';
    console.error('[ContentOS] [Prototype Video API] Execution error:', errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    if (!projectId || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid projectId parameter is required' },
        { status: 400 }
      );
    }

    if (prototypeCache[projectId]) {
      return NextResponse.json({
        success: true,
        prototype: prototypeCache[projectId],
      });
    }

    // Check if public prototype directory has existing render
    const publicProtoDir = path.resolve(process.cwd(), 'public', 'prototype', projectId);
    if (fs.existsSync(publicProtoDir)) {
      const entries = fs.readdirSync(publicProtoDir);
      if (entries.length > 0) {
        const latestTestId = entries[entries.length - 1];
        const videoPath = path.join(publicProtoDir, latestTestId, 'prototype_video.mp4');
        if (fs.existsSync(videoPath)) {
          const stat = fs.statSync(videoPath);
          return NextResponse.json({
            success: true,
            prototype: {
              testId: latestTestId,
              projectId,
              publicUrl: `/prototype/${projectId}/${latestTestId}/prototype_video.mp4`,
              storagePath: `prototype/projects/${projectId}/video-tests/${latestTestId}/prototype_video.mp4`,
              durationSeconds: 60,
              width: 1080,
              height: 1920,
              fps: 30,
              fileSizeBytes: stat.size,
              mimeType: 'video/mp4',
              scriptVariant: 'master',
              audioIncluded: true,
              captionsIncluded: true,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      prototype: null,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to retrieve prototype status';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
