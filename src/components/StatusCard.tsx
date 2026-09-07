import React from 'react';

interface StatusCardProps {
  title: string;
  category: string;
  description: string;
  statusText: string;
  statusType: 'configured' | 'pending' | 'ready';
  icon?: string;
}

export function StatusCard({
  title,
  category,
  description,
  statusText,
  statusType,
  icon,
}: StatusCardProps) {
  const statusStyles = {
    ready: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    configured: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-xl p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {icon}
            </span>
          )}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {category}
            </span>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
          </div>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusStyles[statusType]}`}
        >
          {statusText}
        </span>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
