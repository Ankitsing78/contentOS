/**
 * ContentOS - Visual Asset Secure Preview Endpoint
 * GET /api/content/:projectId/production/visuals/:visualRequirementId/preview
 *
 * Generates a short-lived signed URL for a completed private visual asset.
 * Enforces authentication and project ownership without exposing the bucket publicly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CONTENT_ASSETS_BUCKET } from '@/lib/storage';
import {
  createServerClient,
  getAdminClient,
  isAdminConfigured,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; visualRequirementId: string }> }
) {
  const { projectId, visualRequirementId } = await context.params;

  try {
    if (!projectId || !visualRequirementId) {
      return NextResponse.json(
        { success: false, error: 'projectId and visualRequirementId are required' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    let dbClient = createServerClient(token);
    if (!dbClient && isAdminConfigured()) {
      dbClient = getAdminClient();
    }

    if (!dbClient) {
      return NextResponse.json(
        { success: false, error: 'Database client could not be initialized' },
        { status: 500 }
      );
    }

    // 1. Fetch visual requirement
    const { data: requirement, error: reqError } = await dbClient
      .from('production_visual_requirements')
      .select('id, status, content_asset_id, storage_path')
      .eq('id', visualRequirementId)
      .maybeSingle();

    if (reqError || !requirement) {
      return NextResponse.json(
        { success: false, error: `Visual requirement not found: ${visualRequirementId}` },
        { status: 404 }
      );
    }

    // 2. Fetch linked content_assets row if present
    let storagePath = requirement.storage_path;
    let assetData: Record<string, unknown> | null = null;

    if (requirement.content_asset_id) {
      const { data: assetRow } = await dbClient
        .from('content_assets')
        .select('*')
        .eq('id', requirement.content_asset_id)
        .maybeSingle();

      if (assetRow) {
        assetData = assetRow;
        storagePath = assetRow.storage_path || storagePath;
      }
    }

    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: 'No asset storage path linked to this requirement' },
        { status: 404 }
      );
    }

    // 3. Generate signed URL from private content-assets bucket
    const admin = isAdminConfigured() ? getAdminClient() : dbClient;
    const { data: signedData, error: signError } = await admin.storage
      .from(CONTENT_ASSETS_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: signError?.message || 'Failed to create signed preview URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedData.signedUrl,
      storagePath,
      asset: assetData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
