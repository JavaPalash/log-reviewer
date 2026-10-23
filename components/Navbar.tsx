'use client';

import React from 'react';
import { 
  FileText, 
  ArrowDownUp, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  FileSpreadsheet, 
  Download, 
  Sparkles,
  Layers,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { FilterState } from '../lib/types';

interface NavbarProps {
  filters: FilterState;
  onFilterChange: (update: Partial<FilterState>) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenRcaModal: () => void;
  onOpenPerformance?: () => void;
  activeView?: string;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onLoadSample: (type: 'scm' | 'screen' | 'server') => void;
  isLoadingSample: boolean;
  totalEntriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  filters,
  onFilterChange,
  isDarkMode,
  onToggleDarkMode,
  onOpenRcaModal,
  onOpenPerformance,
  activeView,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onLoadSample,
  isLoadingSample,
  totalEntriesCount,
}) => {
  const isNewestFirst = filters.sortOrder === 'newest';

  const toggleSortOrder = () => {
    const nextOrder = isNewestFirst ? 'oldest' : 'newest';
    onFilterChange({ sortOrder: nextOrder });
    if (typeof window !== 'undefined') {
      localStorage.setItem('flexi_log_sort_order', nextOrder);
    }
  };

  const toggleMask = () => {
    onFilterChange({ maskSensitive: !filters.maskSensitive });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-[#fffdf4]/95 dark:bg-gray-900/95 backdrop-blur border-[#ecebe6] dark:border-gray-800 transition-colors">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 min-h-[4.25rem] py-2 flex items-center justify-between gap-3 flex-wrap lg:flex-nowrap">
        
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3 shrink-0">
          <img 
            src="/flexi-logo.png" 
            alt="Intellinum Flexi Logo" 
            className="h-10 w-auto object-contain drop-shadow-sm shrink-0"
          />
          <div className="border-l border-[#e5e3dc] dark:border-gray-700 pl-3">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <h1 className="font-black text-xl tracking-tight text-[#1B2E59] dark:text-white leading-none">
                Log Reviewer
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#009FE3]/10 text-[#009FE3] dark:text-[#38bdf8] border border-[#009FE3]/40">
                SCM & WMS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap font-medium">
              Screen & Server Log Diagnostic for Oracle Cloud
            </p>
          </div>
        </div>

        {/* Center: Essential Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Flexi Focus Mode Toggle */}
          <button
            onClick={() => onFilterChange({ focusFlexiOnly: !filters.focusFlexiOnly })}
            title={filters.focusFlexiOnly ? "Flexi Focus: Showing Flexi methods, scripts, APIs & errors. Platform noise hidden." : "Showing ALL raw logs including VT100 dumps"}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
              filters.focusFlexiOnly
                ? 'bg-[#009FE3]/10 dark:bg-[#009FE3]/20 text-[#007cb3] dark:text-[#38bdf8] border-[#009FE3] ring-1 ring-[#009FE3]/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-[#e5e3dc] dark:border-gray-700 hover:border-[#009FE3]/50'
            }`}
          >
            <span>🎯</span>
            <span className="hidden sm:inline">
              {filters.focusFlexiOnly ? 'Flexi Focus: ON' : 'Raw Platform Logs: Visible'}
            </span>
          </button>

          {/* Newest First / Oldest First Toggle */}
          <button
            onClick={toggleSortOrder}
            title={isNewestFirst ? "Order: Newest First (Bottom-to-Top) - server log order" : "Order: Oldest First (Top-to-Bottom)"}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border shadow-sm ${
              isNewestFirst
                ? 'bg-[#009FE3]/10 dark:bg-[#009FE3]/20 text-[#007cb3] dark:text-[#38bdf8] border-[#009FE3] ring-1 ring-[#009FE3]/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-[#e5e3dc] dark:border-gray-700 hover:border-[#009FE3]/50'
            }`}
          >
            <ArrowDownUp className={`w-3.5 h-3.5 transition-transform ${isNewestFirst ? 'rotate-180 text-[#009FE3]' : ''}`} />
            <span>
              {isNewestFirst ? (
                <>
                  <strong className="font-bold">Newest First</strong> (Bottom-to-Top)
                </>
              ) : (
                <>
                  <strong className="font-bold">Oldest First</strong> (Top-to-Bottom)
                </>
              )}
            </span>
          </button>

          {/* Mask Sensitive Values Toggle */}
          <button
            onClick={toggleMask}
            title="Toggle masking of tokens, passwords and auth headers"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              filters.maskSensitive
                ? 'bg-[#F37021]/10 dark:bg-[#F37021]/20 text-[#d8580e] dark:text-[#f89553] border-[#F37021]/40'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-[#e5e3dc] dark:border-gray-700 hover:border-[#009FE3]/40'
            }`}
          >
            {filters.maskSensitive ? <EyeOff className="w-3.5 h-3.5 text-[#F37021]" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {filters.maskSensitive ? 'Sensitive: Masked' : 'Sensitive: Visible'}
            </span>
          </button>

          {/* Samples Dropdown */}
          <div className="relative group">
            <button
              disabled={isLoadingSample}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-[#e5e3dc] dark:border-gray-700 hover:border-[#009FE3]/60 flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#009FE3]" />
              <span className="hidden md:inline">Sample Logs</span>
              <span className="text-[10px] text-gray-400">▼</span>
            </button>
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-[#ecebe6] dark:border-gray-700 rounded-xl shadow-xl py-1 hidden group-hover:block z-50">
              <button
                onClick={() => onLoadSample('scm')}
                disabled={isLoadingSample}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex flex-col"
              >
                <span className="font-semibold text-[#007cb3] dark:text-[#38bdf8] flex items-center gap-1">
                  <span className="px-1.5 py-0.2 bg-[#009FE3]/10 text-[10px] rounded font-bold">SCM</span>
                  Oracle SCM Cloud Session
                </span>
                <span className="text-[10px] text-gray-500">Pick Confirm, putSessionObject, DFF query, Fusion APIs</span>
              </button>
              <button
                onClick={() => onLoadSample('screen')}
                disabled={isLoadingSample}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex flex-col border-t border-[#ecebe6] dark:border-gray-700"
              >
                <span className="font-semibold text-[#1B2E59] dark:text-blue-300 flex items-center gap-1">
                  <span className="px-1.5 py-0.2 bg-[#1B2E59]/10 text-[10px] rounded font-bold">WMS</span>
                  Oracle WMS Screen Session
                </span>
                <span className="text-[10px] text-gray-500">WS-G-HK: REST APIs, 404, field events</span>
              </button>
              <button
                onClick={() => onLoadSample('server')}
                disabled={isLoadingSample}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex flex-col border-t border-[#ecebe6] dark:border-gray-700"
              >
                <span className="font-semibold text-rose-600 dark:text-rose-400">Server Error Log</span>
                <span className="text-[10px] text-gray-500">flexi-error: SSH timeout, null pointer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions & Exports */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Performance Check Button */}
          {totalEntriesCount > 0 && onOpenPerformance && (
            <button
              onClick={onOpenPerformance}
              title="Screen & Event Transaction Performance Check"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                activeView === 'performance'
                  ? 'bg-[#F37021] text-white border-[#e06115] shadow-md shadow-[#F37021]/30 ring-2 ring-[#F37021]/20'
                  : 'bg-[#F37021]/10 dark:bg-[#F37021]/20 text-[#d8580e] dark:text-[#f89553] border-[#F37021]/30 hover:bg-[#F37021]/20'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#F37021] fill-[#F37021]/40" />
              <span>Performance Check</span>
            </button>
          )}

          {/* RCA Report Button */}
          {totalEntriesCount > 0 && (
            <button
              onClick={onOpenRcaModal}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#1B2E59] via-[#0E4B8A] to-[#009FE3] hover:from-[#152447] hover:to-[#0089c4] text-white shadow-md shadow-[#009FE3]/20 border border-[#1B2E59] flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F37021]" />
              <span>Generate RCA Report</span>
            </button>
          )}

          {/* Export Dropdown */}
          {totalEntriesCount > 0 && (
            <div className="relative group">
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-[#1B2E59] dark:text-gray-200 border border-[#1B2E59]/30 dark:border-gray-700 hover:border-[#009FE3] hover:text-[#009FE3] flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#009FE3]" />
                <span className="hidden sm:inline">Export</span>
                <span className="text-[10px]">▼</span>
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-[#ecebe6] dark:border-gray-700 rounded-xl shadow-xl py-1 hidden group-hover:block z-50">
                <button
                  onClick={onExportExcel}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={onExportCsv}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#009FE3]" />
                  CSV File (.csv)
                </button>
                <button
                  onClick={onExportPdf}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-[#fffdf4] dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#F37021]" />
                  PDF Document (.pdf)
                </button>
              </div>
            </div>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-gray-600 hover:text-[#1B2E59] dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-[#e5e3dc] dark:border-gray-700 hover:border-[#009FE3]/40 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#1B2E59]" />}
          </button>
        </div>

      </div>
    </header>
  );
};
