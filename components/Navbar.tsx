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
  CheckCircle2
} from 'lucide-react';
import { FilterState } from '../lib/types';

interface NavbarProps {
  filters: FilterState;
  onFilterChange: (update: Partial<FilterState>) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenRcaModal: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onLoadSample: (type: 'screen' | 'server') => void;
  isLoadingSample: boolean;
  totalEntriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  filters,
  onFilterChange,
  isDarkMode,
  onToggleDarkMode,
  onOpenRcaModal,
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
    <header className="sticky top-0 z-40 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg tracking-tight text-gray-900 dark:text-white">
                Log Reviewer
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                Flexi WMS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Screen Log Analyzer & RCA Diagnostic
            </p>
          </div>
        </div>

        {/* Center: Essential Controls */}
        <div className="flex items-center gap-2">
          {/* Newest First / Oldest First Toggle */}
          <button
            onClick={toggleSortOrder}
            title={isNewestFirst ? "Order: Newest First (Bottom-to-Top) - server log order" : "Order: Oldest First (Top-to-Bottom)"}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border shadow-sm ${
              isNewestFirst
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
            }`}
          >
            <ArrowDownUp className={`w-3.5 h-3.5 transition-transform ${isNewestFirst ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`} />
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
                ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            {filters.maskSensitive ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {filters.maskSensitive ? 'Sensitive: Masked' : 'Sensitive: Visible'}
            </span>
          </button>

          {/* Samples Dropdown */}
          <div className="relative group">
            <button
              disabled={isLoadingSample}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline">Sample Logs</span>
              <span className="text-[10px] text-gray-400">▼</span>
            </button>
            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
              <button
                onClick={() => onLoadSample('screen')}
                disabled={isLoadingSample}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 flex flex-col"
              >
                <span className="font-semibold text-blue-600 dark:text-blue-400">Screen Session Log</span>
                <span className="text-[10px] text-gray-500">WS-G-HK: REST APIs, 404, field events</span>
              </button>
              <button
                onClick={() => onLoadSample('server')}
                disabled={isLoadingSample}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 flex flex-col border-t border-gray-100 dark:border-gray-700"
              >
                <span className="font-semibold text-rose-600 dark:text-rose-400">Server Error Log</span>
                <span className="text-[10px] text-gray-500">flexi-error: SSH timeout, null pointer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions & Exports */}
        <div className="flex items-center gap-2">
          {/* RCA Report Button */}
          {totalEntriesCount > 0 && (
            <button
              onClick={onOpenRcaModal}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Generate RCA Report</span>
            </button>
          )}

          {/* Export Dropdown */}
          {totalEntriesCount > 0 && (
            <div className="relative group">
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Export</span>
                <span className="text-[10px]">▼</span>
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
                <button
                  onClick={onExportExcel}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={onExportCsv}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  CSV File (.csv)
                </button>
                <button
                  onClick={onExportPdf}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-rose-600" />
                  PDF Document (.pdf)
                </button>
              </div>
            </div>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>

      </div>
    </header>
  );
};
