'use client';

import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Timer, 
  Clock, 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronRight, 
  ChevronUp, 
  Download, 
  Layers, 
  Server, 
  Code, 
  Sparkles, 
  ArrowUpDown, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Barcode,
  Terminal,
  Activity
} from 'lucide-react';
import { LogEntry, ParsedLogFile } from '../lib/types';
import { ScreenTransaction, ScreenEventDetail } from '../lib/performanceTypes';
import { extractScreenTransactions, calculatePerformanceSummary, formatDuration, formatShortDuration } from '../lib/performanceUtils';

interface PerformanceCheckProps {
  files: ParsedLogFile[];
  entries: LogEntry[];
  defaultSortOrder?: 'newest' | 'oldest';
}

export const PerformanceCheck: React.FC<PerformanceCheckProps> = ({
  files,
  entries,
  defaultSortOrder = 'newest',
}) => {
  // Extract all screen transactions from files/entries
  const allTransactions = useMemo(() => {
    return extractScreenTransactions(files.length > 0 ? files : entries);
  }, [files, entries]);

  // UI state
  const [selectedScreenFilter, setSelectedScreenFilter] = useState<string>('ALL');
  const [systemFilter, setSystemFilter] = useState<'ALL' | 'SCM' | 'WMS'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<'slowest' | 'fastest' | 'newest' | 'oldest'>('slowest');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [eventSearchTerm, setEventSearchTerm] = useState<string>('');
  const [eventFilterType, setEventFilterType] = useState<'ALL' | 'SLOW' | 'API' | 'SCRIPT' | 'SSH'>('ALL');

  // Summary statistics
  const summary = useMemo(() => {
    return calculatePerformanceSummary(allTransactions);
  }, [allTransactions]);

  // Unique screen names for dropdown
  const screenOptions = useMemo(() => {
    const counts: Record<string, { count: number; appType: string }> = {};
    for (const tx of allTransactions) {
      if (!counts[tx.screenName]) {
        counts[tx.screenName] = { count: 0, appType: tx.appType };
      }
      counts[tx.screenName].count++;
    }
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  }, [allTransactions]);

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let list = [...allTransactions];

    // Screen filter
    if (selectedScreenFilter !== 'ALL') {
      list = list.filter(tx => tx.screenName === selectedScreenFilter);
    }

    // System filter
    if (systemFilter !== 'ALL') {
      list = list.filter(tx => tx.appType === systemFilter);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(tx => 
        tx.screenName.toLowerCase().includes(q) ||
        tx.screenCode.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        tx.sessionId.toLowerCase().includes(q) ||
        tx.slowestEventName.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortOption === 'slowest') return b.totalDurationMs - a.totalDurationMs;
      if (sortOption === 'fastest') return a.totalDurationMs - b.totalDurationMs;
      if (sortOption === 'newest') return b.startTimeMs - a.startTimeMs;
      if (sortOption === 'oldest') return a.startTimeMs - b.startTimeMs;
      return 0;
    });

    return list;
  }, [allTransactions, selectedScreenFilter, systemFilter, searchTerm, sortOption]);

  // Selected transaction for details
  const activeTx = useMemo(() => {
    return allTransactions.find(t => t.id === expandedTxId) || null;
  }, [allTransactions, expandedTxId]);

  // Filtered events inside active transaction
  const filteredEvents = useMemo(() => {
    if (!activeTx) return [];
    let evs = [...activeTx.events];

    if (eventFilterType === 'SLOW') {
      evs = evs.filter(e => e.durationMs >= 1000);
    } else if (eventFilterType === 'API') {
      evs = evs.filter(e => e.event === 'API_CALL');
    } else if (eventFilterType === 'SCRIPT') {
      evs = evs.filter(e => e.event.includes('Script') || e.event.includes('script') || e.event === 'onFocus' || e.event === 'onExit' || e.event === 'onKeyPress' || e.event === 'onClick');
    } else if (eventFilterType === 'SSH') {
      evs = evs.filter(e => e.isReportedDuration && e.details.includes('SSH'));
    }

    if (eventSearchTerm.trim()) {
      const q = eventSearchTerm.toLowerCase();
      evs = evs.filter(e => 
        e.field.toLowerCase().includes(q) ||
        e.event.toLowerCase().includes(q) ||
        (e.value && e.value.toLowerCase().includes(q)) ||
        e.details.toLowerCase().includes(q)
      );
    }

    return evs;
  }, [activeTx, eventFilterType, eventSearchTerm]);

  // Export performance report as CSV
  const handleExportCsv = () => {
    if (allTransactions.length === 0) return;

    const headers = [
      'Screen Name',
      'Screen Code',
      'System Type',
      'User',
      'Session ID',
      'Start Time',
      'End Time',
      'Total Duration (ms)',
      'Total Duration (Formatted)',
      'Events Count',
      'Max Event Duration (ms)',
      'Slowest Event',
      'Status'
    ];

    const rows = allTransactions.map(tx => [
      `"${tx.screenName.replace(/"/g, '""')}"`,
      `"${tx.screenCode.replace(/"/g, '""')}"`,
      `"${tx.appType}"`,
      `"${tx.userName}"`,
      `"${tx.sessionId}"`,
      `"${tx.startTime}"`,
      `"${tx.endTime}"`,
      tx.totalDurationMs,
      `"${tx.totalDurationFormatted}"`,
      tx.eventsCount,
      tx.maxEventDurationMs,
      `"${tx.slowestEventName.replace(/"/g, '""')}"`,
      `"${tx.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `screen_performance_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper for duration badge styling
  const getDurationBadgeClass = (ms: number) => {
    if (ms >= 10000) {
      return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold';
    }
    if (ms >= 2000) {
      return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold';
    }
    return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-medium';
  };

  const getEventDurationBadge = (ev: ScreenEventDetail) => {
    const ms = ev.durationMs;
    if (ms >= 2500) {
      return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold';
    }
    if (ms >= 1000) {
      return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold';
    }
    if (ms >= 300) {
      return 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800';
    }
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <Zap className="w-6 h-6 text-amber-300 fill-amber-300/30" />
            </div>
            <h2 className="text-xl font-black tracking-tight">
              Screen & Event Performance Check
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/20">
              {allTransactions.length} Screen Transactions
            </span>
          </div>
          <p className="text-xs text-blue-100 max-w-2xl">
            Calculates exact duration for Oracle Cloud <strong>SCM</strong> screens (via <code className="bg-blue-900/60 px-1 py-0.5 rounded text-amber-200">openApplication</code> to <code className="bg-blue-900/60 px-1 py-0.5 rounded text-amber-200">closeApplication</code>) and Oracle <strong>WMS</strong> RF screens (via terminal menu selection & render), with per-event response times (<code className="bg-blue-900/60 px-1 py-0.5 rounded text-amber-200">onFocus</code>, <code className="bg-blue-900/60 px-1 py-0.5 rounded text-amber-200">onExit</code>, <code className="bg-blue-900/60 px-1 py-0.5 rounded text-amber-200">SendKey</code>, and API calls).
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={allTransactions.length === 0}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-blue-900 hover:bg-blue-50 shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-blue-700" />
          <span>Export Performance CSV</span>
        </button>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        
        {/* Metric 1: Total Screen Transactions */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Total Transactions</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {summary.totalTransactions}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Across {summary.screenNames.length} distinct screen definitions
          </div>
        </div>

        {/* Metric 2: Average Screen Duration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Average Screen Time</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600 dark:text-purple-400">
            {summary.avgDurationFormatted}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            From open to close/exit
          </div>
        </div>

        {/* Metric 3: Slowest Screen */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Slowest Screen</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-sm font-bold text-gray-900 dark:text-white truncate" title={summary.slowestScreen}>
            {summary.slowestScreen}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Peak transaction latency
          </div>
        </div>

        {/* Metric 4: Total Events Triggered */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Total Events</span>
            <Activity className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-teal-600 dark:text-teal-400">
            {summary.totalEventsCount}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            onFocus, onExit, SSH, APIs, scripts
          </div>
        </div>

        {/* Metric 5: Average Event Response */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Avg Event Time</span>
            <Timer className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {summary.avgEventDurationMs} ms
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Per individual step triggered
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Screen title, technical code, user, or slowest event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Screen Name Dropdown Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedScreenFilter}
              onChange={(e) => setSelectedScreenFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Screens ({allTransactions.length})</option>
              {screenOptions.map(([name, info]) => (
                <option key={name} value={name}>
                  {name} ({info.count}) - {info.appType}
                </option>
              ))}
            </select>

            {/* System Selector */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <button
                onClick={() => setSystemFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  systemFilter === 'ALL'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSystemFilter('SCM')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  systemFilter === 'SCM'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-teal-700 dark:text-teal-400 hover:bg-teal-50'
                }`}
              >
                SCM
              </button>
              <button
                onClick={() => setSystemFilter('WMS')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  systemFilter === 'WMS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50'
                }`}
              >
                WMS
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-medium text-gray-800 dark:text-gray-200"
            >
              <option value="slowest">Sort: Slowest First (Highest ms)</option>
              <option value="fastest">Sort: Fastest First</option>
              <option value="newest">Sort: Newest First (Latest)</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>

          </div>

        </div>

        {/* Active Filter Indicators */}
        {(selectedScreenFilter !== 'ALL' || systemFilter !== 'ALL' || searchTerm) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
            <span className="text-[11px] text-gray-400">Filtering:</span>
            {selectedScreenFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px]">
                <span>Screen: <strong>{selectedScreenFilter}</strong></span>
                <button onClick={() => setSelectedScreenFilter('ALL')}><X className="w-3 h-3 ml-1" /></button>
              </span>
            )}
            {systemFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px]">
                <span>System: <strong>{systemFilter}</strong></span>
                <button onClick={() => setSystemFilter('ALL')}><X className="w-3 h-3 ml-1" /></button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px]">
                <span>Search: <strong>{searchTerm}</strong></span>
                <button onClick={() => setSearchTerm('')}><X className="w-3 h-3 ml-1" /></button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedScreenFilter('ALL');
                setSystemFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold ml-2"
            >
              Clear All Filters
            </button>
          </div>
        )}

      </div>

      {/* Screen Transactions Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Screen Transactions Performance Table
            </h3>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              Showing {filteredTransactions.length} of {allTransactions.length}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            Click any row or "Details" to inspect all triggered events & timings
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50/80 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Screen Name / Title</th>
                <th className="py-2.5 px-3">System</th>
                <th className="py-2.5 px-3">User & Session</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">End Time</th>
                <th className="py-2.5 px-3">Total Time (Duration)</th>
                <th className="py-2.5 px-3 text-center">Events Triggered</th>
                <th className="py-2.5 px-3">Slowest Step in Screen</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    <p className="text-sm">No screen transactions found matching the selected filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => {
                  const isExpanded = expandedTxId === tx.id;
                  const maxTxDuration = summary.maxDurationMs || 1;
                  const durationPct = Math.min(100, Math.max(5, (tx.totalDurationMs / maxTxDuration) * 100));

                  return (
                    <React.Fragment key={tx.id}>
                      <tr
                        onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? 'bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                            : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3 px-3 text-center font-mono text-gray-400 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Screen Name & Code */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-900 dark:text-white text-xs">
                              {tx.screenName}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={tx.screenCode}>
                              {tx.screenCode}
                            </span>
                          </div>
                        </td>

                        {/* System Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {tx.appType === 'SCM' ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                              SCM Cloud
                            </span>
                          ) : tx.appType === 'WMS' ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                              WMS RF
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </td>

                        {/* User & Session */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              {tx.userName || 'Unknown User'}
                            </span>
                            <span className="font-mono text-gray-400 text-[10px]">
                              Sess: {tx.sessionId || 'N/A'}
                            </span>
                          </div>
                        </td>

                        {/* Start Time */}
                        <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {tx.startTime ? tx.startTime.split(' ')[1] : 'N/A'}
                        </td>

                        {/* End Time */}
                        <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {tx.endTime ? tx.endTime.split(' ')[1] : (
                            <span className="text-amber-500 font-semibold">Active</span>
                          )}
                        </td>

                        {/* Total Duration */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 w-36">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border ${getDurationBadgeClass(tx.totalDurationMs)}`}>
                              <Clock className="w-3 h-3 mr-1" />
                              {tx.totalDurationFormatted}
                            </span>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  tx.totalDurationMs >= 10000
                                    ? 'bg-rose-500'
                                    : tx.totalDurationMs >= 2000
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${durationPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Events Count */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[11px]">
                            {tx.eventsCount} events
                          </span>
                        </td>

                        {/* Slowest Step */}
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-gray-600 dark:text-gray-300 font-mono line-clamp-1" title={tx.slowestEventName}>
                            {tx.slowestEventName}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {tx.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : tx.status === 'HAS_ERROR' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              Error
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                              In Progress
                            </span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTxId(isExpanded ? null : tx.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                              isExpanded
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                      </tr>

                      {/* Expandable Event Breakdown Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="p-0 border-b-2 border-blue-500 bg-gray-50/70 dark:bg-gray-900/80">
                            <div className="p-5 space-y-4">
                              
                              {/* Event Header Banner */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                                      Detailed Event Timings for {tx.screenName}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      {tx.events.length} steps recorded
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Logs lines L{tx.startLine} to L{tx.endLine} • Total Duration: <strong>{tx.totalDurationFormatted}</strong> • Peak step: <strong className="text-rose-600 dark:text-rose-400">{tx.slowestEventName}</strong>
                                  </p>
                                </div>

                                {/* Event Filter Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => setEventFilterType('ALL')}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                      eventFilterType === 'ALL'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    All Events ({tx.events.length})
                                  </button>
                                  <button
                                    onClick={() => setEventFilterType('SLOW')}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                      eventFilterType === 'SLOW'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    Slow (&gt;1000ms)
                                  </button>
                                  <button
                                    onClick={() => setEventFilterType('API')}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                      eventFilterType === 'API'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    API Calls
                                  </button>
                                  <button
                                    onClick={() => setEventFilterType('SCRIPT')}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                      eventFilterType === 'SCRIPT'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    Scripts (onFocus/Exit)
                                  </button>
                                  {tx.appType === 'WMS' && (
                                    <button
                                      onClick={() => setEventFilterType('SSH')}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        eventFilterType === 'SSH'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      SSH Terminal
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Event Search Input */}
                              <div className="relative max-w-sm">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Filter events by field name, event, value, or details..."
                                  value={eventSearchTerm}
                                  onChange={(e) => setEventSearchTerm(e.target.value)}
                                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                                {eventSearchTerm && (
                                  <button onClick={() => setEventSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Detailed Events Table */}
                              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                      <th className="py-2 px-3 text-center w-12">Step</th>
                                      <th className="py-2 px-3 text-center w-16">Line</th>
                                      <th className="py-2 px-3">Timestamp</th>
                                      <th className="py-2 px-3">Field / Target</th>
                                      <th className="py-2 px-3">Event Triggered</th>
                                      <th className="py-2 px-3">Value Scanned / Entered</th>
                                      <th className="py-2 px-3">Time Taken (ms)</th>
                                      <th className="py-2 px-3">Details & Diagnostics</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-mono text-[11px]">
                                    {filteredEvents.length === 0 ? (
                                      <tr>
                                        <td colSpan={8} className="py-8 text-center text-gray-400 font-sans">
                                          No events match the selected event filters.
                                        </td>
                                      </tr>
                                    ) : (
                                      filteredEvents.map((ev, evIdx) => (
                                        <tr key={ev.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30">
                                          <td className="py-2 px-3 text-center text-gray-400 text-[10px]">
                                            {evIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 text-center text-blue-600 dark:text-blue-400 font-bold">
                                            L{ev.lineNo}
                                          </td>
                                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                            {ev.timestamp.split(' ')[1] || ev.timestamp}
                                          </td>
                                          <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                                            {ev.field || '-'}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-sans">
                                              {ev.event}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                            {ev.value ? (
                                              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900 font-mono">
                                                {ev.value}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 font-sans">-</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-bold ${getEventDurationBadge(ev)}`}>
                                              {ev.durationFormatted}
                                            </span>
                                            {ev.isReportedDuration && (
                                              <span className="ml-1 text-[9px] text-gray-400 font-sans" title="Direct reported execution time in log">
                                                (reported)
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-sans text-xs">
                                            {ev.details}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}

                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
