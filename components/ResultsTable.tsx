'use client';

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Barcode, 
  Keyboard, 
  Server, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Columns, 
  ExternalLink,
  Code,
  Sparkles,
  AlertOctagon,
  Layers
} from 'lucide-react';
import { LogEntry, FilterState, EntryType } from '../lib/types';

interface ResultsTableProps {
  entries: LogEntry[];
  onSelectEntry: (entry: LogEntry) => void;
  onFilterChange: (update: Partial<FilterState>) => void;
  filters: FilterState;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  entries,
  onSelectEntry,
  onFilterChange,
  filters,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    lineNo: true,
    system: true,
    focusType: true,
    time: true,
    status: true,
    user: true,
    session: true,
    screen: true,
    field: true,
    event: true,
    scannedValue: true,
    api: true,
    responseCode: true,
    missingValue: true,
    rootCause: true,
    logCode: false,
  });

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageEntries = entries.slice(startIndex, startIndex + pageSize);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const getMethodBadgeClass = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'POST': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'PATCH': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'PUT': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'DELETE': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const getStatusBadge = (status: LogEntry['status']) => {
    switch (status) {
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            FAIL
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            WARN
          </span>
        );
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            PASS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            INFO
          </span>
        );
    }
  };

  const getEntryTypeBadge = (type: EntryType) => {
    switch (type) {
      case 'FLEXI_METHOD':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <Sparkles className="w-3 h-3 text-purple-500" />
            METHOD
          </span>
        );
      case 'SCRIPT_CODE':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <Code className="w-3 h-3 text-emerald-500" />
            SCRIPT
          </span>
        );
      case 'API_CALL':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Server className="w-3 h-3 text-blue-500" />
            API
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertOctagon className="w-3 h-3 text-rose-500" />
            ERROR
          </span>
        );
      case 'USER_INPUT':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Barcode className="w-3 h-3 text-sky-500" />
            SCAN/INPUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            PLATFORM
          </span>
        );
    }
  };

  return (
    <div id="results-table-container" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors">
      
      {/* Table Header Controls */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 dark:text-white">
            Results
          </span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px]">
            {entries.length.toLocaleString()} matching
          </span>
          {filters.focusFlexiOnly && (
            <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold">
              🎯 Flexi Focus Active (Platform Logs Hidden)
            </span>
          )}
        </div>

        {/* Column Picker & Pagination Controls */}
        <div className="flex items-center gap-3">
          
          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
            >
              <Columns className="w-3.5 h-3.5 text-gray-500" />
              <span>Columns</span>
            </button>

            {/* Column Picker Modal */}
            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {Object.keys(visibleColumns).map((col) => (
                    <label key={col} className="flex items-center gap-1.5 cursor-pointer capitalize">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={() => toggleColumn(col)}
                        className="rounded text-blue-600"
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-30"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-30"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-gray-600 dark:text-gray-300 font-medium">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-30"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-30"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Main Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center">#</th>
              {visibleColumns.lineNo && <th className="py-2.5 px-3">Line</th>}
              {visibleColumns.system && <th className="py-2.5 px-3">System</th>}
              {visibleColumns.focusType && <th className="py-2.5 px-3">Focus / Type</th>}
              {visibleColumns.time && <th className="py-2.5 px-3">Time</th>}
              {visibleColumns.status && <th className="py-2.5 px-3">Status</th>}
              {visibleColumns.user && <th className="py-2.5 px-3">User</th>}
              {visibleColumns.session && <th className="py-2.5 px-3">Session</th>}
              {visibleColumns.screen && <th className="py-2.5 px-3">Screen</th>}
              {visibleColumns.field && <th className="py-2.5 px-3">Field</th>}
              {visibleColumns.event && <th className="py-2.5 px-3">Event / Flexi Method</th>}
              {visibleColumns.scannedValue && <th className="py-2.5 px-3">Scanned Value</th>}
              {visibleColumns.api && <th className="py-2.5 px-3">API Call</th>}
              {visibleColumns.responseCode && <th className="py-2.5 px-3">Code</th>}
              {visibleColumns.missingValue && <th className="py-2.5 px-3">Missing Value</th>}
              {visibleColumns.rootCause && <th className="py-2.5 px-3">Diagnostic & Root Cause</th>}
              {visibleColumns.logCode && <th className="py-2.5 px-3">Log Code</th>}
              <th className="py-2.5 px-3 w-10 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {pageEntries.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-gray-400">
                  No log entries found matching the current filters.
                </td>
              </tr>
            ) : (
              pageEntries.map((e, idx) => {
                const rowNum = startIndex + idx + 1;
                const isFailed = e.status === 'FAIL';
                const isWarn = e.status === 'WARN';

                return (
                  <tr
                    key={e.id}
                    onClick={() => onSelectEntry(e)}
                    className={`cursor-pointer transition-colors ${
                      isFailed
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : isWarn
                        ? 'bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                        : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    {/* Index */}
                    <td className="py-2 px-3 text-center text-gray-400 text-[11px] font-mono">
                      {rowNum}
                    </td>

                    {/* Line in Log File */}
                    {visibleColumns.lineNo && (
                      <td className="py-2 px-3 font-mono font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap text-[11px]">
                        L{e.startLine === e.endLine ? e.startLine : `${e.startLine}-${e.endLine}`}
                      </td>
                    )}

                    {/* System / App Type (SCM vs WMS) */}
                    {visibleColumns.system && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        {e.appType === 'SCM' ? (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-800" title={`Oracle SCM Cloud${e.tenant ? ` (${e.tenant})` : ''}`}>
                            SCM
                          </span>
                        ) : e.appType === 'WMS' ? (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800" title="Oracle WMS Cloud (LogFire)">
                            WMS
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                    )}

                    {/* Entry / Focus Type Badge */}
                    {visibleColumns.focusType && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        {getEntryTypeBadge(e.entryType)}
                      </td>
                    )}

                    {/* Timestamp */}
                    {visibleColumns.time && (
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        {e.timestamp ? e.timestamp.replace(/^\d{4}-/, '') : '-'}
                      </td>
                    )}

                    {/* Status Badge */}
                    {visibleColumns.status && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        {getStatusBadge(e.status)}
                      </td>
                    )}

                    {/* User */}
                    {visibleColumns.user && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        {e.userName ? (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onFilterChange({ users: [e.userName] });
                            }}
                            title={`Filter by user: ${e.userName}`}
                            className="px-2 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-colors text-[10px] truncate max-w-[130px] inline-block text-left"
                          >
                            {e.userName}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Session ID */}
                    {visibleColumns.session && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        {e.sessionId ? (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onFilterChange({ sessions: [e.sessionId] });
                            }}
                            title={`Filter by session: ${e.sessionId}`}
                            className="px-2 py-0.5 rounded font-mono font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors text-[10px]"
                          >
                            #{e.sessionId}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Screen Name */}
                    {visibleColumns.screen && (
                      <td className="py-2 px-3 whitespace-nowrap text-gray-800 dark:text-gray-200 font-medium">
                        {e.screen || '-'}
                      </td>
                    )}

                    {/* Field Name */}
                    {visibleColumns.field && (
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">
                        {e.field || '-'}
                      </td>
                    )}

                    {/* Event / Flexi Method */}
                    {visibleColumns.event && (
                      <td className="py-2 px-3 max-w-[180px] truncate">
                        {e.flexiMethod ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 truncate inline-block" title={e.flexiMethod.value ? `${e.flexiMethod.methodName}(key: ${e.flexiMethod.key}, val: ${e.flexiMethod.value})` : `${e.flexiMethod.methodName}`}>
                            {e.flexiMethod.methodName}{e.flexiMethod.key ? `("${e.flexiMethod.key}")` : e.flexiMethod.target ? `("${e.flexiMethod.target}")` : ''}
                          </span>
                        ) : e.event ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
                            {e.event}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Scanned / Input Value */}
                    {visibleColumns.scannedValue && (
                      <td className="py-2 px-3 max-w-[140px] truncate">
                        {e.scannedValue ? (
                          <span className="inline-flex items-center gap-1 font-mono text-gray-900 dark:text-white" title={e.isScan ? `Barcode Scanned: ${e.scannedValue}` : `Manually Entered: ${e.scannedValue}`}>
                            {e.isScan ? (
                              <Barcode className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <Keyboard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                            <span className="truncate">{e.scannedValue}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* API Call */}
                    {visibleColumns.api && (
                      <td className="py-2 px-3 max-w-[180px]">
                        {e.apiDetails ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getMethodBadgeClass(e.apiDetails.method)}`}>
                              {e.apiDetails.method || 'API'}
                            </span>
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate" title={e.apiDetails.name || e.apiDetails.url}>
                              {e.apiDetails.name || e.apiDetails.url?.replace(/https?:\/\/[^/]+/, '') || 'API Call'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Response Code */}
                    {visibleColumns.responseCode && (
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-center">
                        {e.apiDetails?.responseCode !== undefined ? (
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            e.apiDetails.responseCode >= 400
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                          }`}>
                            {e.apiDetails.responseCode}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Missing Value / Object */}
                    {visibleColumns.missingValue && (
                      <td className="py-2 px-3 max-w-[140px] truncate">
                        {e.missingValueDetails ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 truncate inline-block" title={e.missingValueDetails.reason}>
                            {e.missingValueDetails.field}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Root Cause Hint & Error */}
                    {visibleColumns.rootCause && (
                      <td className="py-2 px-3 max-w-[280px]">
                        <div className="flex items-center gap-1">
                          {e.scriptErrorLine !== undefined && (
                            <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 shrink-0">
                              Line {e.scriptErrorLine}
                            </span>
                          )}
                          {e.rootCauseHint ? (
                            <p className={`text-[11px] truncate font-medium ${isFailed ? 'text-rose-700 dark:text-rose-300 font-semibold' : isWarn ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`} title={e.rootCauseHint}>
                              {e.rootCauseHint}
                            </p>
                          ) : e.error?.message ? (
                            <p className="text-[11px] text-rose-600 truncate font-mono" title={e.error.message}>
                              {e.error.type}: {e.error.message}
                            </p>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Log Code / Reference */}
                    {visibleColumns.logCode && (
                      <td className="py-2 px-3 font-mono text-[10px] text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={e.logCode}>
                        {e.logCode || '-'}
                      </td>
                    )}

                    {/* Action Icon */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectEntry(e);
                        }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
