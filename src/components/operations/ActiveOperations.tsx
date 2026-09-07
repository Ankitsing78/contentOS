import React from 'react';
import { OperationJobItem } from '@/types';
import { OperationCard } from './OperationCard';
import { Icons } from '@/components/ui/Icons';

interface ActiveOperationsProps {
  operations: OperationJobItem[];
}

export function ActiveOperations({ operations }: ActiveOperationsProps) {
  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5" aria-label="Active Operations">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
            <Icons.Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Active Operations</h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Live background pipeline tasks & render jobs
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
          {operations.length} Tasks
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {operations.map((operation) => (
          <OperationCard key={operation.id} operation={operation} />
        ))}
      </div>
    </section>
  );
}
