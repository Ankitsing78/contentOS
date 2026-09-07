import React from 'react';

export function Navbar() {
  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
            COS
          </div>
          <div>
            <span className="font-bold text-zinc-900 dark:text-white tracking-tight text-base">
              ContentOS
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-900/50">
              v0.1.0 Initialized
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Core Architecture Ready
          </span>
        </div>
      </div>
    </header>
  );
}
