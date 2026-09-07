/**
 * ContentOS - Platforms Repository
 * CRITICAL SECURITY:
 * Never select or expose access_token or refresh_token through user-facing functions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  PlatformType,
  PlatformPostRow,
} from '@/types';

export interface SafePlatformAccount {
  id: string;
  user_id: string;
  platform: PlatformType;
  account_name: string;
  external_account_id: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export async function listConnectedPlatforms(
  client: SupabaseClient,
  userId: string
): Promise<SafePlatformAccount[]> {
  // Select only safe non-sensitive columns
  const { data, error } = await client
    .from('platform_accounts')
    .select('id, user_id, platform, account_name, external_account_id, token_expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to query connected platforms: ${error.message}`);
  }

  return (data || []) as SafePlatformAccount[];
}

export async function recordPlatformPost(
  client: SupabaseClient,
  input: Omit<PlatformPostRow, 'id' | 'created_at' | 'updated_at'>
): Promise<PlatformPostRow> {
  const { data, error } = await client
    .from('platform_posts')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to record platform post: ${error?.message || 'Unknown error'}`);
  }

  return data as PlatformPostRow;
}

export async function listProjectPosts(
  client: SupabaseClient,
  projectId: string
): Promise<PlatformPostRow[]> {
  const { data, error } = await client
    .from('platform_posts')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list project posts: ${error.message}`);
  }

  return (data || []) as PlatformPostRow[];
}
