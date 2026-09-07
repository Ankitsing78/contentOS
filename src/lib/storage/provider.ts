/**
 * ContentOS - Modular Storage Provider Interface
 * Abstraction for uploading, retrieving, and signing media assets (thumbnails, audio, video).
 * Enables seamless switching between Supabase Storage, AWS S3, Cloudflare R2, etc.
 */

export interface StorageUploadResult {
  path: string;
  sizeBytes: number;
  mimeType?: string;
}

export interface IStorageProvider {
  readonly providerId: 'supabase' | 's3' | 'r2' | 'mock';

  /**
   * Uploads binary file data to private bucket
   */
  upload(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string
  ): Promise<StorageUploadResult>;

  /**
   * Generates a time-limited signed URL for private asset access
   */
  createSignedUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds?: number
  ): Promise<string>;

  /**
   * Deletes a file from storage
   */
  delete(bucket: string, filePath: string): Promise<boolean>;

  /**
   * Constructs the standardized logical storage path
   * e.g., content-assets/{userId}/{projectId}/{assetType}/{filename}
   */
  buildPath(
    userId: string,
    projectId: string,
    assetType: 'audio' | 'images' | 'video' | 'thumbnails' | 'subtitles' | 'documents',
    filename: string
  ): string;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}
