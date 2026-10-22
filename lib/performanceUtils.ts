import { LogEntry, ParsedLogFile } from './types';
import { ScreenTransaction, ScreenEventDetail, PerformanceSummary, DelayCategory } from './performanceTypes';

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
 * Format WMS Control Keys and Function Keys into clear user actions
 */
export function formatControlKey(target?: string, value?: string): string {
  const t = (target || value || '').toUpperCase().trim();
  switch (t) {
    case 'P': return 'Ctrl-P (Exec Task / Printer)';
    case 'E': return 'Ctrl-E (Close LPN)';
    case 'W': return 'Ctrl-W (Previous Screen)';
    case 'X': return 'Ctrl-X (Exit App)';
    case 'D': return 'Ctrl-D (Page Down)';
    case 'U': return 'Ctrl-U (Page Up)';
    case 'L': return 'Ctrl-L (Change Location / Language)';
    case 'F': return 'Ctrl-F (Change Facility)';
    case 'O': return 'Ctrl-O (Restrict Company)';
    case 'S': return 'Ctrl-S (Split / Execute)';
    case 'T': return 'Ctrl-T (Change Task Type)';
    case 'Q': return 'Ctrl-Q (Change Equipment)';
    case 'A': return 'Ctrl-A (Select All / Action)';
    case 'K': return 'Ctrl-K (Special Function)';
    case 'B': return 'Ctrl-B (Back)';
    case 'R': return 'Ctrl-R (Refresh)';
    case 'N': return 'Ctrl-N (Next Screen / Record)';
    case 'F2': return 'F2 (Previous Screen)';
    default: return t ? `Ctrl-${t}` : 'CONTROL_KEY';
  }
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
 * Core Parser: Extracts screen transactions directly from raw physical log lines.
 * Line numbering (i + 1) matches Notepad++ 1:1 with zero drift.
 * Detects why each step is slow: User Hold, RF Terminal Host, API Call, Script Run, or Screen Parse.
 */
export function extractScreenTransactionsFromLines(
  lines: string[],
  fileName: string,
  fileId: string,
  forcedAppType?: 'SCM' | 'WMS' | 'UNKNOWN'
): ScreenTransaction[] {
  if (!lines || lines.length === 0) return [];

  // Detect App Type if not forced
  let appType = forcedAppType || 'UNKNOWN';
  if (appType === 'UNKNOWN') {
    const sample = lines.slice(0, 150).join('\n').toUpperCase();
    if (sample.includes('SCM') || sample.includes('PURECS') || sample.includes('OPENAPPLICATION') || sample.includes('FUSION')) {
      appType = 'SCM';
    } else if (sample.includes('WMS') || sample.includes('LOGFIRE') || sample.includes('WS-G-HK') || sample.includes('LOGFIREPAGE')) {
      appType = 'WMS';
    }
  }

  const transactions: ScreenTransaction[] = [];
  let currentTx: ScreenTransaction | null = null;
  let lastScreenReadyMs = 0; // Timestamp when screen / cursor finished rendering and became ready for user
  let lastAction: {
    type: string;
    actionLabel: string;
    target: string;
    source: string;
    value: string;
    isScan: boolean;
    seq: string;
    timeStr: string;
    timeMs: number;
    userHoldMs: number;
    lineNo: number;
  } | null = null;
  let pendingTarget = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1; // 100% exact Notepad++ physical line number

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
    } else {
      const sm = line.match(/username\s+([A-Za-z0-9_.\-@]+)\s*,?\s*session\s+id\s*:\s*(\d+)/i);
      if (sm) {
        user = sm[1];
        session = sm[2];
      }
    }

    // Track when screen finishes rendering and cursor is positioned (Ready for user input)
    if (line.includes('LogFirePage.doAction:finish Current cursor =') || line.includes('.runScript:_onPageEntered~') || line.includes('.onSessionApplicationEnterEvent')) {
      lastScreenReadyMs = timeMs;
    }

    // 1. Capture User UI Input (FlexiRuntime.handleUI)
    if (line.includes('FlexiRuntime.handleUI:inputData=')) {
      const targetM = line.match(/target='(.*?)'/);
      const sourceM = line.match(/source='(.*?)'/);
      const valM = line.match(/value='(.*?)'/);
      const isScanM = line.match(/isScan='(.*?)'/);
      const seqM = line.match(/seq='(.*?)'/);
      const isScan = isScanM ? isScanM[1] === 'true' : false;

      // User screen hold / idle time before submitting this input
      const userHoldMs = lastScreenReadyMs && timeMs > lastScreenReadyMs ? Math.max(0, timeMs - lastScreenReadyMs) : 0;

      lastAction = {
        type: isScan ? 'SCAN' : 'INPUT',
        actionLabel: isScan ? 'SCAN' : 'ENTER',
        target: targetM ? targetM[1] : '',
        source: sourceM ? sourceM[1] : '',
        value: valM ? valM[1] : '',
        isScan,
        seq: seqM ? seqM[1] : '',
        timeStr,
        timeMs,
        userHoldMs,
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
        const rawAction = actM[1];
        const val = actM[2];
        const src = actM[3];
        const tgt = actM[4];

        let formatted = rawAction;
        if (rawAction === 'CONTROL_KEY') {
          formatted = formatControlKey(tgt, val);
        } else if (rawAction === 'F2' || tgt === 'F2' || val === 'F2') {
          formatted = 'F2 (Previous Screen)';
        } else if (rawAction === 'ENTER') {
          formatted = 'ENTER';
        } else if (rawAction === 'UP') {
          formatted = 'UP (Menu Up)';
        } else if (rawAction === 'DOWN') {
          formatted = 'DOWN (Menu Down)';
        } else if (rawAction === 'TAB') {
          formatted = 'TAB (Next Field)';
        } else if (rawAction === 'MOUSE_CLICK') {
          formatted = 'CLICK';
        } else if (rawAction === 'MOUSE_ENTER') {
          formatted = 'SELECT_MENU';
        }

        const userHoldMs = lastScreenReadyMs && timeMs > lastScreenReadyMs ? Math.max(0, timeMs - lastScreenReadyMs) : 0;

        if (!lastAction) {
          lastAction = {
            type: rawAction,
            actionLabel: formatted,
            target: tgt || src,
            source: src,
            value: val,
            isScan: false,
            seq: '',
            timeStr,
            timeMs,
            userHoldMs,
            lineNo,
          };
        } else {
          lastAction.type = rawAction;
          lastAction.actionLabel = formatted;
          if (tgt) lastAction.target = tgt;
          if (src && !lastAction.source) lastAction.source = src;
          if (val) lastAction.value = val;
          if (userHoldMs > lastAction.userHoldMs) lastAction.userHoldMs = userHoldMs;
          lastAction.lineNo = lineNo;
        }

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
            currentTx.endLine = lineNo; // Notepad++ line number of exit
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
              startLine: lineNo, // Notepad++ line number of entry
              endLine: lineNo,
              status: 'IN_PROGRESS',
              eventsCount: 0,
              apiCallsCount: 0,
              apiTotalDurationMs: 0,
              maxEventDurationMs: 0,
              slowestEventName: '',
              events: [],
            };
            lastScreenReadyMs = timeMs;
          } else if (currentTx.screenName !== currName) {
            // Internal step / sub-screen transition (clearly indicate sub-screen, NOT generic Navigate)
            currentTx.events.push({
              id: `ev-${currentTx.events.length + 1}`,
              timestamp: timeStr,
              timestampMs: timeMs,
              durationMs: 0,
              durationFormatted: '0 ms',
              isReportedDuration: false,
              event: `Sub-Screen: ${currName}`,
              field: currName,
              value: '',
              lineNo, // Exact Notepad++ line number
              status: 'PASS',
              details: `Screen stepped into sub-screen "${currName}" (from "${prevTitle}")`,
              delayCategory: 'SCREEN_PARSING',
              whySlow: `Sub-screen transition into "${currName}" (parsing terminal layout).`,
            });
            lastScreenReadyMs = timeMs;
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
          lastScreenReadyMs = timeMs;
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
        lastScreenReadyMs = timeMs;
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

      // WMS LogFire SSH SendKey Time (Response latency from backend)
      if (line.includes('LogFireSSHConnection.SendKey:LogFireTime=')) {
        const msM = line.match(/LogFireTime=(\d+)\s*ms/);
        const serverMs = msM ? parseInt(msM[1], 10) : 0;
        const fieldName = lastAction ? (lastAction.target || lastAction.source) : 'terminal';
        const evLabel = lastAction?.actionLabel || (lastAction?.isScan ? 'SCAN' : 'ENTER');
        const evVal = lastAction ? lastAction.value : '';
        const userHoldMs = lastAction?.userHoldMs || 0;

        let delayCategory: DelayCategory = 'NORMAL';
        let whySlow = '';

        if (serverMs >= 1500) {
          delayCategory = 'RF_TERMINAL_LATENCY';
          whySlow = `Oracle WMS backend host took ${formatDuration(serverMs)} to process action '${evLabel}' and return terminal screen via SSH.`;
        } else if (userHoldMs >= 1500) {
          delayCategory = 'USER_HOLD';
          whySlow = `User held/paused on screen for ${formatDuration(userHoldMs)} before submitting input on '${fieldName}'. Server responded in ${serverMs} ms.`;
        } else if (serverMs >= 800) {
          delayCategory = 'RF_TERMINAL_LATENCY';
          whySlow = `SSH terminal host response took ${serverMs} ms.`;
        } else {
          delayCategory = 'NORMAL';
          whySlow = `Fast response: Server returned in ${serverMs} ms.`;
        }

        currentTx.events.push({
          id: `ev-${currentTx.events.length + 1}`,
          timestamp: timeStr,
          timestampMs: timeMs,
          durationMs: serverMs,
          durationFormatted: formatDuration(serverMs),
          isReportedDuration: true,
          event: evLabel,
          field: fieldName,
          value: evVal,
          stepSeq: lastAction?.seq || '',
          lineNo, // Exact Notepad++ line where SSH SendKey returned
          status: serverMs > 2500 ? 'WARN' : 'PASS',
          details: `SSH Terminal Response (${serverMs} ms) on ${fieldName}`,
          delayCategory,
          whySlow,
          userHoldTimeMs: userHoldMs,
          serverLatencyMs: serverMs,
        });

        lastScreenReadyMs = timeMs;
        lastAction = null; // Reset so next action doesn't duplicate
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
            event: `SCRIPT: ${evName}`,
            field: fieldName,
            value: '',
            lineNo, // Exact Notepad++ line number
            status: 'PASS',
            details: `Triggered ${evName} event script on ${fieldName}`,
            delayCategory: 'SCRIPT_LATENCY',
            whySlow: `Triggered ${evName} event script on field '${fieldName}'.`,
          });
        }
      }

      // Script Initialization Duration
      if (line.includes('.script initialize = ')) {
        const sim = line.match(/([A-Za-z0-9_]+)\.script initialize\s*=\s*(\d+)\s*ms/);
        if (sim) {
          const field = sim[1];
          const durationMs = parseInt(sim[2], 10);
          const whySlow = durationMs >= 1000 
            ? `BeanShell script initialize took ${formatDuration(durationMs)} on field '${field}' (High script latency).`
            : `Script initialize took ${durationMs} ms on field '${field}'.`;

          if (currentTx.events.length > 0 && currentTx.events[currentTx.events.length - 1].field === field && currentTx.events[currentTx.events.length - 1].event.startsWith('SCRIPT:')) {
            const ev = currentTx.events[currentTx.events.length - 1];
            ev.durationMs = durationMs;
            ev.durationFormatted = `${durationMs} ms`;
            ev.isReportedDuration = true;
            ev.status = durationMs > 1000 ? 'WARN' : 'PASS';
            ev.details += ` (init ${durationMs} ms)`;
            ev.delayCategory = durationMs >= 1000 ? 'SCRIPT_LATENCY' : 'NORMAL';
            ev.whySlow = whySlow;
            ev.scriptLatencyMs = durationMs;
          } else {
            currentTx.events.push({
              id: `ev-${currentTx.events.length + 1}`,
              timestamp: timeStr,
              timestampMs: timeMs,
              durationMs,
              durationFormatted: `${durationMs} ms`,
              isReportedDuration: true,
              event: `SCRIPT: init`,
              field,
              value: '',
              lineNo, // Exact Notepad++ line number
              status: durationMs > 1000 ? 'WARN' : 'PASS',
              details: `Script initialize took ${durationMs} ms on ${field}`,
              delayCategory: durationMs >= 1000 ? 'SCRIPT_LATENCY' : 'NORMAL',
              whySlow,
              scriptLatencyMs: durationMs,
            });
          }
          lastScreenReadyMs = timeMs;
        }
      }

      // Web service / API Calls
      if (line.includes('.runWebService: Total time = ')) {
        const am = line.match(/([A-Za-z0-9_]+)\.runWebService:\s*Total time\s*=\s*(\d+)\s*ms/);
        if (am) {
          const apiName = am[1];
          const durationMs = parseInt(am[2], 10);
          const whySlow = durationMs >= 1500
            ? `Remote Web Service API '${apiName}' took ${formatDuration(durationMs)} to respond (Server/Network delay).`
            : `Web Service API '${apiName}' completed in ${durationMs} ms.`;

          currentTx.events.push({
            id: `ev-${currentTx.events.length + 1}`,
            timestamp: timeStr,
            timestampMs: timeMs,
            durationMs,
            durationFormatted: `${durationMs} ms`,
            isReportedDuration: true,
            event: `API: ${apiName}`,
            field: apiName,
            value: '',
            lineNo, // Exact Notepad++ line number of API response
            status: durationMs > 2000 ? 'WARN' : 'PASS',
            details: `Web Service API: ${apiName} responded in ${durationMs} ms`,
            delayCategory: durationMs >= 1000 ? 'API_LATENCY' : 'NORMAL',
            whySlow,
            apiLatencyMs: durationMs,
          });
          currentTx.apiCallsCount++;
          currentTx.apiTotalDurationMs += durationMs;
          lastScreenReadyMs = timeMs;
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
          lineNo, // Exact Notepad++ line number
          status: 'PASS',
          details: line.substring(Math.max(0, line.indexOf('UserActionLogger - ') + 19)).substring(0, 80),
          delayCategory: 'NORMAL',
          whySlow: 'Executed database query.',
        });
      }
    }
  }

  // Final unclosed transaction if log ends while inside screen
  if (currentTx) {
    if (!currentTx.endTime && currentTx.events.length > 0) {
      const lastEv = currentTx.events[currentTx.events.length - 1];
      currentTx.endTime = lastEv.timestamp;
      currentTx.endTimeMs = lastEv.timestampMs;
      currentTx.endLine = lastEv.lineNo;
      currentTx.totalDurationMs = Math.max(0, currentTx.endTimeMs - currentTx.startTimeMs);
      currentTx.totalDurationFormatted = formatDuration(currentTx.totalDurationMs);
    }
    transactions.push(currentTx);
  }

  // Calculate interval deltas for events without explicit reported ms & determine primary bottleneck
  for (const tx of transactions) {
    for (let k = 0; k < tx.events.length; k++) {
      const ev = tx.events[k];
      if (!ev.isReportedDuration && k < tx.events.length - 1) {
        const nextEv = tx.events[k + 1];
        const delta = nextEv.timestampMs - ev.timestampMs;
        if (delta > 0 && delta < 300000) { // < 5 mins
          ev.durationMs = delta;
          ev.durationFormatted = formatDuration(delta);
          if (delta >= 1500) {
            if (ev.userHoldTimeMs && ev.userHoldTimeMs >= 1500) {
              ev.delayCategory = 'USER_HOLD';
              ev.whySlow = `User held/paused screen for ${formatDuration(ev.userHoldTimeMs)} before next action.`;
            } else if (!ev.delayCategory || ev.delayCategory === 'NORMAL') {
              ev.delayCategory = 'SCREEN_PARSING';
              ev.whySlow = `Screen step transition took ${formatDuration(delta)} to process.`;
            }
          } else if (!ev.whySlow) {
            ev.delayCategory = 'NORMAL';
            ev.whySlow = `Completed in ${ev.durationFormatted}.`;
          }
        }
      }
    }

    // Rollups
    tx.eventsCount = tx.events.length;
    tx.apiCallsCount = tx.events.filter(e => e.event.startsWith('API:') || e.event === 'API_CALL').length;
    tx.apiTotalDurationMs = tx.events.filter(e => e.event.startsWith('API:') || e.event === 'API_CALL').reduce((sum, e) => sum + e.durationMs, 0);

    let maxEv = 0;
    let slowestName = '';
    let totalUserHold = 0;
    let totalServer = 0;
    let totalApi = 0;
    let totalScript = 0;

    for (const ev of tx.events) {
      if (ev.durationMs > maxEv) {
        maxEv = ev.durationMs;
        slowestName = `${ev.event} on ${ev.field} (${ev.durationFormatted})`;
      }
      if (ev.userHoldTimeMs) totalUserHold += ev.userHoldTimeMs;
      if (ev.serverLatencyMs) totalServer += ev.serverLatencyMs;
      if (ev.apiLatencyMs) totalApi += ev.apiLatencyMs;
      if (ev.scriptLatencyMs) totalScript += ev.scriptLatencyMs;

      if (ev.status === 'FAIL') {
        tx.status = 'HAS_ERROR';
      }
    }
    tx.maxEventDurationMs = maxEv;
    tx.slowestEventName = slowestName || 'N/A';

    // Primary Bottleneck Diagnostic
    const maxContribution = Math.max(totalUserHold, totalServer, totalApi, totalScript);
    const txTotal = Math.max(1, tx.totalDurationMs);
    if (maxContribution >= 1500) {
      if (maxContribution === totalUserHold) {
        tx.primaryDelayCategory = 'USER_HOLD';
        tx.primaryDelayReason = `User screen pause/hold took ${formatDuration(totalUserHold)} (${Math.round((totalUserHold / txTotal) * 100)}% of total time)`;
      } else if (maxContribution === totalServer) {
        tx.primaryDelayCategory = 'RF_TERMINAL_LATENCY';
        tx.primaryDelayReason = `Oracle WMS host SSH latency took ${formatDuration(totalServer)} (${Math.round((totalServer / txTotal) * 100)}% of total time)`;
      } else if (maxContribution === totalApi) {
        tx.primaryDelayCategory = 'API_LATENCY';
        tx.primaryDelayReason = `Remote Web Service APIs took ${formatDuration(totalApi)} (${Math.round((totalApi / txTotal) * 100)}% of total time)`;
      } else {
        tx.primaryDelayCategory = 'SCRIPT_LATENCY';
        tx.primaryDelayReason = `Flexi script execution took ${formatDuration(totalScript)} (${Math.round((totalScript / txTotal) * 100)}% of total time)`;
      }
    } else {
      tx.primaryDelayCategory = 'NORMAL';
      tx.primaryDelayReason = `Fast execution (${tx.totalDurationFormatted})`;
    }
  }

  return transactions;
}

/**
 * Extracts screen transactions from ParsedLogFiles or LogEntries.
 * If pre-computed screenTransactions exist on files, uses them directly.
 */
export function extractScreenTransactions(sources: (ParsedLogFile | LogEntry)[]): ScreenTransaction[] {
  if (!sources || sources.length === 0) return [];

  // 1. If sources are ParsedLogFiles with pre-computed screenTransactions, return directly!
  if ('entries' in sources[0] && Array.isArray((sources[0] as ParsedLogFile).entries)) {
    const precomputed: ScreenTransaction[] = [];
    for (const f of sources as ParsedLogFile[]) {
      if (f.screenTransactions && f.screenTransactions.length > 0) {
        precomputed.push(...f.screenTransactions);
      }
    }
    if (precomputed.length > 0) {
      return precomputed;
    }
  }

  // 2. Fallback: Reconstruct contiguous raw lines
  const lines: string[] = [];
  let fileName = 'log-file.log';
  let fileId = 'file-1';
  let appType: 'SCM' | 'WMS' | 'UNKNOWN' = 'UNKNOWN';

  if ('entries' in sources[0] && Array.isArray((sources[0] as ParsedLogFile).entries)) {
    const files = sources as ParsedLogFile[];
    const allTxs: ScreenTransaction[] = [];
    for (const f of files) {
      const fLines: string[] = [];
      for (const e of f.entries) {
        fLines.push(...e.rawLines);
      }
      const txs = extractScreenTransactionsFromLines(fLines, f.fileName, f.id, f.appType);
      allTxs.push(...txs);
    }
    return allTxs;
  } else {
    const entries = sources as LogEntry[];
    if (entries.length > 0) {
      fileName = entries[0].fileName;
      fileId = entries[0].fileId;
      appType = entries[0].appType;
      for (const e of entries) {
        lines.push(...e.rawLines);
      }
    }
    return extractScreenTransactionsFromLines(lines, fileName, fileId, appType);
  }
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

/**
 * Generate CSV string for Performance Summary (Screen level)
 */
export function exportPerformanceSummaryCsv(transactions: ScreenTransaction[]): string {
  const headers = [
    'Screen Name',
    'Screen Code',
    'System Type',
    'User',
    'Session ID',
    'Start Line (Notepad++)',
    'End Line (Notepad++)',
    'Start Time',
    'End Time',
    'Total Duration (ms)',
    'Total Duration (Formatted)',
    'Primary Delay Bottleneck',
    'Why Screen Took Time',
    'Events Count',
    'API Calls Count',
    'API Total Duration (ms)',
    'Max Event Duration (ms)',
    'Slowest Event',
    'Status'
  ];

  const rows = transactions.map(tx => [
    `"${tx.screenName.replace(/"/g, '""')}"`,
    `"${tx.screenCode.replace(/"/g, '""')}"`,
    `"${tx.appType}"`,
    `"${tx.userName}"`,
    `"${tx.sessionId}"`,
    tx.startLine,
    tx.endLine,
    `"${tx.startTime}"`,
    `"${tx.endTime}"`,
    tx.totalDurationMs,
    `"${tx.totalDurationFormatted}"`,
    `"${tx.primaryDelayCategory || 'NORMAL'}"`,
    `"${(tx.primaryDelayReason || '').replace(/"/g, '""')}"`,
    tx.eventsCount,
    tx.apiCallsCount,
    tx.apiTotalDurationMs,
    tx.maxEventDurationMs,
    `"${tx.slowestEventName.replace(/"/g, '""')}"`,
    `"${tx.status}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate CSV string for Performance Details across all transactions (Event level)
 */
export function exportPerformanceDetailsCsv(transactions: ScreenTransaction[]): string {
  const headers = [
    'Transaction Screen',
    'Screen Code',
    'System Type',
    'User',
    'Session ID',
    'Step #',
    'Line # (Notepad++)',
    'Timestamp',
    'Action / Event Triggered',
    'Field / Target',
    'Scanned / Input Value',
    'Duration (ms)',
    'Duration (Formatted)',
    'Delay Category',
    'Why It Took Time (Root Cause Diagnostics)',
    'User Hold / Pause Time (ms)',
    'Server / SSH Latency (ms)',
    'API Latency (ms)',
    'Script Latency (ms)',
    'Reported By Log',
    'Status',
    'Details'
  ];

  const rows: (string | number)[][] = [];

  for (const tx of transactions) {
    for (let idx = 0; idx < tx.events.length; idx++) {
      const ev = tx.events[idx];
      rows.push([
        `"${tx.screenName.replace(/"/g, '""')}"`,
        `"${tx.screenCode.replace(/"/g, '""')}"`,
        `"${tx.appType}"`,
        `"${tx.userName}"`,
        `"${tx.sessionId}"`,
        idx + 1,
        ev.lineNo,
        `"${ev.timestamp}"`,
        `"${ev.event.replace(/"/g, '""')}"`,
        `"${(ev.field || '').replace(/"/g, '""')}"`,
        `"${(ev.value || '').replace(/"/g, '""')}"`,
        ev.durationMs,
        `"${ev.durationFormatted}"`,
        `"${ev.delayCategory || 'NORMAL'}"`,
        `"${(ev.whySlow || '').replace(/"/g, '""')}"`,
        ev.userHoldTimeMs || 0,
        ev.serverLatencyMs || 0,
        ev.apiLatencyMs || 0,
        ev.scriptLatencyMs || 0,
        ev.isReportedDuration ? 'YES' : 'NO',
        `"${ev.status}"`,
        `"${(ev.details || '').replace(/"/g, '""')}"`
      ]);
    }
  }

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate CSV string for a single screen's detailed events
 */
export function exportScreenEventsCsv(tx: ScreenTransaction): string {
  const headers = [
    'Step #',
    'Line # (Notepad++)',
    'Timestamp',
    'Action / Event Triggered',
    'Field / Target',
    'Scanned / Input Value',
    'Duration (ms)',
    'Duration (Formatted)',
    'Delay Category',
    'Why It Took Time (Root Cause Diagnostics)',
    'User Hold / Pause Time (ms)',
    'Server / SSH Latency (ms)',
    'Reported By Log',
    'Status',
    'Details'
  ];

  const rows = tx.events.map((ev, idx) => [
    idx + 1,
    ev.lineNo,
    `"${ev.timestamp}"`,
    `"${ev.event.replace(/"/g, '""')}"`,
    `"${(ev.field || '').replace(/"/g, '""')}"`,
    `"${(ev.value || '').replace(/"/g, '""')}"`,
    ev.durationMs,
    `"${ev.durationFormatted}"`,
    `"${ev.delayCategory || 'NORMAL'}"`,
    `"${(ev.whySlow || '').replace(/"/g, '""')}"`,
    ev.userHoldTimeMs || 0,
    ev.serverLatencyMs || 0,
    ev.isReportedDuration ? 'YES' : 'NO',
    `"${ev.status}"`,
    `"${(ev.details || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
