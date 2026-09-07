/**
 * ContentOS - Modular Social Publishing Platform Interface
 * YouTube, Instagram, X (Twitter) official API integrations adhere to this contract.
 */

import {
  PlatformType,
  PlatformPublishPayload,
  PlatformPublishResult,
  PlatformAccountStatus,
} from '@/types';

export interface ISocialPlatform {
  readonly platform: PlatformType;
  getAccountStatus(): Promise<PlatformAccountStatus>;
  publish(payload: PlatformPublishPayload): Promise<PlatformPublishResult>;
}

export function isPlatformConfigured(platform: PlatformType): boolean {
  switch (platform) {
    case 'youtube':
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case 'instagram':
      return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
    case 'x':
      return Boolean(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET);
    default:
      return false;
  }
}
