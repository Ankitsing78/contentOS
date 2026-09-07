import React from 'react';
import { RecentContentItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface RecentContentProps {
  items: RecentContentItem[];
}

export function RecentContent({ items }: RecentContentProps) {
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Icons.YouTube key={platform} className="w-3.5 h-3.5 text-red-400" />;
      case 'instagram':
        return <Icons.Instagram key={platform} className="w-3.5 h-3.5 text-pink-400" />;
      case 'x':
        return <Icons.XTwitter key={platform} className="w-3.5 h-3.5 text-zinc-300" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: RecentContentItem['status']) => {
    switch (status) {
      case 'Published':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/60 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            Published
          </span>
        );
      case 'Processing':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/50 text-indigo-300 border border-indigo-900/60 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
            Processing
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-500" />
            Draft
          </span>
        );
    }
  };

  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5" aria-label="Recent Content">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
            <Icons.Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Recent Content</h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Completed and in-flight media packages
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('command-center-input');
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-indigo-950/30"
          title="Jump to Command Center"
        >
          <span>View All Projects</span>
          <Icons.ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              <th className="pb-2.5 font-medium">Title & Format</th>
              <th className="pb-2.5 font-medium">Platforms</th>
              <th className="pb-2.5 font-medium">Status</th>
              <th className="pb-2.5 font-medium text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => {
                  const el = document.getElementById('command-center-input');
                  if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="hover:bg-zinc-900/60 cursor-pointer transition-colors group"
                title={`Click to inspect ${item.title}`}
              >
                <td className="py-3 pr-4">
                  <div className="font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                    <span>{item.type}</span>
                    {item.duration && (
                      <>
                        <span>•</span>
                        <span>{item.duration}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {item.platforms.map(getPlatformIcon)}
                  </div>
                </td>
                <td className="py-3 pr-4">{getStatusBadge(item.status)}</td>
                <td className="py-3 text-right font-mono text-[11px] text-zinc-400">
                  {item.createdAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              const el = document.getElementById('command-center-input');
              if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 cursor-pointer hover:bg-zinc-900/90 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-xs font-semibold text-zinc-100">{item.title}</h4>
              {getStatusBadge(item.status)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/50 font-mono">
              <div className="flex items-center gap-2">
                <span>{item.type}</span>
                <div className="flex items-center gap-1">
                  {item.platforms.map(getPlatformIcon)}
                </div>
              </div>
              <span>{item.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
