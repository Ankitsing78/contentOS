/**
 * ContentOS - Supabase Storage Implementation
 * Implements IStorageProvider using Supabase Storage buckets.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IStorageProvider, StorageUploadResult } from './provider';

export const CONTENT_ASSETS_BUCKET = 'content-assets';

export class SupabaseStorageProvider implements IStorageProvider {
  readonly providerId = 'supabase' as const;

  constructor(private client: SupabaseClient) {}

  async upload(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string
  ): Promise<StorageUploadResult> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error || !data) {
      throw new Error(`Supabase Storage upload failed: ${error?.message || 'Unknown error'}`);
    }

    return {
      path: data.path,
      sizeBytes: fileBuffer.byteLength,
      mimeType: contentType,
    };
  }

  async createSignedUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message || 'Unknown error'}`);
    }

    return data.signedUrl;
  }

  async delete(bucket: string, filePath: string): Promise<boolean> {
    const { error } = await this.client.storage.from(bucket).remove([filePath]);
    if (error) {
      throw new Error(`Failed to delete storage asset: ${error.message}`);
    }
    return true;
  }

  buildPath(
    userId: string,
    projectId: string,
    assetType: 'audio' | 'images' | 'video' | 'thumbnails' | 'subtitles' | 'documents',
    filename: string
  ): string {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${userId}/${projectId}/${assetType}/${cleanFilename}`;
  }
}
