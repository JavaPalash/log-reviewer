'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Server, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Code, 
  Barcode, 
  Clock, 
  User, 
  Layers, 
  ExternalLink 
} from 'lucide-react';
import { LogEntry } from '../lib/types';

interface DetailPanelProps {
  entry: LogEntry | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  entry,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}) => {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'raw' | 'stack'>('overview');

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate('prev');
      if (e.key === 'ArrowRight' && hasNext) onNavigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  if (!entry) return null;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const formatJsonIfPossible = (str?: string) => {
    if (!str) return '';
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  };

  const isFailed = entry.status === 'FAIL';
  const isWarn = entry.status === 'WARN';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end transition-opacity">
      
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 transition-colors animate-in slide-in-from-right duration-200">
        
        {/* Panel Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/80 dark:bg-gray-900/80">
          
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
              isFailed
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-300'
                : isWarn
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300'
            }`}>
              {entry.status}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Entry #{currentIndex + 1} of {totalCount}
                </h3>
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                  Line {entry.startLine === entry.endLine ? entry.startLine : `${entry.startLine}-${entry.endLine}`}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-mono">
                {entry.fileName} • {entry.timestamp}
              </p>
            </div>
          </div>

          {/* Navigation & Close */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigate('prev')}
              disabled={!hasPrev}
              title="Previous entry (ArrowLeft)"
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={!hasNext}
              title="Next entry (ArrowRight)"
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close panel (Escape)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Root Cause Hint Alert Box (if issue) */}
        {entry.rootCauseHint && (
          <div className={`p-4 border-b ${
            isFailed
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
              : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isFailed ? 'text-rose-600' : 'text-amber-600'}`} />
              <div className="space-y-1 text-xs">
                <span className="font-bold tracking-wide uppercase text-[10px]">
                  Root Cause Diagnostic:
                </span>
                <p className="font-semibold leading-relaxed">
                  {entry.rootCauseHint}
                </p>
                {entry.suggestedFix && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-1">
                    <strong>Suggested Fix:</strong> {entry.suggestedFix}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-4 bg-white dark:bg-gray-900 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Overview & Fields
          </button>
          {entry.apiDetails && (
            <button
              onClick={() => setActiveTab('api')}
              className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'api'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              API Request & Response
            </button>
          )}
          {entry.error?.stackTrace && entry.error.stackTrace.length > 0 && (
            <button
              onClick={() => setActiveTab('stack')}
              className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'stack'
                  ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Stack Trace
            </button>
          )}
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'raw'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Raw Log Lines ({entry.rawLines.length})
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Field & Event Card */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-3">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Screen & Field Context
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Screen / Page</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{entry.screen || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Field Name</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{entry.field || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Event Type</span>
                    <span className="px-1.5 py-0.5 rounded font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-block">
                      {entry.event || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Scanned / Input Value</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900 dark:text-white">
                      {entry.isScan && <Barcode className="w-3.5 h-3.5 text-blue-500" />}
                      <span>{entry.scannedValue || '<empty>'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User & Session Card */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-3">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  User Session & Thread
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">User Name</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{entry.userName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Session ID</span>
                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{entry.sessionId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Thread ID</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">{entry.threadId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Sequence Step</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">{entry.stepSeq || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Code Reference Card */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Code Reference & Logger
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Logger:</span>
                    <code className="text-gray-800 dark:text-gray-200 font-bold">{entry.logger || 'N/A'}</code>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Class / Method:</span>
                    <code className="text-indigo-600 dark:text-indigo-400 font-bold">{entry.logCode || 'N/A'}</code>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Log File Lines:</span>
                    <code className="text-gray-700 dark:text-gray-300 font-bold">L{entry.startLine} to L{entry.endLine}</code>
                  </div>
                </div>
              </div>

              {/* Missing Value Alert */}
              {entry.missingValueDetails && (
                <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 space-y-1.5">
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px]">
                    Missing / Null Data Detected
                  </h4>
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    {entry.missingValueDetails.reason}
                  </p>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    Source: <strong>{entry.missingValueDetails.sourceObject}</strong>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: API DETAILS */}
          {activeTab === 'api' && entry.apiDetails && (
            <div className="space-y-4">
              
              {/* Endpoint & Method Bar */}
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-600 text-white">
                      {entry.apiDetails.method || 'GET'}
                    </span>
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {entry.apiDetails.name || 'WebService'}
                    </span>
                  </div>
                  {entry.apiDetails.responseCode && (
                    <span className={`px-2.5 py-0.5 rounded font-bold text-xs ${
                      entry.apiDetails.responseCode >= 400
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    }`}>
                      HTTP {entry.apiDetails.responseCode}
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-mono break-all text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                  {entry.apiDetails.url || 'No URL available'}
                </div>

                {entry.apiDetails.durationMs && (
                  <div className="text-[11px] text-gray-500">
                    Total Time: <strong className="text-gray-800 dark:text-gray-200">{entry.apiDetails.durationMs} ms</strong>
                  </div>
                )}
              </div>

              {/* Request Payload */}
              {entry.apiDetails.requestPayload && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Request Payload</span>
                    <button
                      onClick={() => copyToClipboard(entry.apiDetails!.requestPayload || '', setCopiedPayload)}
                      className="px-2 py-0.5 rounded text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-gray-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                    {formatJsonIfPossible(entry.apiDetails.requestPayload)}
                  </pre>
                </div>
              )}

              {/* Response Body */}
              {entry.apiDetails.responseBody && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Response Body</span>
                    <button
                      onClick={() => copyToClipboard(entry.apiDetails!.responseBody || '', setCopiedResponse)}
                      className="px-2 py-0.5 rounded text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    >
                      {copiedResponse ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedResponse ? 'Copied' : 'Copy Response'}</span>
                    </button>
                  </div>
                  <pre className={`p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-60 ${
                    entry.apiDetails.responseCode && entry.apiDetails.responseCode >= 400
                      ? 'bg-rose-950/80 text-rose-200 border border-rose-900'
                      : 'bg-gray-900 text-blue-300'
                  }`}>
                    {formatJsonIfPossible(entry.apiDetails.responseBody)}
                  </pre>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: STACK TRACE */}
          {activeTab === 'stack' && entry.error?.stackTrace && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200">
                <strong>{entry.error.type}:</strong> {entry.error.message}
              </div>
              <pre className="p-3 rounded-lg bg-gray-900 text-rose-400 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
                {entry.error.stackTrace.join('\n')}
              </pre>
            </div>
          )}

          {/* TAB 4: RAW LOG LINES */}
          {activeTab === 'raw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Original lines {entry.startLine} to {entry.endLine} (Original File Order)
                </span>
                <button
                  onClick={() => copyToClipboard(entry.rawLines.join('\n'), setCopiedRaw)}
                  className="px-2.5 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 flex items-center gap-1"
                >
                  {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRaw ? 'Copied' : 'Copy All Lines'}</span>
                </button>
              </div>

              <div className="rounded-lg bg-gray-900 text-gray-200 font-mono text-[11px] p-3 overflow-x-auto max-h-[500px]">
                {entry.rawLines.map((line, idx) => (
                  <div key={idx} className="flex hover:bg-gray-800/60 py-0.5">
                    <span className="w-12 shrink-0 select-none text-gray-500 text-right pr-3 font-mono">
                      {entry.startLine + idx}
                    </span>
                    <span className="whitespace-pre-wrap break-all">
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
