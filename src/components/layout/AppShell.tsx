'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>

        {/* Console Operator Footer */}
        <footer className="border-t border-zinc-800/60 py-4 px-6 text-center text-xs font-mono text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          <div>ContentOS Operator Console • Autonomous Architecture Initialized</div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ready for Stage 3 Pipeline
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
