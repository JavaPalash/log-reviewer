'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { LogUploader } from '../components/LogUploader';
import { Dashboard } from '../components/Dashboard';
import { FilterBar } from '../components/FilterBar';
import { ResultsTable } from '../components/ResultsTable';
import { SessionTimeline } from '../components/SessionTimeline';
import { DetailPanel } from '../components/DetailPanel';
import { RcaReportModal } from '../components/RcaReportModal';
import { ParsedLogFile, LogEntry, FilterState } from '../lib/types';
import { applyFiltersAndSort } from '../lib/filterUtils';
import { parseLogInBackground } from '../lib/workerClient';
import { exportToExcel, exportToCsv, exportToPdf } from '../lib/exportUtils';
import { Table, GitCommit, LayoutDashboard, Sparkles, AlertCircle } from 'lucide-react';

export default function Home() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Files & Entries state
  const [files, setFiles] = useState<ParsedLogFile[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState({ percent: 0, message: '' });
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Active view tab: 'table' | 'timeline' | 'dashboard'
  const [activeView, setActiveView] = useState<'table' | 'timeline' | 'dashboard'>('table');

  // Active selected entry for DetailPanel
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  // Selected session for timeline view
  const [timelineSessionId, setTimelineSessionId] = useState<string>('');

  // RCA Modal state
  const [isRcaModalOpen, setIsRcaModalOpen] = useState(false);

  // Global Filter State with default: NEWEST FIRST (bottom-to-top) & FLEXI FOCUS ON
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    users: [],
    sessions: [],
    apiMethods: [],
    responseCodes: [],
    logLevels: [],
    fields: [],
    events: [],
    screens: [],
    onlyFailures: false,
    sortOrder: 'newest', // DEFAULT: Newest first (bottom-to-top)
    maskSensitive: false,
    focusFlexiOnly: true, // DEFAULT: ON (focuses on Flexi methods, scripts, APIs, errors)
    entryTypes: [],
    appTypes: [],
    tenants: [],
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSort = localStorage.getItem('flexi_log_sort_order');
      if (savedSort === 'newest' || savedSort === 'oldest') {
        setFilters(f => ({ ...f, sortOrder: savedSort }));
      }
      const savedTheme = localStorage.getItem('flexi_theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('flexi_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('flexi_theme', 'light');
      }
      return next;
    });
  };

  // Flatten all entries across files
  const allEntries = useMemo(() => {
    const list: LogEntry[] = [];
    for (const f of files) {
      list.push(...f.entries);
    }
    return list;
  }, [files]);

  // Apply filters and sorting
  const filteredEntries = useMemo(() => {
    return applyFiltersAndSort(allEntries, filters);
  }, [allEntries, filters]);

  // Filter change handler
  const handleFilterChange = useCallback((update: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...update }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      search: '',
      users: [],
      sessions: [],
      apiMethods: [],
      responseCodes: [],
      logLevels: [],
      fields: [],
      events: [],
      screens: [],
      onlyFailures: false,
      dateStart: undefined,
      dateEnd: undefined,
      focusFlexiOnly: true,
      entryTypes: [],
      appTypes: [],
      tenants: [],
    }));
  }, []);

  // Upload handler for new files
  const handleFilesAdded = async (newFiles: File[]) => {
    setIsParsing(true);

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      setParseProgress({ percent: 10, message: `Reading file ${i + 1}/${newFiles.length}: ${file.name}...` });

      try {
        const text = await file.text();
        const fileId = `file-${Date.now()}-${i}`;

        const parsed = await parseLogInBackground(text, file.name, fileId, {
          onProgress: (pct, msg) => {
            setParseProgress({ percent: pct, message: `${file.name}: ${msg}` });
          }
        });

        setFiles(prev => [...prev, parsed]);
      } catch (err) {
        console.error('Failed to parse file:', file.name, err);
        alert(`Failed to parse file ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    setIsParsing(false);
    setParseProgress({ percent: 100, message: 'Done' });
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedEntry?.fileId === fileId) {
      setSelectedEntry(null);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedEntry(null);
  };

  // Sample Log Loader
  const handleLoadSample = async (type: 'scm' | 'screen' | 'server') => {
    setIsLoadingSample(true);
    setIsParsing(true);
    let fileName = 'sample-flexi-screen-session.log';
    if (type === 'scm') {
      fileName = 'sample-flexi-scm-session.log';
    } else if (type === 'server') {
      fileName = 'sample-flexi-server-error.log';
    }

    setParseProgress({ percent: 20, message: `Loading ${fileName}...` });

    try {
      const res = await fetch(`/sample-logs/${fileName}`);
      if (!res.ok) throw new Error(`Could not fetch sample log: ${res.statusText}`);
      const text = await res.text();

      setParseProgress({ percent: 50, message: 'Parsing log data...' });
      const parsed = await parseLogInBackground(text, fileName, `sample-${Date.now()}`);

      setFiles(prev => [...prev, parsed]);
    } catch (err) {
      console.error('Error loading sample:', err);
      alert(`Could not load sample log: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingSample(false);
      setIsParsing(false);
    }
  };

  // Jump helpers
  const handleJumpToLatest = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToOldest = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  // Navigation inside Detail Panel respecting current sort order
  const currentDetailIndex = useMemo(() => {
    if (!selectedEntry) return -1;
    return filteredEntries.findIndex(e => e.id === selectedEntry.id);
  }, [selectedEntry, filteredEntries]);

  const handleNavigateDetail = (direction: 'prev' | 'next') => {
    if (currentDetailIndex === -1) return;
    if (direction === 'prev' && currentDetailIndex > 0) {
      setSelectedEntry(filteredEntries[currentDetailIndex - 1]);
    } else if (direction === 'next' && currentDetailIndex < filteredEntries.length - 1) {
      setSelectedEntry(filteredEntries[currentDetailIndex + 1]);
    }
  };

  // Auto-load sample if user opens empty app for immediate wow effect?
  // We provide clear one-click buttons so the user is in control.

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Top Navigation */}
      <Navbar
        filters={filters}
        onFilterChange={handleFilterChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenRcaModal={() => setIsRcaModalOpen(true)}
        onExportExcel={() => exportToExcel(filteredEntries)}
        onExportCsv={() => exportToCsv(filteredEntries)}
        onExportPdf={() => exportToPdf(filteredEntries)}
        onLoadSample={handleLoadSample}
        isLoadingSample={isLoadingSample}
        totalEntriesCount={allEntries.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Upload Zone */}
        <LogUploader
          files={files}
          onFilesAdded={handleFilesAdded}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
          isParsing={isParsing}
          parseProgress={parseProgress}
          onLoadSample={handleLoadSample}
        />

        {/* Dashboard & Issue Insights (visible when files are loaded) */}
        {allEntries.length > 0 && (
          <Dashboard
            entries={allEntries}
            filteredEntries={filteredEntries}
            onSelectEntry={(entry) => setSelectedEntry(entry)}
            onFilterChange={handleFilterChange}
            sortOrder={filters.sortOrder}
          />
        )}

        {/* Filters and View Controls (visible when files are loaded) */}
        {allEntries.length > 0 && (
          <div className="space-y-4">
            
            {/* View Tabs */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    activeView === 'table'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Table className="w-4 h-4" />
                  <span>Results Table</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                    {filteredEntries.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveView('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    activeView === 'timeline'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <GitCommit className="w-4 h-4" />
                  <span>Session Timeline</span>
                </button>
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>Active Sort:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {filters.sortOrder === 'newest' ? 'Newest First (Bottom-to-Top)' : 'Oldest First (Top-to-Bottom)'}
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <FilterBar
              entries={allEntries}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              onJumpToLatest={handleJumpToLatest}
              onJumpToOldest={handleJumpToOldest}
            />

            {/* View 1: Results Table */}
            {activeView === 'table' && (
              <ResultsTable
                entries={filteredEntries}
                onSelectEntry={(entry) => setSelectedEntry(entry)}
                onFilterChange={handleFilterChange}
                filters={filters}
              />
            )}

            {/* View 2: Session Timeline */}
            {activeView === 'timeline' && (
              <SessionTimeline
                entries={allEntries}
                onSelectEntry={(entry) => setSelectedEntry(entry)}
                selectedSessionId={timelineSessionId}
                onSessionChange={(s) => setTimelineSessionId(s)}
                defaultSortOrder={filters.sortOrder}
              />
            )}

          </div>
        )}

      </main>

      {/* Slide-over Detail Panel */}
      <DetailPanel
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onNavigate={handleNavigateDetail}
        hasPrev={currentDetailIndex > 0}
        hasNext={currentDetailIndex < filteredEntries.length - 1}
        currentIndex={currentDetailIndex}
        totalCount={filteredEntries.length}
      />

      {/* RCA Report Generator Modal */}
      <RcaReportModal
        isOpen={isRcaModalOpen}
        onClose={() => setIsRcaModalOpen(false)}
        entries={filteredEntries}
        analyzedFiles={files.map(f => f.fileName)}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-4 text-center text-xs text-gray-400">
        <p>Log Reviewer • Built for Intellinum Flexi Screen & Server Log Analysis • Deploys directly on Vercel</p>
      </footer>

    </div>
  );
}
