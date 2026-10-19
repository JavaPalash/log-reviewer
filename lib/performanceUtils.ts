import { LogEntry, ParsedLogFile } from './types';
import { ScreenTransaction, ScreenEventDetail, PerformanceSummary } from './performanceTypes';

/**
 * Format duration in milliseconds to human-friendly string
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const sec = ms / 1000;
  if (sec < 60) {
    return `${sec.toFixed(2)}s (${ms.toLocaleString()} ms)`;
  }
  const mins = Math.floor(sec / 60);
  const remSec = (sec % 60).toFixed(1);
  return `${mins}m ${remSec}s (${ms.toLocaleString()} ms)`;
}

export function formatShortDuration(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(2)}s`;
  const mins = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${mins}m ${remSec}s`;
}

/**
 * Extract timestamp string and epoch ms from a log line
 */
function parseTimestamp(line: string): { str: string; ms: number } | null {
  const m = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/);
  if (!m) return null;
  const str = m[1];
  try {
    const ms = Date.parse(str.replace(' ', 'T') + 'Z');
    return { str, ms: isNaN(ms) ? 0 : ms };
  } catch {
    return { str, ms: 0 };
  }
}

/**
 * Extracts all lines from ParsedLogFiles or LogEntries
 */
function getLinesFromSources(sources: (ParsedLogFile | LogEntry)[]): { line: string; lineNo: number; fileName: string; fileId: string; appType: 'SCM' | 'WMS' | 'UNKNOWN' }[] {
  const result: { line: string; lineNo: number; fileName: string; fileId: string; appType: 'SCM' | 'WMS' | 'UNKNOWN' }[] = [];

  // Check if sources are ParsedLogFile
  if (sources.length > 0 && 'entries' in sources[0] && Array.isArray((sources[0] as ParsedLogFile).entries)) {
    for (const f of sources as ParsedLogFile[]) {
      const fAppType = f.appType || 'UNKNOWN';
      for (const entry of f.entries) {
        let currentLineNo = entry.startLine;
        for (const raw of entry.rawLines) {
          result.push({
            line: raw,
            lineNo: currentLineNo,
            fileName: f.fileName,
            fileId: f.id,
            appType: fAppType !== 'UNKNOWN' ? fAppType : entry.appType,
          });
          currentLineNo++;
        }
      }
    }
  } else {
    // Sources are LogEntry[]
    for (const entry of sources as LogEntry[]) {
      let currentLineNo = entry.startLine;
      for (const raw of entry.rawLines) {
        result.push({
          line: raw,
          lineNo: currentLineNo,
          fileName: entry.fileName,
          fileId: entry.fileId,
          appType: entry.appType,
        });
        currentLineNo++;
      }
    }
  }

  // Deduplicate lines by lineNo and fileName if any overlap
  const seen = new Set<string>();
  const deduped: typeof result = [];
  for (const item of result) {
    const key = `${item.fileName}:${item.lineNo}:${item.line}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped;
}

/**
 * Main function: Analyzes logs and constructs complete ScreenTransaction lifecycle objects
 */
export function extractScreenTransactions(sources: (ParsedLogFile | LogEntry)[]): ScreenTransaction[] {
  if (!sources || sources.length === 0) return [];

  const rawLinesWithMeta = getLinesFromSources(sources);
  if (rawLinesWithMeta.length === 0) return [];

  const transactions: ScreenTransaction[] = [];
  let currentTx: ScreenTransaction | null = null;
  let lastAction: {
    type: string;
    target: string;
    source: string;
    value: string;
    isScan: boolean;
    seq: string;
    timeStr: string;
    timeMs: number;
    lineNo: number;
  } | null = null;
  let pendingTarget = '';

  for (let i = 0; i < rawLinesWithMeta.length; i++) {
    const { line, lineNo, fileName, fileId, appType } = rawLinesWithMeta[i];
    const time = parseTimestamp(line);
    const timeStr = time ? time.str : '';
    const timeMs = time ? time.ms : 0;

    // Extract User, Session, Thread
    let user = '';
    let session = '';
    let thread = '';
    const tm = line.match(/\[([A-Za-z0-9_.\-@]+)\((\d+)\)(?:-\[\((\d+)\)Thread-([0-9A-Za-z_-]+)\])?(?:-\[(\d+)\])?\]/);
    if (tm) {
      user = tm[1];
      session = tm[2];
      thread = tm[4] ? `Thread-${tm[4]}` : '';
    }

    // 1. Capture User UI Input (FlexiRuntime.handleUI)
    if (line.includes('FlexiRuntime.handleUI:inputData=')) {
      const targetM = line.match(/target='(.*?)'/);
      const sourceM = line.match(/source='(.*?)'/);
      const valM = line.match(/value='(.*?)'/);
      const isScanM = line.match(/isScan='(.*?)'/);
      const seqM = line.match(/seq='(.*?)'/);

      lastAction = {
        type: 'INPUT',
        target: targetM ? targetM[1] : '',
        source: sourceM ? sourceM[1] : '',
        value: valM ? valM[1] : '',
        isScan: isScanM ? isScanM[1] === 'true' : false,
        seq: seqM ? seqM[1] : '',
        timeStr,
        timeMs,
        lineNo,
      };

      if (lastAction.target) {
        if (lastAction.target.startsWith('menu')) {
          pendingTarget = lastAction.target;
        } else if (appType === 'SCM' && lastAction.target !== 'Inbound' && lastAction.target !== 'Inventory') {
          pendingTarget = lastAction.target;
        }
      }
    } else if (line.includes('FlexiRuntime.handleUI: ')) {
      const actM = line.match(/handleUI:\s*([A-Za-z0-9_]+)\s+with\s+value\s+'(.*?)'\s+from\s+source\s+'(.*?)'\s+to\s+target\s+'(.*?)'/);
      if (actM) {
        if (!lastAction) {
          lastAction = {
            type: '',
            target: '',
            source: '',
            value: '',
            isScan: false,
            seq: '',
            timeStr,
            timeMs,
            lineNo,
          };
        }
        lastAction.type = actM[1];
        lastAction.value = actM[2];
        lastAction.source = actM[3];
        lastAction.target = actM[4];
        lastAction.timeStr = timeStr;
        lastAction.timeMs = timeMs;
        lastAction.lineNo = lineNo;

        if (lastAction.target) {
          if (lastAction.target.startsWith('menu')) {
            pendingTarget = lastAction.target;
          } else if (appType === 'SCM') {
            pendingTarget = lastAction.target;
          }
        }
      }
    }

    // 2. WMS Screen Lifecycle (Oracle WMS Cloud)
    if (appType === 'WMS' && line.includes('LogFirePage.performPersonalization:previousTitle=')) {
      const titleM = line.match(/previousTitle=(.*?),\s*currentTitle=(.*)$/);
      if (titleM) {
        const prevTitle = titleM[1].trim();
        const currTitle = titleM[2].trim();

        const currName = currTitle.includes('-')
          ? currTitle.substring(currTitle.lastIndexOf('-') + 1).trim()
          : '';

        const isMainMenu = currTitle.includes('/') && !currTitle.includes('-');

        if (isMainMenu) {
          // Exited screen back to menu (transaction completed)
          if (currentTx) {
            currentTx.endTime = timeStr;
            currentTx.endTimeMs = timeMs;
            currentTx.endLine = lineNo;
            currentTx.totalDurationMs = currentTx.endTimeMs && currentTx.startTimeMs ? Math.max(0, currentTx.endTimeMs - currentTx.startTimeMs) : 0;
            currentTx.totalDurationFormatted = formatDuration(currentTx.totalDurationMs);
            currentTx.status = 'COMPLETED';
            transactions.push(currentTx);
            currentTx = null;
          }
        } else if (currName) {
          if (!currentTx) {
            // New screen transaction
            currentTx = {
              id: `tx-wms-${transactions.length + 1}`,
              screenName: currName,
              screenCode: pendingTarget || currName,
              appType: 'WMS',
              fileName,
              fileId,
              userName: user,
              sessionId: session,
              threadId: thread,
              startTime: timeStr,
              startTimeMs: timeMs,
              endTime: '',
              endTimeMs: 0,
              totalDurationMs: 0,
              totalDurationFormatted: '',
              startLine: lineNo,
              endLine: lineNo,
              status: 'IN_PROGRESS',
              eventsCount: 0,
              apiCallsCount: 0,
              apiTotalDurationMs: 0,
              maxEventDurationMs: 0,
              slowestEventName: '',
              events: [],
            };
          } else if (currentTx.screenName !== currName) {
            // Internal step / sub-screen transition
            currentTx.events.push({
              id: `ev-${currentTx.events.length + 1}`,
              timestamp: timeStr,
              timestampMs: timeMs,
              durationMs: 0,
              durationFormatted: '0 ms',
              isReportedDuration: false,
              event: 'NAVIGATE',
              field: currName,
              value: '',
              lineNo,
              status: 'PASS',
              details: `Screen transitioned to "${currName}"`,
            });
          }
        }
      }
    }

    // 3. SCM Screen Lifecycle (Oracle SCM Cloud)
    if (appType === 'SCM') {
      if (line.includes('Session.openApplication:') || (line.includes('ActionType : OPEN_APPLICATION') && !currentTx)) {
        const appM = line.match(/(?:applicationID\s*|action\s*value\s*:\s*)(\d+)/);
        const appId = appM ? appM[1] : '';

        // Ignore duplicate openApplication logging within 500ms
        const isDuplicate = currentTx && currentTx.screenCode === appId && (timeMs - currentTx.startTimeMs < 500);

        if (!isDuplicate) {
          if (currentTx) {
            currentTx.endTime = timeStr;
            currentTx.endTimeMs = timeMs;
            currentTx.endLine = lineNo;
            currentTx.totalDurationMs = Math.max(0, currentTx.endTimeMs - currentTx.startTimeMs);
            currentTx.totalDurationFormatted = formatDuration(currentTx.totalDurationMs);
            currentTx.status = 'COMPLETED';
            transactions.push(currentTx);
          }

          currentTx = {
            id: `tx-scm-${transactions.length + 1}`,
            screenName: pendingTarget || `Application ${appId}`,
            screenCode: appId,
            appType: 'SCM',
            fileName,
            fileId,
            userName: user,
            sessionId: session,
            threadId: thread,
            startTime: timeStr,
            startTimeMs: timeMs,
            endTime: '',
            endTimeMs: 0,
            totalDurationMs: 0,
            totalDurationFormatted: '',
            startLine: lineNo,
            endLine: lineNo,
            status: 'IN_PROGRESS',
            eventsCount: 0,
            apiCallsCount: 0,
            apiTotalDurationMs: 0,
            maxEventDurationMs: 0,
            slowestEventName: '',
            events: [],
          };
          pendingTarget = '';
        }
      }

      // SCM Screen Title refinement from App Code
      if (currentTx && (line.includes('.onSessionApplicationEnterEvent') || line.includes('.runScript:_onPageEntered~'))) {
        const snM = line.match(/([A-Za-z0-9_]+)\.(?:onSessionApplicationEnterEvent|runScript:_onPageEntered~)/);
        if (snM && snM[1]) {
          currentTx.screenCode = snM[1];
          if (!currentTx.screenName || currentTx.screenName.startsWith('Application')) {
            currentTx.screenName = snM[1];
          }
        }
      }

      // SCM Screen Close
      if (currentTx && (line.includes('Session.closeApplication:') || line.includes('FlexiAPI.closeApplication') || line.includes('ActionType : EXIT_APPLICATION'))) {
        currentTx.endTime = timeStr;
        currentTx.endTimeMs = timeMs;
        currentTx.endLine = lineNo;
        currentTx.totalDurationMs = Math.max(0, currentTx.endTimeMs - currentTx.startTimeMs);
        currentTx.totalDurationFormatted = formatDuration(currentTx.totalDurationMs);
        currentTx.status = 'COMPLETED';
        transactions.push(currentTx);
        currentTx = null;
      }
    }

    // 4. Capture Event Timings inside active screen
    if (currentTx) {
      if (user && !currentTx.userName) currentTx.userName = user;
      if (session && !currentTx.sessionId) currentTx.sessionId = session;
      if (thread && !currentTx.threadId) currentTx.threadId = thread;

      // WMS LogFire SSH SendKey Time
      if (line.includes('LogFireSSHConnection.SendKey:LogFireTime=')) {
        const msM = line.match(/LogFireTime=(\d+)\s*ms/);
        const durationMs = msM ? parseInt(msM[1], 10) : 0;
        const fieldName = lastAction ? (lastAction.target || lastAction.source) : 'terminal';
        const evType = lastAction ? lastAction.type : 'SendKey';
        const evVal = lastAction ? lastAction.value : '';

        currentTx.events.push({
          id: `ev-${currentTx.events.length + 1}`,
          timestamp: timeStr,
          timestampMs: timeMs,
          durationMs,
          durationFormatted: `${durationMs} ms`,
          isReportedDuration: true,
          event: evType || 'ENTER',
          field: fieldName,
          value: evVal,
          stepSeq: lastAction?.seq || '',
          lineNo,
          status: durationMs > 2500 ? 'WARN' : 'PASS',
          details: `SSH Terminal Response (${durationMs} ms) on ${fieldName}`,
        });
      }

      // Script Events: onFocus, onExit, onKeyPress, onClick, etc.
      if (line.includes('.runScript:_') || line.includes('runScript:_')) {
        const se = line.match(/(?:([A-Za-z0-9_]+)\.)?runScript:_?([A-Za-z0-9]+)~([A-Za-z0-9_]+)/);
        if (se) {
          const evName = se[2];
          const fieldName = se[3] || se[1] || '';
          currentTx.events.push({
            id: `ev-${currentTx.events.length + 1}`,
            timestamp: timeStr,
            timestampMs: timeMs,
            durationMs: 0,
            durationFormatted: '0 ms',
            isReportedDuration: false,
            event: evName,
            field: fieldName,
            value: '',
            lineNo,
            status: 'PASS',
            details: `Script: ${evName} on ${fieldName}`,
          });
        }
      }

      // Script Initialization Duration
      if (line.includes('.script initialize = ')) {
        const sim = line.match(/([A-Za-z0-9_]+)\.script initialize\s*=\s*(\d+)\s*ms/);
        if (sim) {
          const field = sim[1];
          const durationMs = parseInt(sim[2], 10);
          if (currentTx.events.length > 0 && currentTx.events[currentTx.events.length - 1].field === field) {
            const ev = currentTx.events[currentTx.events.length - 1];
            ev.durationMs = durationMs;
            ev.durationFormatted = `${durationMs} ms`;
            ev.isReportedDuration = true;
          } else {
            currentTx.events.push({
              id: `ev-${currentTx.events.length + 1}`,
              timestamp: timeStr,
              timestampMs: timeMs,
              durationMs,
              durationFormatted: `${durationMs} ms`,
              isReportedDuration: true,
              event: 'script_init',
              field,
              value: '',
              lineNo,
              status: durationMs > 1000 ? 'WARN' : 'PASS',
              details: `Script initialize (${durationMs} ms) on ${field}`,
            });
          }
        }
      }

      // Web service / API Calls
      if (line.includes('.runWebService: Total time = ')) {
        const am = line.match(/([A-Za-z0-9_]+)\.runWebService:\s*Total time\s*=\s*(\d+)\s*ms/);
        if (am) {
          const apiName = am[1];
          const durationMs = parseInt(am[2], 10);
          currentTx.events.push({
            id: `ev-${currentTx.events.length + 1}`,
            timestamp: timeStr,
            timestampMs: timeMs,
            durationMs,
            durationFormatted: `${durationMs} ms`,
            isReportedDuration: true,
            event: 'API_CALL',
            field: apiName,
            value: '',
            lineNo,
            status: durationMs > 2000 ? 'WARN' : 'PASS',
            details: `Web Service API: ${apiName} (${durationMs} ms)`,
          });
        }
      }

      // DB Queries
      if (line.includes('Executing query to fetch') || line.includes('flexi.executeQuery')) {
        currentTx.events.push({
          id: `ev-${currentTx.events.length + 1}`,
          timestamp: timeStr,
          timestampMs: timeMs,
          durationMs: 0,
          durationFormatted: '0 ms',
          isReportedDuration: false,
          event: 'DB_QUERY',
          field: 'flexi.executeQuery',
          value: '',
          lineNo,
          status: 'PASS',
          details: line.substring(Math.max(0, line.indexOf('UserActionLogger - ') + 19)).substring(0, 80),
        });
      }
    }
  }

  // Final unclosed transaction
  if (currentTx) {
    if (!currentTx.endTime && currentTx.events.length > 0) {
      const lastEv = currentTx.events[currentTx.events.length - 1];
      currentTx.endTime = lastEv.timestamp;
      currentTx.endTimeMs = lastEv.timestampMs;
      currentTx.totalDurationMs = Math.max(0, currentTx.endTimeMs - currentTx.startTimeMs);
      currentTx.totalDurationFormatted = formatDuration(currentTx.totalDurationMs);
    }
    transactions.push(currentTx);
  }

  // Calculate interval deltas for events without explicit reported ms
  for (const tx of transactions) {
    for (let k = 0; k < tx.events.length; k++) {
      const ev = tx.events[k];
      if (!ev.isReportedDuration && k < tx.events.length - 1) {
        const nextEv = tx.events[k + 1];
        const delta = nextEv.timestampMs - ev.timestampMs;
        if (delta > 0 && delta < 300000) { // < 5 mins
          ev.durationMs = delta;
          ev.durationFormatted = `${delta} ms`;
        }
      }
    }

    // Rollups
    tx.eventsCount = tx.events.length;
    tx.apiCallsCount = tx.events.filter(e => e.event === 'API_CALL').length;
    tx.apiTotalDurationMs = tx.events.filter(e => e.event === 'API_CALL').reduce((sum, e) => sum + e.durationMs, 0);

    let maxEv = 0;
    let slowestName = '';
    for (const ev of tx.events) {
      if (ev.durationMs > maxEv) {
        maxEv = ev.durationMs;
        slowestName = `${ev.event} on ${ev.field} (${ev.durationFormatted})`;
      }
      if (ev.status === 'FAIL') {
        tx.status = 'HAS_ERROR';
      }
    }
    tx.maxEventDurationMs = maxEv;
    tx.slowestEventName = slowestName || 'N/A';
  }

  return transactions;
}

/**
 * Computes top-level performance KPIs
 */
export function calculatePerformanceSummary(transactions: ScreenTransaction[]): PerformanceSummary {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0,
      avgDurationMs: 0,
      avgDurationFormatted: '0 ms',
      maxDurationMs: 0,
      slowestScreen: 'N/A',
      totalEventsCount: 0,
      avgEventDurationMs: 0,
      screenNames: [],
    };
  }

  const screenNameSet = new Set<string>();
  let totalDuration = 0;
  let maxDuration = 0;
  let slowestScreen = '';
  let totalEvents = 0;
  let totalEventDuration = 0;
  let measuredEventsCount = 0;

  for (const tx of transactions) {
    screenNameSet.add(tx.screenName);
    totalDuration += tx.totalDurationMs;
    if (tx.totalDurationMs > maxDuration) {
      maxDuration = tx.totalDurationMs;
      slowestScreen = `${tx.screenName} (${formatShortDuration(tx.totalDurationMs)})`;
    }
    totalEvents += tx.eventsCount;
    for (const ev of tx.events) {
      if (ev.durationMs > 0) {
        totalEventDuration += ev.durationMs;
        measuredEventsCount++;
      }
    }
  }

  const avgDurationMs = Math.round(totalDuration / transactions.length);
  const avgEventDurationMs = measuredEventsCount > 0 ? Math.round(totalEventDuration / measuredEventsCount) : 0;

  return {
    totalTransactions: transactions.length,
    avgDurationMs,
    avgDurationFormatted: formatDuration(avgDurationMs),
    maxDurationMs: maxDuration,
    slowestScreen: slowestScreen || 'N/A',
    totalEventsCount: totalEvents,
    avgEventDurationMs,
    screenNames: Array.from(screenNameSet).sort(),
  };
}
