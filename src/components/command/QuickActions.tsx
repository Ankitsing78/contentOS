'use client';

import React from 'react';
import { QuickActionItem } from '@/types';
import { Icons } from '@/components/ui/Icons';

interface QuickActionsProps {
  presets: QuickActionItem[];
  onSelectAction: (prompt: string) => void;
}

export function QuickActions({ presets, onSelectAction }: QuickActionsProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'film':
        return <Icons.Film className="w-3.5 h-3.5 text-pink-400" />;
      case 'youtube':
        return <Icons.YouTube className="w-3.5 h-3.5 text-red-400" />;
      case 'sparkles':
        return <Icons.Sparkles className="w-3.5 h-3.5 text-amber-400" />;
      case 'search':
        return <Icons.Search className="w-3.5 h-3.5 text-cyan-400" />;
      case 'repeat':
        return <Icons.Repeat className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Icons.Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mr-1">
        Quick Actions:
      </span>
      {presets.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onSelectAction(action.promptTemplate)}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 transition-all duration-150 cursor-pointer shadow-sm active:scale-98"
          aria-label={action.label}
        >
          {getIcon(action.iconName)}
          <span>{action.label}</span>
          <Icons.ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
        </button>
      ))}
    </div>
  );
}
