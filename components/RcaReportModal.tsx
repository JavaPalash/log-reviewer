'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Sparkles, 
  Check, 
  AlertCircle,
  Edit3
} from 'lucide-react';
import { LogEntry, RcaReportData } from '../lib/types';
import { generateHtmlRcaReport, exportToPdf, exportToExcel } from '../lib/exportUtils';

interface RcaReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LogEntry[];
  analyzedFiles: string[];
}

export const RcaReportModal: React.FC<RcaReportModalProps> = ({
  isOpen,
  onClose,
  entries,
  analyzedFiles,
}) => {
  // Filter issues only (status FAIL or WARN or isIssue)
  const allIssues = useMemo(() => {
    return entries.filter(e => e.status === 'FAIL' || e.isIssue);
  }, [entries]);

  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(() => {
    return new Set(allIssues.map(i => i.id));
  });

  // Calculate high-level stats
  const dateRangeStr = useMemo(() => {
    if (entries.length === 0) return 'N/A';
    const sorted = entries.filter(e => e.timestamp).sort((a, b) => a.timestampMs - b.timestampMs);
    if (sorted.length === 0) return 'N/A';
    return `${sorted[0].timestamp} to ${sorted[sorted.length - 1].timestamp}`;
  }, [entries]);

  const uniqueUsers = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.userName) s.add(e.userName); });
    return Array.from(s);
  }, [entries]);

  const uniqueSessions = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.sessionId) s.add(e.sessionId); });
    return Array.from(s);
  }, [entries]);

  // Generate initial diagnostic summaries based on actual detected failures
  const initialRootCause = useMemo(() => {
    const failApis = allIssues.filter(e => e.apiDetails?.responseCode && e.apiDetails.responseCode >= 400);
    const exceptions = allIssues.filter(e => e.error);
    const timeouts = allIssues.filter(e => e.issueCategory === 'SESSION_TIMEOUT');

    const points: string[] = [];
    if (failApis.length > 0) {
      const distinctFailures = Array.from(new Set(failApis.map(a => `${a.apiDetails?.name || a.apiDetails?.url} (HTTP ${a.apiDetails?.responseCode})`)));
      points.push(`- API Failures: Observed ${failApis.length} failed REST API requests across endpoint(s): ${distinctFailures.join(', ')}.`);
    }
    if (exceptions.length > 0) {
      const distinctExc = Array.from(new Set(exceptions.map(e => e.error?.type || 'Exception')));
      points.push(`- Runtime Exceptions: Detected ${exceptions.length} exception events, primarily ${distinctExc.join(', ')}.`);
    }
    if (timeouts.length > 0) {
      points.push(`- Inactive Sessions: ${timeouts.length} session(s) were terminated by SessionMonitor due to reaching the 120-minute idle threshold.`);
    }
    if (points.length === 0) {
      points.push(`- No critical exceptions or API failures were flagged in the analyzed timeframe.`);
    }
    return points.join('\n');
  }, [allIssues]);

  const initialImpact = useMemo(() => {
    return `Warehouse operations for user(s) [${uniqueUsers.join(', ') || 'N/A'}] across session(s) [${uniqueSessions.join(', ') || 'N/A'}] were interrupted. Scanned barcodes could not be validated or dispatched, resulting in transactional pauses at the RF terminal level.`;
  }, [uniqueUsers, uniqueSessions]);

  const initialResolution = useMemo(() => {
    return `1. Verify backend Oracle WMS master data to confirm scanned LPNs, containers, and shipments exist and have not already completed receipt.\n2. Ensure SSH terminal connections between the Flexi server and host environment remain stable without packet drops.\n3. Adjust Non_Flexi_Connection_TimeOut in config.properties if longer operator idle periods are necessary in active warehouse operations.`;
  }, []);

  const [rootCauseSummary, setRootCauseSummary] = useState(initialRootCause);
  const [impactAnalysis, setImpactAnalysis] = useState(initialImpact);
  const [recommendedResolution, setRecommendedResolution] = useState(initialResolution);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIssueIds.size === allIssues.length) {
      setSelectedIssueIds(new Set());
    } else {
      setSelectedIssueIds(new Set(allIssues.map(i => i.id)));
    }
  };

  const toggleIssue = (id: string) => {
    const next = new Set(selectedIssueIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIssueIds(next);
  };

  const selectedIssuesList = allIssues.filter(i => selectedIssueIds.has(i.id));

  const handleDownloadHtml = () => {
    const rcaData: RcaReportData = {
      title: 'Intellinum Flexi - Root Cause Analysis (RCA) Report',
      dateRange: dateRangeStr,
      analyzedFiles,
      totalLogs: entries.length,
      totalIssues: selectedIssuesList.length,
      uniqueUsers,
      uniqueSessions,
      rootCauseSummary,
      impactAnalysis,
      recommendedResolution,
      selectedIssues: selectedIssuesList,
    };

    const htmlContent = generateHtmlRcaReport(rcaData);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Flexi_RCA_Report_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    exportToPdf(selectedIssuesList, `Flexi_RCA_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleDownloadExcel = () => {
    exportToExcel(selectedIssuesList, `Flexi_RCA_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    const rcaData: RcaReportData = {
      title: 'Intellinum Flexi - Root Cause Analysis (RCA) Report',
      dateRange: dateRangeStr,
      analyzedFiles,
      totalLogs: entries.length,
      totalIssues: selectedIssuesList.length,
      uniqueUsers,
      uniqueSessions,
      rootCauseSummary,
      impactAnalysis,
      recommendedResolution,
      selectedIssues: selectedIssuesList,
    };
    const html = generateHtmlRcaReport(rcaData);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 transition-opacity">
      
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/80 dark:bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                Root Cause Analysis (RCA) Report Generator
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Customizable, client-ready report based on bottom-to-top log findings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Executive Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Issues Selected</span>
              <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                {selectedIssuesList.length} of {allIssues.length}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Date Range</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block" title={dateRangeStr}>
                {dateRangeStr}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Impacted Users</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {uniqueUsers.length} ({uniqueUsers.join(', ') || 'N/A'})
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Source Files</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block" title={analyzedFiles.join(', ')}>
                {analyzedFiles.join(', ')}
              </span>
            </div>
          </div>

          {/* Section 1: Root Cause Summary (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                1. Root Cause Summary (Editable)
              </label>
              <span className="text-gray-400 text-[10px]">Adjust before export</span>
            </div>
            <textarea
              rows={4}
              value={rootCauseSummary}
              onChange={(e) => setRootCauseSummary(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-sans text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Section 2: Impact Analysis (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                2. Business & System Impact (Editable)
              </label>
              <span className="text-gray-400 text-[10px]">Adjust before export</span>
            </div>
            <textarea
              rows={3}
              value={impactAnalysis}
              onChange={(e) => setImpactAnalysis(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-sans text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Section 3: Recommended Resolution (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                3. Recommended Resolution & Action Plan (Editable)
              </label>
              <span className="text-gray-400 text-[10px]">Adjust before export</span>
            </div>
            <textarea
              rows={3}
              value={recommendedResolution}
              onChange={(e) => setRecommendedResolution(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-sans text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Section 4: Issues Selection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                4. Select Issues to Include in Report ({selectedIssuesList.length} of {allIssues.length})
              </h3>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                {selectedIssueIds.size === allIssues.length ? 'Deselect All' : 'Select All Issues'}
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2 w-8 text-center">✓</th>
                    <th className="p-2">Line</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Screen / Field</th>
                    <th className="p-2">API / Error</th>
                    <th className="p-2">Root Cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {allIssues.map((issue) => {
                    const isSelected = selectedIssueIds.has(issue.id);
                    return (
                      <tr
                        key={issue.id}
                        onClick={() => toggleIssue(issue.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                        }`}
                      >
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleIssue(issue.id)}
                            className="rounded text-blue-600"
                          />
                        </td>
                        <td className="p-2 font-mono font-bold text-gray-700 dark:text-gray-300">
                          L{issue.startLine}
                        </td>
                        <td className="p-2 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {issue.timestamp}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <strong>{issue.screen || '-'}</strong> ({issue.field || '-'})
                        </td>
                        <td className="p-2">
                          {issue.apiDetails ? (
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              {issue.apiDetails.method} {issue.apiDetails.name} ({issue.apiDetails.responseCode})
                            </span>
                          ) : (
                            <span className="font-semibold text-rose-600">
                              {issue.error?.type || 'Issue'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-gray-600 dark:text-gray-300 truncate max-w-xs" title={issue.rootCauseHint}>
                          {issue.rootCauseHint}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer / Export Triggers */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Exporting {selectedIssuesList.length} issue(s) in selected order
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              disabled={selectedIssuesList.length === 0}
              className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              onClick={handleDownloadExcel}
              disabled={selectedIssuesList.length === 0}
              className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 font-semibold flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Excel (.xlsx)
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={selectedIssuesList.length === 0}
              className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-100 font-semibold flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              PDF Report
            </button>

            <button
              onClick={handleDownloadHtml}
              disabled={selectedIssuesList.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Download HTML RCA
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
