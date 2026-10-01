'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileCode, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FileText,
  Sparkles,
  ArrowDownCircle
} from 'lucide-react';
import { ParsedLogFile } from '../lib/types';

interface LogUploaderProps {
  files: ParsedLogFile[];
  onFilesAdded: (newFiles: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onClearAll: () => void;
  isParsing: boolean;
  parseProgress: { percent: number; message: string };
  onLoadSample: (type: 'screen' | 'server') => void;
}

export const LogUploader: React.FC<LogUploaderProps> = ({
  files,
  onFilesAdded,
  onRemoveFile,
  onClearAll,
  isParsing,
  parseProgress,
  onLoadSample,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesAdded(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onFilesAdded(selected);
      // reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 transition-colors">
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".log,.txt,.json,.csv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {files.length === 0 ? (
        /* Empty State / Initial Drop Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[0.99]'
              : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 bg-gray-50/50 dark:bg-gray-800/40'
          }`}
        >
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Upload Flexi Application Log Files
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            Drag and drop one or more log files here, or click to browse. Handles large logs (50MB+) using client-side background workers.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition-colors"
            >
              Browse Files (.log, .txt)
            </button>
            <span className="text-xs text-gray-400">or test immediately with sample logs:</span>
            <button
              type="button"
              onClick={() => onLoadSample('screen')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Try Flexi Screen Log (WS-G-HK)
            </button>
            <button
              type="button"
              onClick={() => onLoadSample('server')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 flex items-center gap-1.5 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              Try Server Error Log (flexi-error)
            </button>
          </div>

          {/* Supported formats pills */}
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <span>Supports:</span>
            <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">.log</span>
            <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">.txt</span>
            <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">.json</span>
            <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">.csv</span>
          </div>
        </div>
      ) : (
        /* Active Files List */
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Loaded Files ({files.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
              >
                + Add More Files
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate" title={f.fileName}>
                      {f.fileName}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(f.fileSize)}</span>
                    <span>•</span>
                    <span>{f.totalLines.toLocaleString()} lines</span>
                    <span>•</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{f.totalEntries} entries</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {f.errorCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                        {f.errorCount} Errors
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        0 Errors
                      </span>
                    )}
                    {f.warnCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        {f.warnCount} Warnings
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveFile(f.id)}
                  title="Remove file"
                  className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar when parsing */}
      {isParsing && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1.5">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              {parseProgress.message || 'Parsing log file in background worker...'}
            </span>
            <span>{parseProgress.percent}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-200 ease-out"
              style={{ width: `${parseProgress.percent}%` }}
            />
          </div>
        </div>
      )}

    </div>
  );
};
