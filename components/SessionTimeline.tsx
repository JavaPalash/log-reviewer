'use client';

import React, { useState, useMemo } from 'react';
import { 
  GitCommit, 
  ArrowDownUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Barcode, 
  Server, 
  ChevronRight, 
  User, 
  Layers, 
  AlertTriangle,
  Play,
  RotateCcw
} from 'lucide-react';
import { LogEntry } from '../lib/types';

interface SessionTimelineProps {
  entries: LogEntry[];
  onSelectEntry: (entry: LogEntry) => void;
  selectedSessionId?: string;
  onSessionChange: (sessionId: string) => void;
  defaultSortOrder: 'newest' | 'oldest';
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  entries,
  onSelectEntry,
  selectedSessionId,
  onSessionChange,
  defaultSortOrder,
}) => {
  const [timelineOrder, setTimelineOrder] = useState<'newest' | 'oldest'>(defaultSortOrder);

  // Group all entries by session
  const sessionsMap = useMemo(() => {
    const map = new Map<string, { entries: LogEntry[]; hasError: boolean; user: string }>();

    for (const e of entries) {
      const sess = e.sessionId || 'No-Session';
      const existing = map.get(sess) || { entries: [], hasError: false, user: '' };
      existing.entries.push(e);
      if (e.status === 'FAIL') existing.hasError = true;
      if (!existing.user && e.userName) existing.user = e.userName;
      map.set(sess, existing);
    }

    return map;
  }, [entries]);

  const availableSessions = useMemo(() => {
    return Array.from(sessionsMap.entries()).map(([sessionId, data]) => ({
      sessionId,
      user: data.user,
      count: data.entries.length,
      hasError: data.hasError,
    })).sort((a, b) => (b.hasError ? 1 : 0) - (a.hasError ? 1 : 0));
  }, [sessionsMap]);

  // Current active session
  const currentSession = selectedSessionId || availableSessions[0]?.sessionId || '';

  // Get and sort steps for active session
  const steps = useMemo(() => {
    if (!currentSession) return [];
    const sessionData = sessionsMap.get(currentSession);
    if (!sessionData) return [];

    const list = sessionData.entries.slice();
    list.sort((a, b) => {
      if (timelineOrder === 'newest') {
        if (a.timestampMs !== b.timestampMs) return b.timestampMs - a.timestampMs;
        return b.startLine - a.startLine;
      } else {
        if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
        return a.startLine - b.startLine;
      }
    });
    return list;
  }, [sessionsMap, currentSession, timelineOrder]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5 transition-colors">
      
      {/* Timeline Controls Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        
        {/* Session Selector */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <GitCommit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Session Execution Timeline
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Trace user interactions, field events, API calls, and failure point step-by-step
            </p>
          </div>
        </div>

        {/* Controls: Select Session & Toggle Order */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Session:</span>
            <select
              value={currentSession}
              onChange={(e) => onSessionChange(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium text-xs shadow-2xs"
            >
              {availableSessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  Session {s.sessionId} ({s.user || 'Unknown'}) - {s.count} steps {s.hasError ? '⚠️ [FAILED]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline Order Toggle */}
          <button
            onClick={() => setTimelineOrder(o => o === 'newest' ? 'oldest' : 'newest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              timelineOrder === 'newest'
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>
              {timelineOrder === 'newest' ? 'Latest Step First (See Failure First)' : 'Chronological (Replay User Steps)'}
            </span>
          </button>
        </div>

      </div>

      {/* Steps List */}
      {steps.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-xs">
          No steps available for the selected session.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
          {steps.map((step, index) => {
            const isFailed = step.status === 'FAIL';
            const isWarn = step.status === 'WARN';

            return (
              <div
                key={step.id}
                onClick={() => onSelectEntry(step)}
                className={`relative group p-4 rounded-xl border cursor-pointer transition-all ${
                  isFailed
                    ? 'border-rose-400 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 shadow-md shadow-rose-500/10'
                    : isWarn
                    ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xs'
                }`}
              >
                {/* Timeline Node Point */}
                <div
                  className={`absolute -left-[29px] top-4 w-4 h-4 rounded-full border-2 bg-white dark:bg-gray-900 flex items-center justify-center ${
                    isFailed
                      ? 'border-rose-500 text-rose-500 ring-4 ring-rose-500/20'
                      : isWarn
                      ? 'border-amber-500 text-amber-500'
                      : 'border-blue-500 text-blue-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isFailed ? 'bg-rose-500 animate-pulse' : isWarn ? 'bg-amber-500' : 'bg-blue-500'}`} />
                </div>

                {/* Step Top Bar */}
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-500 dark:text-gray-400">
                      Step #{timelineOrder === 'newest' ? steps.length - index : index + 1}
                    </span>
                    <span className="font-mono text-[11px] text-gray-400">
                      Line {step.startLine}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="font-mono text-[11px] text-gray-500">
                      {step.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isFailed && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                        FAILED STEP
                      </span>
                    )}
                    {step.stepSeq && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[10px] text-gray-500">
                        Seq: {step.stepSeq}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-1.5 text-xs">
                  {/* Event & Field info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {step.screen && (
                      <span className="font-bold text-gray-900 dark:text-white">
                        [{step.screen}]
                      </span>
                    )}
                    {step.field && (
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {step.field}
                      </span>
                    )}
                    {step.event && (
                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] border border-purple-200 dark:border-purple-800">
                        {step.event}
                      </span>
                    )}
                  </div>

                  {/* Scanned / Input Value */}
                  {step.scannedValue && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-800/80 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                      {step.isScan ? (
                        <Barcode className="w-4 h-4 text-blue-500" />
                      ) : (
                        <span className="text-gray-400 text-[10px]">Input:</span>
                      )}
                      <span className="font-bold text-gray-900 dark:text-white">{step.scannedValue}</span>
                      {step.targetField && (
                        <span className="text-gray-400 text-[10px]">
                          → Target: {step.targetField}
                        </span>
                      )}
                    </div>
                  )}

                  {/* API Call Details */}
                  {step.apiDetails && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {step.apiDetails.method || 'API'}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {step.apiDetails.name || 'WebService'}
                      </span>
                      {step.apiDetails.responseCode && (
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          step.apiDetails.responseCode >= 400
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                        }`}>
                          HTTP {step.apiDetails.responseCode}
                        </span>
                      )}
                      {step.apiDetails.durationMs && (
                        <span className="text-[10px] text-gray-400">
                          ({step.apiDetails.durationMs} ms)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Highlighted Failure Callout */}
                  {isFailed && step.rootCauseHint && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-100/80 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-xs text-rose-800 dark:text-rose-300">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Root Cause:
                      </div>
                      <p className="text-xs font-medium">
                        {step.rootCauseHint}
                      </p>
                      {step.suggestedFix && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold pt-0.5">
                          Fix Recommendation: {step.suggestedFix}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Non-failure issue or warning */}
                  {!isFailed && step.rootCauseHint && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium pt-1">
                      {step.rootCauseHint}
                    </p>
                  )}
                </div>

                {/* Hover affordance */}
                <div className="mt-2 text-right">
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to view full payload & raw log lines →
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
