import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LogEntry, RcaReportData } from './types';

/**
 * Export entries to Excel (.xlsx)
 */
export function exportToExcel(entries: LogEntry[], filename = 'Log_Review_Export.xlsx') {
  const rows = entries.map(e => ({
    'Timestamp': e.timestamp,
    'Status': e.status,
    'Level': e.level,
    'User': e.userName,
    'Session ID': e.sessionId,
    'Screen': e.screen,
    'Field': e.field,
    'Event': e.event,
    'Scanned / Input Value': e.scannedValue,
    'Is Scan': e.isScan ? 'YES' : 'NO',
    'API Name': e.apiDetails?.name || '',
    'API Method': e.apiDetails?.method || '',
    'API URL': e.apiDetails?.url || '',
    'Response Code': e.apiDetails?.responseCode ?? '',
    'Duration (ms)': e.apiDetails?.durationMs ?? '',
    'Missing Value / Object': e.missingValueDetails ? `${e.missingValueDetails.field} (${e.missingValueDetails.sourceObject})` : '',
    'Error / Issue': e.error?.type || (e.isIssue ? e.issueCategory : ''),
    'Root Cause Hint': e.rootCauseHint,
    'Suggested Fix': e.suggestedFix,
    'Log Code / Class': e.logCode,
    'File': e.fileName,
    'Line No': e.startLine === e.endLine ? e.startLine : `${e.startLine}-${e.endLine}`,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Log Review');

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, 14)
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export entries to CSV
 */
export function exportToCsv(entries: LogEntry[], filename = 'Log_Review_Export.csv') {
  const headers = [
    'Timestamp',
    'Status',
    'Level',
    'User',
    'Session ID',
    'Screen',
    'Field',
    'Event',
    'Scanned Value',
    'API Method',
    'API URL',
    'Response Code',
    'Missing Value',
    'Root Cause Hint',
    'Log Code',
    'File',
    'Line No'
  ];

  const csvRows = [headers.join(',')];

  for (const e of entries) {
    const row = [
      escapeCsv(e.timestamp),
      escapeCsv(e.status),
      escapeCsv(e.level),
      escapeCsv(e.userName),
      escapeCsv(e.sessionId),
      escapeCsv(e.screen),
      escapeCsv(e.field),
      escapeCsv(e.event),
      escapeCsv(e.scannedValue),
      escapeCsv(e.apiDetails?.method || ''),
      escapeCsv(e.apiDetails?.url || ''),
      escapeCsv(e.apiDetails?.responseCode !== undefined ? e.apiDetails.responseCode.toString() : ''),
      escapeCsv(e.missingValueDetails?.field || ''),
      escapeCsv(e.rootCauseHint),
      escapeCsv(e.logCode),
      escapeCsv(e.fileName),
      escapeCsv(e.startLine.toString()),
    ];
    csvRows.push(row.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export entries to PDF
 */
export function exportToPdf(entries: LogEntry[], filename = 'Log_Review_Export.pdf') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Intellinum Flexi - Log Review Findings', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()} | Total Entries: ${entries.length}`, 40, 56);

  const tableHead = [['Time', 'Status', 'User/Session', 'Screen/Field', 'Event', 'Scanned Val', 'API / Error', 'Root Cause', 'Line']];
  
  const tableData = entries.slice(0, 200).map(e => [
    e.timestamp.replace(/^\d{4}-/, ''),
    e.status,
    `${e.userName || '-'}\n[${e.sessionId || '-'}]`,
    `${e.screen || '-'}\n${e.field || '-'}`,
    e.event || '-',
    e.scannedValue || '-',
    e.apiDetails ? `${e.apiDetails.method || ''} ${e.apiDetails.name || ''} (${e.apiDetails.responseCode || '-'})` : (e.error?.type || '-'),
    (e.rootCauseHint || '-').substring(0, 120),
    `L${e.startLine}`,
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableData,
    startY: 70,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { cellWidth: 70 },
      3: { cellWidth: 75 },
      4: { cellWidth: 60 },
      5: { cellWidth: 75 },
      6: { cellWidth: 95 },
      7: { cellWidth: 200 },
      8: { cellWidth: 40 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'FAIL') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'WARN') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'PASS') {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    }
  });

  doc.save(filename);
}

/**
 * Generate full shareable RCA Report in standalone HTML
 */
export function generateHtmlRcaReport(rca: RcaReportData): string {
  const issuesHtml = rca.selectedIssues.map((e, idx) => `
    <tr class="${e.status === 'FAIL' ? 'fail-row' : 'warn-row'}">
      <td><strong>#${idx + 1}</strong></td>
      <td><code>${e.timestamp}</code></td>
      <td><strong>${escapeHtml(e.userName || 'N/A')}</strong><br><small>Session: ${escapeHtml(e.sessionId || 'N/A')}</small></td>
      <td><strong>${escapeHtml(e.screen || 'N/A')}</strong><br><small>${escapeHtml(e.field || 'N/A')} (${escapeHtml(e.event || 'N/A')})</small></td>
      <td><code>${escapeHtml(e.scannedValue || 'None')}</code></td>
      <td>
        ${e.apiDetails ? `
          <span class="badge badge-api">${escapeHtml(e.apiDetails.method || '')}</span> <strong>${escapeHtml(e.apiDetails.name || 'API')}</strong>
          <br><span class="badge ${e.apiDetails.responseCode && e.apiDetails.responseCode >= 400 ? 'badge-fail' : 'badge-pass'}">HTTP ${e.apiDetails.responseCode || 'N/A'}</span>
          <br><small class="url-text">${escapeHtml(e.apiDetails.url || '')}</small>
        ` : 'N/A'}
      </td>
      <td>
        ${e.missingValueDetails ? `
          <span class="missing-val">Missing: <strong>${escapeHtml(e.missingValueDetails.field)}</strong></span>
          <br><small>From: ${escapeHtml(e.missingValueDetails.sourceObject || 'N/A')}</small>
        ` : '<span class="text-muted">None</span>'}
      </td>
      <td>
        <p class="root-cause-text">${escapeHtml(e.rootCauseHint || 'Unknown issue')}</p>
        <p class="suggested-fix-text"><strong>Fix:</strong> ${escapeHtml(e.suggestedFix || 'Review screen configuration')}</p>
        <small class="code-ref">Code: <code>${escapeHtml(e.logCode || 'N/A')}</code> | Line: <code>${e.startLine}</code></small>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(rca.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .header .meta { color: #64748b; font-size: 13px; text-align: right; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-card .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .stat-card .value { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; color: #334155; margin-bottom: 12px; border-left: 4px solid #0284c7; padding-left: 8px; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px 8px; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .fail-row { background: #fef2f2; }
    .warn-row { background: #fffbeb; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge-api { background: #e0e7ff; color: #3730a3; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .root-cause-text { margin: 0 0 4px 0; color: #b91c1c; font-weight: 600; }
    .suggested-fix-text { margin: 0 0 4px 0; color: #15803d; }
    .missing-val { color: #c2410c; }
    .code-ref { color: #64748b; font-size: 11px; }
    .url-text { word-break: break-all; color: #475569; }
    @media print {
      body { background: #fff; padding: 0; }
      .container { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Intellinum Flexi - Root Cause Analysis (RCA) Report</h1>
        <p style="margin:4px 0 0 0; color:#64748b;">Screen Application Log Review & Failure Diagnostic</p>
      </div>
      <div class="meta">
        <div><strong>Date Range:</strong> ${escapeHtml(rca.dateRange || 'N/A')}</div>
        <div><strong>Analyzed Files:</strong> ${escapeHtml(rca.analyzedFiles.join(', '))}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card danger">
        <div class="label">Total Issues Detected</div>
        <div class="value">${rca.totalIssues}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Logs Analyzed</div>
        <div class="value">${rca.totalLogs.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="label">Impacted Users</div>
        <div class="value">${rca.uniqueUsers.length} <small style="font-size:12px; font-weight:normal;">(${escapeHtml(rca.uniqueUsers.join(', '))})</small></div>
      </div>
      <div class="stat-card">
        <div class="label">Impacted Sessions</div>
        <div class="value">${rca.uniqueSessions.length}</div>
      </div>
    </div>

    <div class="section">
      <h2>1. Root Cause Summary</h2>
      <div class="summary-box">${escapeHtml(rca.rootCauseSummary)}</div>
    </div>

    <div class="section">
      <h2>2. Impact Analysis</h2>
      <div class="summary-box">${escapeHtml(rca.impactAnalysis)}</div>
    </div>

    <div class="section">
      <h2>3. Recommended Resolution & Corrective Actions</h2>
      <div class="summary-box">${escapeHtml(rca.recommendedResolution)}</div>
    </div>

    <div class="section">
      <h2>4. Detailed Issue Breakdown (Newest First)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Timestamp</th>
            <th>User / Session</th>
            <th>Screen / Field (Event)</th>
            <th>Scanned Value</th>
            <th>API Details</th>
            <th>Missing Value</th>
            <th>Root Cause & Suggested Fix</th>
          </tr>
        </thead>
        <tbody>
          ${issuesHtml}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function escapeCsv(str: string): string {
  if (str === null || str === undefined) return '""';
  const text = str.toString().replace(/"/g, '""');
  return `"${text}"`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
