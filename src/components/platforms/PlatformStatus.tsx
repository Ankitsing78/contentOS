import React from 'react';
import { PlatformConnectionItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface PlatformStatusProps {
  platforms: PlatformConnectionItem[];
}

export function PlatformStatus({ platforms }: PlatformStatusProps) {
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Icons.YouTube className="w-5 h-5 text-red-500" />;
      case 'instagram':
        return <Icons.Instagram className="w-5 h-5 text-pink-500" />;
      case 'x':
        return <Icons.XTwitter className="w-5 h-5 text-zinc-100" />;
      default:
        return <Icons.Share2 className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5" aria-label="Connected Platforms">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
            <Icons.Send className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Connected Platforms</h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Official API distribution channels (OAuth Placeholder)
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
          OAuth Stage 4
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {platforms.map((plat) => (
          <div
            key={plat.platform}
            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              plat.isConnected
                ? 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                : 'bg-zinc-950/40 border-zinc-900/90 text-zinc-500'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 shadow-inner">
                    {getPlatformIcon(plat.platform)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">{plat.name}</h4>
                    {plat.accountHandle && (
                      <p className="text-xs text-zinc-400 font-mono">{plat.accountHandle}</p>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    plat.isConnected
                      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/60'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  }`}
                >
                  <span
                    className={`w-1 h-1 rounded-full ${
                      plat.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'
                    }`}
                  />
                  {plat.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {plat.followers && (
                <div className="text-xs text-zinc-400 mb-2 font-mono">
                  {plat.followers}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
              <span className="truncate">{plat.notice}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
