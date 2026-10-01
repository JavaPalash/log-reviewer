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
  ExternalLink,
  Sparkles,
  Code,
  Layers
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
    let flexiMethodsCount = 0;
    let scriptsCount = 0;
    let scmCount = 0;
    let wmsCount = 0;

    const usersSet = new Set<string>();
    const sessionsSet = new Set<string>();
    const failingApisMap = new Map<string, number>();
    const failingFieldsMap = new Map<string, number>();
    const errorsByEventMap = new Map<string, number>();
    const flexiMethodsMap = new Map<string, number>();
    const recentIssues: LogEntry[] = [];

    // Order for recent issues: always newest first
    const sortedForRecent = entries.slice().sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return b.timestampMs - a.timestampMs;
      return b.startLine - a.startLine;
    });

    for (const e of sortedForRecent) {
      if (e.userName) usersSet.add(e.userName);
      if (e.sessionId) sessionsSet.add(e.sessionId);

      if (e.appType === 'SCM') scmCount++;
      else if (e.appType === 'WMS') wmsCount++;

      if (e.entryType === 'FLEXI_METHOD' || e.flexiMethod) {
        flexiMethodsCount++;
        const mName = e.flexiMethod?.methodName || 'Method';
        flexiMethodsMap.set(mName, (flexiMethodsMap.get(mName) || 0) + 1);
      }

      if (e.entryType === 'SCRIPT_CODE' || e.scriptCode) {
        scriptsCount++;
      }

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

      if (
        (e.apiDetails?.responseCode && e.apiDetails.responseCode >= 400) ||
        (e.apiDetails && e.issueCategory === 'API_FAILURE' && e.status === 'FAIL')
      ) {
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

    const topFlexiMethods = Array.from(flexiMethodsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEntries: entries.length,
      totalErrors,
      totalWarnings,
      failedApiCount,
      flexiMethodsCount,
      scriptsCount,
      scmCount,
      wmsCount,
      uniqueUsers: usersSet.size,
      uniqueSessions: sessionsSet.size,
      topFailingApis,
      topFailingFields,
      topFailingEvents,
      topFlexiMethods,
      recentIssues,
    };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      
      {/* 1. Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Entries */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Entries</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.totalEntries.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-1.5">
            {stats.scmCount > 0 && <span className="text-teal-600 dark:text-teal-400 font-bold">{stats.scmCount} SCM</span>}
            {stats.scmCount > 0 && stats.wmsCount > 0 && <span>•</span>}
            {stats.wmsCount > 0 && <span className="text-blue-600 dark:text-blue-400 font-bold">{stats.wmsCount} WMS</span>}
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

        {/* Flexi Methods Called */}
        <div 
          onClick={() => onFilterChange({ entryTypes: ['FLEXI_METHOD'] })}
          className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-purple-50/30 transition-colors"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Flexi Methods</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {stats.flexiMethodsCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            put/getSessionObject & queries
          </div>
        </div>

        {/* Custom Scripts */}
        <div 
          onClick={() => onFilterChange({ entryTypes: ['SCRIPT_CODE'] })}
          className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-emerald-50/30 transition-colors"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Custom Scripts</span>
            <Code className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.scriptsCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Screen events executed
          </div>
        </div>

        {/* Failed APIs */}
        <div 
          onClick={() => onFilterChange({ entryTypes: ['API_CALL'], onlyFailures: true })}
          className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-amber-50/30 transition-colors"
        >
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

        {/* Active Operators */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Users</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {stats.uniqueUsers}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            across {stats.uniqueSessions} sessions
          </div>
        </div>

      </div>

      {/* 2. Recent Issues Banner (NEWEST FIRST) */}
      {stats.recentIssues.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-rose-200 dark:border-rose-900/60 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>Latest Critical Diagnostics & Root Causes</span>
                <span className="text-[11px] font-normal text-gray-500">
                  (Newest First)
                </span>
              </h3>
            </div>
            <button
              onClick={() => onFilterChange({ onlyFailures: true })}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <span>View All {stats.totalErrors} Failures</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stats.recentIssues.slice(0, 3).map((issue) => (
              <div
                key={issue.id}
                onClick={() => onSelectEntry(issue)}
                className="p-3 rounded-lg border border-rose-100 dark:border-rose-950/80 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 cursor-pointer transition-all flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                        Line {issue.startLine}
                      </span>
                      {issue.appType === 'SCM' && (
                        <span className="px-1 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 font-bold rounded">
                          SCM
                        </span>
                      )}
                      {issue.appType === 'WMS' && (
                        <span className="px-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold rounded">
                          WMS
                        </span>
                      )}
                      {issue.scriptErrorLine !== undefined && (
                        <span className="px-1 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-bold rounded">
                          Script Line {issue.scriptErrorLine}
                        </span>
                      )}
                    </div>
                    <span>{issue.timestamp?.replace(/^\d{4}-/, '')}</span>
                  </div>

                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                    {issue.rootCauseHint || issue.error?.message || 'Error occurred'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-rose-100 dark:border-rose-900/40">
                  <span className="truncate">
                    {issue.field || issue.screen || issue.apiDetails?.name || 'Screen Action'}
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                    Inspect <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Top Hotspots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Top Failing APIs */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 font-bold text-xs">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Top Failing APIs</span>
          </div>
          {stats.topFailingApis.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No failing APIs detected.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {stats.topFailingApis.map((item, idx) => (
                <li
                  key={idx}
                  onClick={() => onFilterChange({ search: item.name })}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                    {item.count} fail
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top Failing Fields */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Problem Fields & Events</span>
          </div>
          {stats.topFailingFields.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No problematic fields identified.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {stats.topFailingFields.map((item, idx) => (
                <li
                  key={idx}
                  onClick={() => onFilterChange({ fields: [item.field] })}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={item.field}>
                    {item.field}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    {item.count} issues
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top Flexi Methods Invoked */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Top Flexi Methods Invoked</span>
          </div>
          {stats.topFlexiMethods.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No FlexiAPI method calls detected.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {stats.topFlexiMethods.map((item, idx) => (
                <li
                  key={idx}
                  onClick={() => onFilterChange({ search: item.name })}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={item.name}>
                    FlexiAPI.{item.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                    {item.count} calls
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

    </div>
  );
};
