'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
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
  Activity,
  FileSpreadsheet,
  FileText,
  UserCheck
} from 'lucide-react';
import { LogEntry, ParsedLogFile } from '../lib/types';
import { ScreenTransaction, ScreenEventDetail } from '../lib/performanceTypes';
import { 
  extractScreenTransactions, 
  calculatePerformanceSummary, 
  formatDuration, 
  formatShortDuration,
  exportPerformanceSummaryCsv,
  exportPerformanceDetailsCsv,
  exportScreenEventsCsv
} from '../lib/performanceUtils';
import { exportPerformanceReportToPdf, exportSingleScreenToPdf } from '../lib/exportUtils';

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
    if (files && files.length > 0) {
      const txs: ScreenTransaction[] = [];
      for (const f of files) {
        if (f.screenTransactions && f.screenTransactions.length > 0) {
          txs.push(...f.screenTransactions);
        }
      }
      if (txs.length > 0) return txs;
    }
    return extractScreenTransactions(files.length > 0 ? files : entries);
  }, [files, entries]);

  // UI state
  const [selectedScreenFilter, setSelectedScreenFilter] = useState<string>('ALL');
  const [systemFilter, setSystemFilter] = useState<'ALL' | 'SCM' | 'WMS'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<'slowest' | 'fastest' | 'newest' | 'oldest'>('slowest');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [eventSearchTerm, setEventSearchTerm] = useState<string>('');
  const [eventFilterType, setEventFilterType] = useState<'ALL' | 'SLOW' | 'USER_HOLD' | 'SSH' | 'API' | 'SCRIPT'>('ALL');

  // Pagination for Screen Transactions Table (Default: 50 records)
  const [txPage, setTxPage] = useState<number>(1);
  const [txPageSize, setTxPageSize] = useState<number>(50);

  // Pagination for Event Details Table (Default: 50 records)
  const [eventPage, setEventPage] = useState<number>(1);
  const [eventPageSize, setEventPageSize] = useState<number>(50);

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
        tx.slowestEventName.toLowerCase().includes(q) ||
        (tx.primaryDelayReason && tx.primaryDelayReason.toLowerCase().includes(q))
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

  // Reset transaction page on filter/sort changes
  useEffect(() => {
    setTxPage(1);
  }, [selectedScreenFilter, systemFilter, searchTerm, sortOption, txPageSize]);

  // Paginated transactions
  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txPageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredTransactions.slice(start, start + txPageSize);
  }, [filteredTransactions, txPage, txPageSize]);

  // Selected transaction for details
  const activeTx = useMemo(() => {
    return allTransactions.find(t => t.id === expandedTxId) || null;
  }, [allTransactions, expandedTxId]);

  // Filtered events inside active transaction
  const filteredEvents = useMemo(() => {
    if (!activeTx) return [];
    let evs = [...activeTx.events];

    if (eventFilterType === 'SLOW') {
      evs = evs.filter(e => e.durationMs >= 1000 || (e.userHoldTimeMs && e.userHoldTimeMs >= 1500));
    } else if (eventFilterType === 'USER_HOLD') {
      evs = evs.filter(e => e.delayCategory === 'USER_HOLD' || (e.userHoldTimeMs && e.userHoldTimeMs >= 1500));
    } else if (eventFilterType === 'SSH') {
      evs = evs.filter(e => e.delayCategory === 'RF_TERMINAL_LATENCY' || (e.isReportedDuration && e.details.includes('SSH')));
    } else if (eventFilterType === 'API') {
      evs = evs.filter(e => e.delayCategory === 'API_LATENCY' || e.event.startsWith('API:') || e.event === 'API_CALL');
    } else if (eventFilterType === 'SCRIPT') {
      evs = evs.filter(e => e.delayCategory === 'SCRIPT_LATENCY' || e.event.startsWith('SCRIPT:') || e.event.includes('script'));
    }

    if (eventSearchTerm.trim()) {
      const q = eventSearchTerm.toLowerCase();
      evs = evs.filter(e => 
        e.field.toLowerCase().includes(q) ||
        e.event.toLowerCase().includes(q) ||
        (e.value && e.value.toLowerCase().includes(q)) ||
        (e.whySlow && e.whySlow.toLowerCase().includes(q)) ||
        e.details.toLowerCase().includes(q)
      );
    }

    return evs;
  }, [activeTx, eventFilterType, eventSearchTerm]);

  // Reset event page on event filter or active transaction change
  useEffect(() => {
    setEventPage(1);
  }, [expandedTxId, eventFilterType, eventSearchTerm, eventPageSize]);

  // Paginated events
  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / eventPageSize));
  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * eventPageSize;
    return filteredEvents.slice(start, start + eventPageSize);
  }, [filteredEvents, eventPage, eventPageSize]);

  // CSV download helper
  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export 1: Performance Summary (Screen level)
  const handleExportSummaryCsv = () => {
    const list = filteredTransactions.length > 0 ? filteredTransactions : allTransactions;
    if (list.length === 0) return;
    const csvContent = exportPerformanceSummaryCsv(list);
    triggerDownload(csvContent, `screen_performance_summary_${Date.now()}.csv`);
  };

  // Export 2: Performance Details (All events across screens)
  const handleExportAllDetailsCsv = () => {
    const list = filteredTransactions.length > 0 ? filteredTransactions : allTransactions;
    if (list.length === 0) return;
    const csvContent = exportPerformanceDetailsCsv(list);
    triggerDownload(csvContent, `screen_performance_details_${Date.now()}.csv`);
  };

  // Export 3: Single Screen Events (CSV)
  const handleExportScreenEventsCsv = (tx: ScreenTransaction) => {
    const csvContent = exportScreenEventsCsv(tx);
    const safeName = tx.screenName.replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerDownload(csvContent, `${safeName}_events_${Date.now()}.csv`);
  };

  // Export 4: Performance Audit Report as PDF
  const handleExportPdf = () => {
    const list = filteredTransactions.length > 0 ? filteredTransactions : allTransactions;
    if (list.length === 0) return;
    exportPerformanceReportToPdf(list, summary);
  };

  // Export 5: Single Screen Events as PDF
  const handleExportScreenEventsPdf = (tx: ScreenTransaction) => {
    exportSingleScreenToPdf(tx);
  };

  const getDurationBadgeClass = (ms: number) => {
    if (ms >= 10000) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    if (ms >= 3000) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    if (ms >= 1000) return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  };

  const getEventDurationBadge = (ev: ScreenEventDetail) => {
    if (ev.durationMs >= 3000) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300';
    if (ev.durationMs >= 1000) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
    if (ev.durationMs > 0) return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
    return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
  };

  const getEventBadgeClass = (eventName: string) => {
    if (eventName.startsWith('API:')) return 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
    if (eventName.startsWith('SCRIPT:')) return 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    if (eventName.startsWith('Ctrl-') || eventName.startsWith('F2')) return 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold';
    if (eventName.startsWith('Sub-Screen:')) return 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-900 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
    if (eventName === 'SCAN') return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    if (eventName === 'ENTER') return 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
  };

  const getDelayCategoryBadge = (ev: ScreenEventDetail) => {
    switch (ev.delayCategory) {
      case 'USER_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            User Hold ({ev.userHoldTimeMs ? formatShortDuration(ev.userHoldTimeMs) : ev.durationFormatted})
          </span>
        );
      case 'RF_TERMINAL_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 whitespace-nowrap">
            <Terminal className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            RF Host Latency ({ev.serverLatencyMs ? formatShortDuration(ev.serverLatencyMs) : ev.durationFormatted})
          </span>
        );
      case 'API_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
            <Zap className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Remote API ({ev.apiLatencyMs ? formatShortDuration(ev.apiLatencyMs) : ev.durationFormatted})
          </span>
        );
      case 'SCRIPT_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800 whitespace-nowrap">
            <Code className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Script Execution ({ev.scriptLatencyMs ? formatShortDuration(ev.scriptLatencyMs) : ev.durationFormatted})
          </span>
        );
      case 'SCREEN_PARSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border-cyan-800 whitespace-nowrap">
            <Layers className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            RF Screen Layout ({ev.durationFormatted})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Normal
          </span>
        );
    }
  };

  const getPrimaryDelayBadge = (tx: ScreenTransaction) => {
    switch (tx.primaryDelayCategory) {
      case 'USER_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
            <Clock className="w-2.5 h-2.5 text-amber-600" />
            User Hold
          </span>
        );
      case 'RF_TERMINAL_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
            <Terminal className="w-2.5 h-2.5 text-rose-600" />
            RF Host
          </span>
        );
      case 'API_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
            <Zap className="w-2.5 h-2.5 text-indigo-600" />
            API Delay
          </span>
        );
      case 'SCRIPT_LATENCY':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
            <Code className="w-2.5 h-2.5 text-purple-600" />
            Script Delay
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1B2E59] via-[#0E3D73] to-[#009FE3] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-[#F37021]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <Zap className="w-6 h-6 text-[#F37021] fill-[#F37021]/30" />
            </div>
            <h2 className="text-xl font-black tracking-tight">
              Screen & Event Performance Check
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/20">
              {allTransactions.length} Screen Transactions
            </span>
          </div>
          <p className="text-xs text-blue-100 max-w-2xl">
            Pinpoints exact response times and <strong>why each step is slow</strong>: distinguishes between <strong>User Screen Hold / Idle Time</strong> (user paused before entering value), <strong>RF Terminal Host Latency</strong> (Oracle WMS backend host SSH latency), <strong>Web Service API Calls</strong>, <strong>Script Execution</strong>, and <strong>RF Screen Parsing</strong>. All line numbers strictly match <strong>Notepad++</strong> 1:1.
          </p>
        </div>

        {/* Export Buttons: Summary CSV, Details CSV, and Full Report PDF */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportSummaryCsv}
            disabled={allTransactions.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-[#1B2E59] hover:bg-slate-100 shadow-md flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            title="Export transaction-level summary per screen"
          >
            <Download className="w-3.5 h-3.5 text-[#009FE3]" />
            <span>Summary (CSV)</span>
          </button>

          <button
            onClick={handleExportAllDetailsCsv}
            disabled={allTransactions.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#1B2E59]/80 hover:bg-[#1B2E59] text-white border border-white/25 shadow-md flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            title="Export step-by-step event details with root cause diagnostics and physical Notepad++ line numbers"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
            <span>Details (CSV)</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={allTransactions.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#F37021] hover:bg-[#d95d13] text-white border border-[#F37021]/30 shadow-md flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            title="Export comprehensive performance audit report as PDF"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>Export as PDF</span>
          </button>
        </div>
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs md:col-span-1 col-span-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Peak Transaction</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-sm font-bold text-rose-600 dark:text-rose-400 truncate" title={summary.slowestScreen}>
            {summary.slowestScreen}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Max screen lifecycle time
          </div>
        </div>

        {/* Metric 4: Total Steps Recorded */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Events & Actions</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {summary.totalEventsCount}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            User inputs, scans, APIs & scripts
          </div>
        </div>

        {/* Metric 5: Average Event Latency */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Avg Event Latency</span>
            <Timer className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {summary.avgEventDurationMs} ms
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Terminal / API response speed
          </div>
        </div>

      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Screen Name, Technical Code, User, Session, or Delay Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Screen Name Dropdown Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Screen:</label>
            <select
              value={selectedScreenFilter}
              onChange={(e) => setSelectedScreenFilter(e.target.value)}
              className="py-2 px-3 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden max-w-[240px] truncate"
            >
              <option value="ALL">All Screens ({allTransactions.length})</option>
              {screenOptions.map(([name, info]) => (
                <option key={name} value={name}>
                  {name} ({info.count} txn{info.count > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* System Filter: All / SCM / WMS */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
            <button
              onClick={() => setSystemFilter('ALL')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                systemFilter === 'ALL'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              All Systems
            </button>
            <button
              onClick={() => setSystemFilter('SCM')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                systemFilter === 'SCM'
                  ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              SCM Cloud
            </button>
            <button
              onClick={() => setSystemFilter('WMS')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                systemFilter === 'WMS'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              WMS RF
            </button>
          </div>

          {/* Sort By Option */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="py-2 px-3 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="slowest">Slowest First (Highest Duration)</option>
              <option value="fastest">Fastest First (Lowest Duration)</option>
              <option value="newest">Newest First (Bottom-to-Top)</option>
              <option value="oldest">Oldest First (Top-to-Bottom)</option>
            </select>
          </div>

        </div>

        {/* Active Filter Indicators */}
        {(selectedScreenFilter !== 'ALL' || systemFilter !== 'ALL' || searchTerm.trim()) && (
          <div className="flex items-center gap-2 pt-1 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700/60 flex-wrap">
            <span>Showing {filteredTransactions.length} of {allTransactions.length} transactions:</span>
            {selectedScreenFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-semibold">
                Screen: {selectedScreenFilter}
                <button onClick={() => setSelectedScreenFilter('ALL')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {systemFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[11px] font-semibold">
                System: {systemFilter}
                <button onClick={() => setSystemFilter('ALL')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-semibold">
                Search: &quot;{searchTerm}&quot;
                <button onClick={() => setSearchTerm('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedScreenFilter('ALL');
                setSystemFilter('ALL');
                setSearchTerm('');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-semibold ml-auto"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Screen Transactions Main Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3">Screen Name</th>
                <th className="py-3 px-3">System</th>
                <th className="py-3 px-3">User & Session</th>
                <th className="py-3 px-3 text-center">Notepad++ Lines</th>
                <th className="py-3 px-3">Start Time</th>
                <th className="py-3 px-3">End Time</th>
                <th className="py-3 px-3">Total Duration</th>
                <th className="py-3 px-3 text-center">Steps</th>
                <th className="py-3 px-3">Slowest Step & Delay Cause</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    <p className="text-sm">No screen transactions found matching the selected filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, pIdx) => {
                  const globalIdx = (txPage - 1) * txPageSize + pIdx + 1;
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
                          {globalIdx}
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
                            <span className="text-[10px] text-gray-400 font-mono">
                              Sess: {tx.sessionId || 'N/A'} {tx.threadId ? `(${tx.threadId})` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Notepad++ Physical Lines */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px]">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">L{tx.startLine}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">L{tx.endLine || 'end'}</span>
                        </td>

                        {/* Start Time */}
                        <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {tx.startTime ? tx.startTime.split(' ')[1] : '-'}
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

                        {/* Slowest Step & Why Slow */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 max-w-[240px]">
                            <span className="text-[11px] text-gray-800 dark:text-gray-200 font-mono truncate" title={tx.slowestEventName}>
                              {tx.slowestEventName}
                            </span>
                            {tx.primaryDelayReason && (
                              <div className="flex items-center gap-1">
                                {getPrimaryDelayBadge(tx)}
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-sans truncate" title={tx.primaryDelayReason}>
                                  {tx.primaryDelayReason}
                                </span>
                              </div>
                            )}
                          </div>
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
                          <td colSpan={12} className="p-0 border-b-2 border-blue-500 bg-gray-50/70 dark:bg-gray-900/80">
                            <div className="p-5 space-y-4">
                              
                              {/* Event Header Banner */}
                              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                                      Detailed Event Timings for {tx.screenName}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                      {tx.events.length} steps recorded
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Notepad++ Lines: <strong className="text-blue-600 dark:text-blue-400 font-mono">L{tx.startLine}</strong> to <strong className="text-blue-600 dark:text-blue-400 font-mono">L{tx.endLine || 'end'}</strong> • Total Duration: <strong>{tx.totalDurationFormatted}</strong> • Peak step: <strong className="text-rose-600 dark:text-rose-400">{tx.slowestEventName}</strong>
                                    {tx.primaryDelayReason && (
                                      <span className="block mt-0.5 text-amber-700 dark:text-amber-400 font-medium">
                                        Primary bottleneck: {tx.primaryDelayReason}
                                      </span>
                                    )}
                                  </p>
                                </div>

                                {/* Event Filter Chips & Export Button */}
                                <div className="flex items-center gap-2 flex-wrap">
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
                                      onClick={() => setEventFilterType('USER_HOLD')}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                                        eventFilterType === 'USER_HOLD'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3" />
                                      User Hold
                                    </button>
                                    {tx.appType === 'WMS' && (
                                      <button
                                        onClick={() => setEventFilterType('SSH')}
                                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                                          eventFilterType === 'SSH'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                      >
                                        <Terminal className="w-3 h-3" />
                                        RF Host Latency
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setEventFilterType('API')}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                                        eventFilterType === 'API'
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      <Zap className="w-3 h-3" />
                                      API Calls ({tx.apiCallsCount})
                                    </button>
                                    <button
                                      onClick={() => setEventFilterType('SCRIPT')}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                                        eventFilterType === 'SCRIPT'
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}
                                    >
                                      <Code className="w-3 h-3" />
                                      Scripts
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleExportScreenEventsCsv(tx)}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                                    title="Export this screen's events to CSV"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Export CSV</span>
                                  </button>

                                  <button
                                    onClick={() => handleExportScreenEventsPdf(tx)}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1 transition-colors"
                                    title="Export this screen's event breakdown to PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                    <span>Export as PDF</span>
                                  </button>
                                </div>
                              </div>

                              {/* Event Search Input */}
                              <div className="relative max-w-sm">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Filter events by field name, event, value, or delay reason..."
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

                              {/* Detailed Events Table with Delay Diagnostics */}
                              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                      <th className="py-2.5 px-3 text-center w-12">Step</th>
                                      <th className="py-2.5 px-3 text-center w-24">Notepad++ Line</th>
                                      <th className="py-2.5 px-3">Timestamp</th>
                                      <th className="py-2.5 px-3">Field / Target</th>
                                      <th className="py-2.5 px-3">Action / Event Triggered</th>
                                      <th className="py-2.5 px-3">Value Scanned / Entered</th>
                                      <th className="py-2.5 px-3">Time Taken</th>
                                      <th className="py-2.5 px-3">Why Slow? / Root Cause Diagnostics</th>
                                      <th className="py-2.5 px-3">Details</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-mono text-[11px]">
                                    {filteredEvents.length === 0 ? (
                                      <tr>
                                        <td colSpan={9} className="py-8 text-center text-gray-400 font-sans">
                                          No events match the selected event filters.
                                        </td>
                                      </tr>
                                    ) : (
                                      paginatedEvents.map((ev, evIdx) => {
                                        const globalEvIdx = (eventPage - 1) * eventPageSize + evIdx + 1;
                                        return (
                                          <tr key={ev.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30">
                                            <td className="py-2 px-3 text-center text-gray-400 text-[10px]">
                                              {globalEvIdx}
                                            </td>
                                            <td className="py-2 px-3 text-center whitespace-nowrap">
                                              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 text-[11px]">
                                                Line {ev.lineNo}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                              {ev.timestamp.split(' ')[1] || ev.timestamp}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                                              {ev.field || '-'}
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getEventBadgeClass(ev.event)} font-sans`}>
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

                                            {/* Why Slow / Root Cause Diagnostics Cell */}
                                            <td className="py-2 px-3">
                                              <div className="flex flex-col gap-1 min-w-[240px]">
                                                <div>{getDelayCategoryBadge(ev)}</div>
                                                {ev.whySlow && (
                                                  <span className="text-[11px] text-gray-700 dark:text-gray-300 font-sans leading-tight">
                                                    {ev.whySlow}
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-sans text-xs">
                                              {ev.details}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>

                                {/* Event Pagination Controls */}
                                {filteredEvents.length > 0 && (
                                  <div className="bg-gray-50 dark:bg-gray-900/80 px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                    <div className="text-gray-500 dark:text-gray-400">
                                      Showing <span className="font-bold text-gray-700 dark:text-gray-200">{(eventPage - 1) * eventPageSize + 1}</span> to <span className="font-bold text-gray-700 dark:text-gray-200">{Math.min(eventPage * eventPageSize, filteredEvents.length)}</span> of <span className="font-bold text-gray-700 dark:text-gray-200">{filteredEvents.length}</span> events
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Per page:</span>
                                        <select
                                          value={eventPageSize}
                                          onChange={(e) => setEventPageSize(Number(e.target.value))}
                                          className="py-1 px-2 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold"
                                        >
                                          <option value={25}>25</option>
                                          <option value={50}>50</option>
                                          <option value={100}>100</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setEventPage(p => Math.max(1, p - 1))}
                                          disabled={eventPage <= 1}
                                          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-0.5 text-xs font-semibold"
                                        >
                                          <ChevronLeft className="w-3.5 h-3.5" />
                                          <span>Prev</span>
                                        </button>

                                        <span className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                          Page {eventPage} of {totalEventPages}
                                        </span>

                                        <button
                                          onClick={() => setEventPage(p => Math.min(totalEventPages, p + 1))}
                                          disabled={eventPage >= totalEventPages}
                                          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-0.5 text-xs font-semibold"
                                        >
                                          <span>Next</span>
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

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

        {/* Screen Transactions Main Pagination Controls */}
        {filteredTransactions.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900/80 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-gray-500 dark:text-gray-400">
              Showing <span className="font-bold text-gray-700 dark:text-gray-200">{(txPage - 1) * txPageSize + 1}</span> to <span className="font-bold text-gray-700 dark:text-gray-200">{Math.min(txPage * txPageSize, filteredTransactions.length)}</span> of <span className="font-bold text-gray-700 dark:text-gray-200">{filteredTransactions.length}</span> screen transactions
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-gray-400">Rows per page:</span>
                <select
                  value={txPageSize}
                  onChange={(e) => setTxPageSize(Number(e.target.value))}
                  className="py-1 px-2 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTxPage(1)}
                  disabled={txPage <= 1}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                  disabled={txPage <= 1}
                  className="px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-3 py-1 text-xs font-bold text-gray-800 dark:text-gray-200">
                  Page {txPage} of {totalTxPages}
                </span>

                <button
                  onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                  disabled={txPage >= totalTxPages}
                  className="px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setTxPage(totalTxPages)}
                  disabled={txPage >= totalTxPages}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
