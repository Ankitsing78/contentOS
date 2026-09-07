/**
 * ContentOS - Content Projects Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ContentProjectRow,
  ContentProjectInsert,
  ContentProjectUpdate,
  ContentIdeaRow,
  ContentIdeaInsert,
  ContentScriptRow,
  ContentScriptInsert,
} from '@/types';

export async function createContentProject(
  client: SupabaseClient,
  input: ContentProjectInsert
): Promise<ContentProjectRow> {
  const { data, error } = await client
    .from('content_projects')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create content project: ${error?.message || 'Unknown error'}`);
  }

  return data as ContentProjectRow;
}

export async function getContentProject(
  client: SupabaseClient,
  projectId: string
): Promise<ContentProjectRow | null> {
  const { data, error } = await client
    .from('content_projects')
    .select()
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch project: ${error.message}`);
  }

  return data as ContentProjectRow | null;
}

export async function listContentProjects(
  client: SupabaseClient,
  userId: string,
  limit: number = 20
): Promise<ContentProjectRow[]> {
  const { data, error } = await client
    .from('content_projects')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return (data || []) as ContentProjectRow[];
}

export async function updateContentProject(
  client: SupabaseClient,
  projectId: string,
  updates: ContentProjectUpdate
): Promise<ContentProjectRow> {
  const { data, error } = await client
    .from('content_projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update project: ${error?.message || 'Unknown error'}`);
  }

  return data as ContentProjectRow;
}

export async function createContentIdea(
  client: SupabaseClient,
  input: ContentIdeaInsert
): Promise<ContentIdeaRow> {
  const { data, error } = await client
    .from('content_ideas')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save content idea: ${error?.message || 'Unknown error'}`);
  }

  return data as ContentIdeaRow;
}

export async function createContentScript(
  client: SupabaseClient,
  input: ContentScriptInsert
): Promise<ContentScriptRow> {
  const { data, error } = await client
    .from('content_scripts')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save content script: ${error?.message || 'Unknown error'}`);
  }

  return data as ContentScriptRow;
}
