/**
 * ContentOS - Social Publishing Platform Types
 */

import { PlatformType } from './content';

export interface PlatformPublishPayload {
  contentId: string;
  title: string;
  description?: string;
  caption?: string;
  tags?: string[];
  mediaUrls: string[];
  scheduledTime?: string;
  platformSpecificOptions?: Record<string, unknown>;
}

export interface PlatformPublishResult {
  success: boolean;
  platform: PlatformType;
  externalPostId?: string;
  externalUrl?: string;
  publishedAt?: string;
  error?: string;
}

export interface PlatformAccountStatus {
  platform: PlatformType;
  isConnected: boolean;
  accountName?: string;
  accountId?: string;
  tokenExpiresAt?: string;
}
