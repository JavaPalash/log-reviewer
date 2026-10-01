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
  Sparkles,
  ExternalLink,
  Terminal,
  Database
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
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'script' | 'api' | 'raw' | 'stack'>('overview');

  // Automatically switch tab if entry has script code and it's an error
  useEffect(() => {
    if (entry?.scriptCode && (entry.scriptErrorLine || entry.status === 'FAIL')) {
      setActiveTab('script');
    } else if (entry?.apiDetails && entry.status === 'FAIL') {
      setActiveTab('api');
    } else {
      setActiveTab('overview');
    }
  }, [entry?.id]);

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

  const scriptLines = entry.scriptCode ? entry.scriptCode.split('\n') : [];

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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Entry #{currentIndex + 1} of {totalCount}
                </h3>
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                  Line {entry.startLine === entry.endLine ? entry.startLine : `${entry.startLine}-${entry.endLine}`}
                </span>
                {entry.appType === 'SCM' && (
                  <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-300">
                    Oracle SCM Cloud
                  </span>
                )}
                {entry.appType === 'WMS' && (
                  <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300">
                    Oracle WMS Cloud
                  </span>
                )}
                {entry.tenant && (
                  <span className="px-1.5 py-0.2 rounded font-medium text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300">
                    {entry.tenant}
                  </span>
                )}
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

        {/* Root Cause Diagnostic Alert Box */}
        {entry.rootCauseHint && (
          <div className={`p-4 border-b ${
            isFailed
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
              : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isFailed ? 'text-rose-600' : 'text-amber-600'}`} />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wide uppercase text-[10px]">
                    Root Cause Diagnostic:
                  </span>
                  {entry.scriptErrorLine !== undefined && (
                    <span className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                      Line {entry.scriptErrorLine} in script
                    </span>
                  )}
                </div>
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
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-4 bg-white dark:bg-gray-900 text-xs flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Overview & Context
          </button>

          {entry.scriptCode && (
            <button
              onClick={() => setActiveTab('script')}
              className={`py-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'script'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Script Code</span>
              {entry.scriptErrorLine !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold">
                  L{entry.scriptErrorLine}
                </span>
              )}
            </button>
          )}

          {entry.apiDetails && (
            <button
              onClick={() => setActiveTab('api')}
              className={`py-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'api'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>API Details</span>
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
              
              {/* Flexi Method Inspector Card (if flexiMethod is present) */}
              {entry.flexiMethod && (
                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-bold text-purple-950 dark:text-purple-200 uppercase tracking-wider text-[11px]">
                        Flexi Method Invocation
                      </h4>
                    </div>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                      FlexiAPI.{entry.flexiMethod.methodName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-100 dark:border-purple-900">
                    {entry.flexiMethod.key && (
                      <div>
                        <span className="text-gray-400 block text-[10px]">Object / Session Key</span>
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300">{entry.flexiMethod.key}</span>
                      </div>
                    )}
                    {entry.flexiMethod.target && (
                      <div>
                        <span className="text-gray-400 block text-[10px]">Target Component</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{entry.flexiMethod.target}</span>
                      </div>
                    )}
                    {entry.flexiMethod.value && (
                      <div className="col-span-2">
                        <span className="text-gray-400 block text-[10px]">Stored / Assigned Value</span>
                        <pre className="font-mono text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white overflow-x-auto">
                          {entry.flexiMethod.value}
                        </pre>
                      </div>
                    )}
                    {entry.flexiMethod.message && (
                      <div className="col-span-2">
                        <span className="text-gray-400 block text-[10px]">Message Text</span>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {entry.flexiMethod.message}
                        </p>
                      </div>
                    )}
                    {entry.flexiMethod.query && (
                      <div className="col-span-2">
                        <span className="text-gray-400 block text-[10px]">SQL Query</span>
                        <pre className="font-mono text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-blue-700 dark:text-blue-300 overflow-x-auto whitespace-pre-wrap">
                          {entry.flexiMethod.query}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <span className="text-gray-400 block text-[10px]">Field / Component Name</span>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Username</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                      {entry.userName || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Session ID</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      {entry.sessionId ? `#${entry.sessionId}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Thread</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400 truncate block">
                      {entry.threadId || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Step Sequence</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {entry.stepSeq ? `[${entry.stepSeq}]` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Code Reference Card */}
              {entry.logCode && (
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2">
                  <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Internal Code Reference
                  </h4>
                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                    {entry.logCode}
                  </p>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: SCRIPT CODE */}
          {activeTab === 'script' && entry.scriptCode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-gray-900 dark:text-white text-xs">
                    BeanShell / Java Screen Event Script
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(entry.scriptCode || '', setCopiedScript)}
                  className="px-2.5 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
                </button>
              </div>

              {entry.scriptErrorLine !== undefined && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <strong>Script Failure:</strong> Error occurred on <strong>Line {entry.scriptErrorLine}</strong> (highlighted in red below).
                  </div>
                </div>
              )}

              {/* Code block with line numbers */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-200 font-mono text-xs overflow-x-auto p-4 shadow-inner max-h-[500px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {scriptLines.map((line, idx) => {
                      const lineNum = idx + 1;
                      const isErrorLine = entry.scriptErrorLine === lineNum;

                      return (
                        <tr
                          key={idx}
                          className={`${
                            isErrorLine
                              ? 'bg-rose-950/80 text-rose-200 font-bold border-l-4 border-rose-500'
                              : 'hover:bg-gray-900/60'
                          }`}
                        >
                          <td className="w-12 select-none pr-4 text-right text-gray-500 text-[11px]">
                            {lineNum}
                          </td>
                          <td className="whitespace-pre">
                            {line || ' '}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: API REQUEST & RESPONSE */}
          {activeTab === 'api' && entry.apiDetails && (
            <div className="space-y-4">
              
              {/* Endpoint Overview Card */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    REST WebService Call
                  </span>
                  {entry.apiDetails.responseCode !== undefined && (
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      entry.apiDetails.responseCode >= 400
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200'
                    }`}>
                      HTTP {entry.apiDetails.responseCode}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold font-mono text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {entry.apiDetails.method || 'GET'}
                    </span>
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all select-all font-semibold">
                      {entry.apiDetails.url || entry.apiDetails.name || 'API Endpoint'}
                    </span>
                  </div>

                  {entry.apiDetails.durationMs !== undefined && (
                    <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Duration: {entry.apiDetails.durationMs} ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Request Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Request Payload
                  </span>
                  {entry.apiDetails.requestPayload && (
                    <button
                      onClick={() => copyToClipboard(entry.apiDetails?.requestPayload || '', setCopiedPayload)}
                      className="px-2 py-0.5 rounded text-[11px] border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-300"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <pre className="font-mono text-xs bg-gray-950 text-gray-200 p-3.5 rounded-xl border border-gray-800 overflow-x-auto max-h-60 select-all">
                  {entry.apiDetails.requestPayload ? formatJsonIfPossible(entry.apiDetails.requestPayload) : '<no payload>'}
                </pre>
              </div>

              {/* Response Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Response Body
                  </span>
                  {entry.apiDetails.responseBody && (
                    <button
                      onClick={() => copyToClipboard(entry.apiDetails?.responseBody || '', setCopiedResponse)}
                      className="px-2 py-0.5 rounded text-[11px] border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-300"
                    >
                      {copiedResponse ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <pre className="font-mono text-xs bg-gray-950 text-gray-200 p-3.5 rounded-xl border border-gray-800 overflow-x-auto max-h-72 select-all">
                  {entry.apiDetails.responseBody ? formatJsonIfPossible(entry.apiDetails.responseBody) : '<no response body>'}
                </pre>
              </div>

            </div>
          )}

          {/* TAB 4: STACK TRACE */}
          {activeTab === 'stack' && entry.error?.stackTrace && (
            <div className="space-y-3">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200">
                <strong>{entry.error.type}:</strong> {entry.error.message}
              </div>
              <div className="p-3.5 bg-gray-950 text-rose-300 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto max-h-96 space-y-1 select-all">
                {entry.error.stackTrace.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: RAW LOG LINES */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">
                  {entry.rawLines.length} raw line(s) from log file
                </span>
                <button
                  onClick={() => copyToClipboard(entry.rawLines.join('\n'), setCopiedRaw)}
                  className="px-2.5 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRaw ? 'Copied' : 'Copy All'}</span>
                </button>
              </div>
              <div className="p-3.5 bg-gray-950 text-gray-200 font-mono text-xs rounded-xl border border-gray-800 overflow-x-auto max-h-[500px] space-y-1 select-all">
                {entry.rawLines.map((line, idx) => (
                  <div key={idx} className="whitespace-pre hover:bg-gray-900/60 py-0.5">
                    {line}
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
