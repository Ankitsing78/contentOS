'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '@/components/ui/Icons';

interface HeaderProps {
  title?: string;
  onOpenSidebar: () => void;
}

export function Header({ title = 'Command Center', onOpenSidebar }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Hamburger (mobile) + Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 lg:hidden cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Icons.Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs font-mono hidden sm:inline-block">/</span>
          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight">
            {title}
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hidden md:inline-block">
            Autonomous OS
          </span>
        </div>
      </div>

      {/* Right: System Status & User Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* System Online Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-mono tracking-tight hidden xs:inline">System Online</span>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowSettings(false);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            aria-label="View notifications (2 active notices)"
            title="System notices"
          >
            <Icons.Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-100 font-mono text-[11px] uppercase">
                  System Notifications
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                  2 Notices
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-1">
                  <div className="font-semibold text-amber-300 text-[11px] flex items-center gap-1.5">
                    <span>⏸️ Image Generation Paused</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Automated visual generation is temporarily on hold. Production visual specifications remain truthful.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-pink-950/30 border border-pink-800/60 space-y-1">
                  <div className="font-semibold text-pink-300 text-[11px] flex items-center gap-1.5">
                    <span>🎬 Video Prototype Ready</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Isolated video prototype engine is active for script testing in 9:16 vertical MP4 format.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings Popover */}
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => {
              setShowSettings((prev) => !prev);
              setShowNotifications(false);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            aria-label="System settings and diagnostics"
            title="System diagnostics"
          >
            <Icons.Settings className="w-4 h-4" />
          </button>

          {showSettings && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-100 text-[11px] uppercase">
                  System Diagnostics
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Ready
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Core LLM:</span>
                  <span className="text-zinc-200">Gemini 2.5 Flash</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">TTS Engine:</span>
                  <span className="text-zinc-200">Gemini 3.1 Flash TTS</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Video Renderer:</span>
                  <span className="text-zinc-200">FFmpeg 8.0.1 (H.264)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Visual Provider:</span>
                  <span className="text-amber-400 font-semibold">Paused / On Hold</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Storage Bucket:</span>
                  <span className="text-zinc-200">content-assets</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User / Operator Avatar */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
              setShowSettings(false);
            }}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 shadow-sm cursor-pointer hover:border-zinc-500 transition-colors"
            title="Operator profile"
            aria-label="User profile menu"
          >
            OP
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-3 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
              <div className="pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-100 block">Operator Console</span>
                <span className="text-[10px] font-mono text-zinc-500">admin@contentos.internal</span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 py-1">
                Role: <span className="text-indigo-300">Autonomous Orchestrator</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
