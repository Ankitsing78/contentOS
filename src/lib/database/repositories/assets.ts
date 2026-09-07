/**
 * ContentOS - Assets Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ContentAssetRow, ContentAssetInsert } from '@/types';

export async function recordContentAsset(
  client: SupabaseClient,
  input: ContentAssetInsert
): Promise<ContentAssetRow> {
  const { data, error } = await client
    .from('content_assets')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to record content asset: ${error?.message || 'Unknown error'}`);
  }

  return data as ContentAssetRow;
}

export async function listProjectAssets(
  client: SupabaseClient,
  projectId: string
): Promise<ContentAssetRow[]> {
  const { data, error } = await client
    .from('content_assets')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list project assets: ${error.message}`);
  }

  return (data || []) as ContentAssetRow[];
}

export async function getContentAssetById(
  client: SupabaseClient,
  assetId: string
): Promise<ContentAssetRow | null> {
  const { data, error } = await client
    .from('content_assets')
    .select()
    .eq('id', assetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get content asset: ${error.message}`);
  }

  return (data as ContentAssetRow) || null;
}

export async function findContentAssetByStoragePath(
  client: SupabaseClient,
  storagePath: string
): Promise<ContentAssetRow | null> {
  const { data, error } = await client
    .from('content_assets')
    .select()
    .eq('storage_path', storagePath)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find content asset by storage path: ${error.message}`);
  }

  return (data as ContentAssetRow) || null;
}
