'use client';

import React, { useMemo } from 'react';
import { 
  AlertTriangle, 
  XCircle, 
  Users, 
  Server, 
  Activity, 
  Flame, 
  ShieldAlert, 
  Clock, 
  ArrowRight,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { LogEntry, FilterState } from '../lib/types';

interface DashboardProps {
  entries: LogEntry[];
  filteredEntries: LogEntry[];
  onSelectEntry: (entry: LogEntry) => void;
  onFilterChange: (update: Partial<FilterState>) => void;
  sortOrder: 'newest' | 'oldest';
}

export const Dashboard: React.FC<DashboardProps> = ({
  entries,
  filteredEntries,
  onSelectEntry,
  onFilterChange,
  sortOrder,
}) => {
  // Aggregate statistics
  const stats = useMemo(() => {
    let totalErrors = 0;
    let totalWarnings = 0;
    let failedApiCount = 0;
    const usersSet = new Set<string>();
    const sessionsSet = new Set<string>();
    const failingApisMap = new Map<string, number>();
    const failingFieldsMap = new Map<string, number>();
    const errorsByEventMap = new Map<string, number>();
    const recentIssues: LogEntry[] = [];

    // Order for recent issues: always newest first
    // Entries are passed in
    const sortedForRecent = entries.slice().sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return b.timestampMs - a.timestampMs;
      return b.startLine - a.startLine;
    });

    for (const e of sortedForRecent) {
      if (e.userName) usersSet.add(e.userName);
      if (e.sessionId) sessionsSet.add(e.sessionId);

      if (e.status === 'FAIL') {
        totalErrors++;
        if (recentIssues.length < 5) {
          recentIssues.push(e);
        }
      } else if (e.status === 'WARN') {
        totalWarnings++;
        if (recentIssues.length < 5 && e.isIssue) {
          recentIssues.push(e);
        }
      }

      if (e.apiDetails?.responseCode && e.apiDetails.responseCode >= 400) {
        failedApiCount++;
        const apiLabel = e.apiDetails.name || e.apiDetails.url || 'Unknown API';
        failingApisMap.set(apiLabel, (failingApisMap.get(apiLabel) || 0) + 1);
      }

      if (e.isIssue && e.field) {
        failingFieldsMap.set(e.field, (failingFieldsMap.get(e.field) || 0) + 1);
      }

      if (e.isIssue && e.event) {
        errorsByEventMap.set(e.event, (errorsByEventMap.get(e.event) || 0) + 1);
      }
    }

    const topFailingApis = Array.from(failingApisMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topFailingFields = Array.from(failingFieldsMap.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topFailingEvents = Array.from(errorsByEventMap.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEntries: entries.length,
      totalErrors,
      totalWarnings,
      failedApiCount,
      uniqueUsers: usersSet.size,
      uniqueSessions: sessionsSet.size,
      topFailingApis,
      topFailingFields,
      topFailingEvents,
      recentIssues,
    };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      
      {/* 1. Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* Total Entries */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Entries</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.totalEntries.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Parsed & analyzed
          </div>
        </div>

        {/* Total Failures */}
        <div 
          onClick={() => onFilterChange({ onlyFailures: true })}
          className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-rose-50/30 transition-colors"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Failures</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {stats.totalErrors}
          </div>
          <div className="mt-1 text-[11px] text-rose-500 font-medium">
            Click to view only failures
          </div>
        </div>

        {/* Failed APIs */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed APIs</span>
            <Server className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {stats.failedApiCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            4xx & 5xx HTTP responses
          </div>
        </div>

        {/* Unique Users */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Users</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.uniqueUsers}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Unique operator IDs
          </div>
        </div>

        {/* Unique Sessions */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sessions</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.uniqueSessions}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            RF screen session IDs
          </div>
        </div>

      </div>

      {/* 2. Recent Issues Banner (NEWEST FIRST) */}
      {stats.recentIssues.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-rose-200 dark:border-rose-900/60 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-500" />
                Latest Issues (Newest First)
              </h3>
            </div>
            <span className="text-[11px] text-gray-400">
              Most recent failures detected from bottom-to-top
            </span>
          </div>

          <div className="space-y-2">
            {stats.recentIssues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onSelectEntry(issue)}
                className="group p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer flex items-center justify-between gap-3 transition-colors text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                    L{issue.startLine}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {issue.screen || issue.logger || 'Flexi System'}
                      </span>
                      {issue.field && (
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 font-mono text-[10px] text-gray-700 dark:text-gray-300">
                          {issue.field}
                        </span>
                      )}
                      {issue.apiDetails?.responseCode && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/80 font-bold text-[10px] text-rose-800 dark:text-rose-200">
                          HTTP {issue.apiDetails.responseCode}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {issue.timestamp}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 truncate mt-0.5 font-medium">
                      {issue.rootCauseHint || issue.error?.message || 'Error occurred'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {issue.userName && (
                    <span className="hidden md:inline px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px]">
                      {issue.userName}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Top 5 Failing APIs & Top 5 Failing Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Top Failing APIs */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between">
            <span>Top Failing APIs</span>
            <span className="text-[11px] text-gray-400 font-normal">HTTP 4xx / 5xx</span>
          </h4>
          {stats.topFailingApis.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No failing API calls detected</p>
          ) : (
            <div className="space-y-2">
              {stats.topFailingApis.map((item, idx) => {
                const maxCount = stats.topFailingApis[0]?.count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div 
                    key={idx}
                    onClick={() => onFilterChange({ search: item.name, onlyFailures: true })}
                    className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[280px]" title={item.name}>
                        {item.name}
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">
                        {item.count} failure{item.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Failing Fields */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between">
            <span>Top Failing Fields</span>
            <span className="text-[11px] text-gray-400 font-normal">Input / Exit Errors</span>
          </h4>
          {stats.topFailingFields.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No field-level failures detected</p>
          ) : (
            <div className="space-y-2">
              {stats.topFailingFields.map((item, idx) => {
                const maxCount = stats.topFailingFields[0]?.count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div 
                    key={idx}
                    onClick={() => onFilterChange({ fields: [item.field], onlyFailures: true })}
                    className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[280px]" title={item.field}>
                        {item.field}
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {item.count} issue{item.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
