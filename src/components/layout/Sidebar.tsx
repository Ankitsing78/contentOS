'use client';

import React from 'react';
import { Icons } from '@/components/ui/Icons';

export interface NavItem {
  name: string;
  href: string;
  icon: keyof typeof Icons;
  badge?: string;
  isActive?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

export function Sidebar({ isOpen, onClose, currentPath = '/' }: SidebarProps) {
  const navigation: NavItem[] = [
    { name: 'Command Center', href: '/', icon: 'LayoutGrid', isActive: currentPath === '/' },
    { name: 'Projects', href: '#projects', icon: 'Folder' },
    { name: 'Content Pipeline', href: '#pipeline', icon: 'Layers', badge: '1 Active' },
    { name: 'Publishing', href: '#publishing', icon: 'Send' },
    { name: 'Analytics', href: '#analytics', icon: 'BarChart3' },
    { name: 'AI Agents', href: '#agents', icon: 'Bot', badge: '7 Online' },
    { name: 'Automations', href: '#automations', icon: 'Workflow' },
    { name: 'Settings', href: '#settings', icon: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center text-zinc-100 font-mono font-bold text-xs shadow-inner">
              <span className="text-indigo-400">COS</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-zinc-100 flex items-center gap-1.5">
                ContentOS
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Core v0.1 • Autonomous
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 lg:hidden"
            aria-label="Close navigation sidebar"
          >
            <Icons.XClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            System Workspace
          </div>
          {navigation.map((item) => {
            const IconComponent = Icons[item.icon] || Icons.LayoutGrid;
            return (
              <a
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 ${
                  item.isActive
                    ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm border border-zinc-700/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`transition-colors duration-150 ${
                      item.isActive
                        ? 'text-indigo-400'
                        : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      item.isActive
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>

        {/* Sidebar Footer / System Spec */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-zinc-400 font-medium">Pipeline Status</span>
              <span className="font-mono text-emerald-400 text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Active
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1 mb-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-1 rounded-full transition-all duration-300"
                style={{ width: '64%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>Jobs running</span>
              <span className="text-zinc-300">2 operations</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
