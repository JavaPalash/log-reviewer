import { LogEntry, LogLevel, ParsedLogFile, IssueCategory, ApiDetails, ErrorDetails, MissingValueInfo } from './types';
import { PARSING_RULES } from './parsingRules';

interface RawLogLineInfo {
  lineNum: number;
  rawText: string;
  isHeader: boolean;
  level?: LogLevel;
  timestamp?: string;
  timestampMs?: number;
  threadBlock?: string;
  logger?: string;
  message?: string;
}

/**
 * Parses timestamp string "YYYY-MM-DD HH:mm:ss.SSS" to epoch ms
 */
function parseTimestampToMs(ts: string): number {
  try {
    const isoLike = ts.replace(' ', 'T') + 'Z';
    const ms = Date.parse(isoLike);
    return isNaN(ms) ? 0 : ms;
  } catch {
    return 0;
  }
}

/**
 * Fast linear line header detector without catastrophic regex backtracking
 */
function tryParseHeader(rawText: string, lineNum: number): RawLogLineInfo {
  if (rawText.charCodeAt(0) === 91) { // starts with '['
    const m = rawText.match(/^\[([A-Z ]{4,5})\]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(.*)/);
    if (m) {
      const level = m[1].trim() as LogLevel;
      const ts = m[2];
      const rest = m[3];
      const dashIdx = rest.indexOf(' - ');
      if (dashIdx !== -1) {
        const beforeDash = rest.substring(0, dashIdx).trim();
        const msg = rest.substring(dashIdx + 3);
        const lastSpace = beforeDash.lastIndexOf(' ');
        const logger = lastSpace !== -1 ? beforeDash.substring(lastSpace + 1).trim() : beforeDash;
        const threadBlock = lastSpace !== -1 ? beforeDash.substring(0, lastSpace).trim() : '';

        return {
          lineNum,
          rawText,
          isHeader: true,
          level,
          timestamp: ts,
          timestampMs: parseTimestampToMs(ts),
          threadBlock,
          logger,
          message: msg,
        };
      }
    }
  }

  // Fallback: alt header e.g. YYYY-MM-DD HH:mm:ss.SSS [LEVEL] ...
  if (rawText.length > 25 && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(rawText)) {
    const altM = rawText.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s*\[([A-Z]+)\]\s+(.*)/);
    if (altM) {
      const ts = altM[1];
      const level = altM[2].trim() as LogLevel;
      const rest = altM[3];
      const dashIdx = rest.indexOf(' - ');
      const beforeDash = dashIdx !== -1 ? rest.substring(0, dashIdx).trim() : rest;
      const msg = dashIdx !== -1 ? rest.substring(dashIdx + 3) : '';
      const lastSpace = beforeDash.lastIndexOf(' ');
      const logger = lastSpace !== -1 ? beforeDash.substring(lastSpace + 1).trim() : beforeDash;
      const threadBlock = lastSpace !== -1 ? beforeDash.substring(0, lastSpace).trim() : '';

      return {
        lineNum,
        rawText,
        isHeader: true,
        level,
        timestamp: ts,
        timestampMs: parseTimestampToMs(ts),
        threadBlock,
        logger,
        message: msg,
      };
    }
  }

  return {
    lineNum,
    rawText,
    isHeader: false,
  };
}

/**
 * Helper to extract user and session from thread block or message
 */
function extractUserAndSession(threadBlock: string, message: string): { user: string; session: string; threadId: string; stepSeq: string } {
  let user = '';
  let session = '';
  let threadId = '';
  let stepSeq = '';

  if (threadBlock) {
    const m = threadBlock.match(PARSING_RULES.patterns.threadUserSession);
    if (m) {
      user = m[1] || '';
      session = m[2] || '';
      threadId = m[4] ? `Thread-${m[4]}` : '';
      stepSeq = m[5] || '';
    } else {
      threadId = threadBlock;
    }
  }

  if ((!user || !session) && message) {
    const sm = message.match(PARSING_RULES.patterns.sessionMonitorUserSession);
    if (sm) {
      user = sm[1].trim();
      session = sm[2].trim();
    }
  }

  return { user, session, threadId, stepSeq };
}

/**
 * Main parser
 */
export function parseLogContent(content: string, fileName: string, fileId: string = 'file-1'): ParsedLogFile {
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;

  const entries: LogEntry[] = [];
  let currentGroup: RawLogLineInfo[] = [];

  function flushGroup(group: RawLogLineInfo[]) {
    if (!group || group.length === 0) return;
    const entry = processGroupToEntry(group, fileName, fileId, entries.length);
    if (entry) {
      entries.push(entry);
    }
  }

  for (let i = 0; i < totalLines; i++) {
    const rawText = lines[i];
    const lineInfo = tryParseHeader(rawText, i + 1);

    if (lineInfo.isHeader) {
      if (currentGroup.length > 0) {
        flushGroup(currentGroup);
      }
      currentGroup = [lineInfo];
    } else {
      if (currentGroup.length > 0) {
        currentGroup.push(lineInfo);
      } else {
        currentGroup = [lineInfo];
      }
    }
  }
  flushGroup(currentGroup);

  let errorCount = 0;
  let warnCount = 0;
  for (const e of entries) {
    if (e.status === 'FAIL') errorCount++;
    else if (e.status === 'WARN') warnCount++;
  }

  return {
    id: fileId,
    fileName,
    fileSize: content.length,
    totalLines,
    totalEntries: entries.length,
    errorCount,
    warnCount,
    entries,
  };
}

/**
 * Processes a grouped block of raw lines into a structured LogEntry in a single fast pass
 */
function processGroupToEntry(group: RawLogLineInfo[], fileName: string, fileId: string, index: number): LogEntry | null {
  if (group.length === 0) return null;

  const headerLine = group.find(l => l.isHeader) || group[0];
  const startLine = group[0].lineNum;
  const endLine = group[group.length - 1].lineNum;
  const timestamp = headerLine.timestamp || '';
  const timestampMs = headerLine.timestampMs || 0;
  let level: LogLevel = headerLine.level || 'INFO';
  const logger = headerLine.logger || '';

  const { user, session, threadId, stepSeq } = extractUserAndSession(headerLine.threadBlock || '', headerLine.message || '');

  let screen = '';
  let field = '';
  let event = '';
  let scannedValue = '';
  let isScan = false;
  let targetField = '';
  let sourceField = '';

  let apiDetails: ApiDetails | undefined = undefined;
  let apiName = '';
  let method = '';
  let url = '';
  let requestPayload = '';
  let responseCode: number | undefined = undefined;
  let responseBody = '';
  let durationMs: number | undefined = undefined;
  let authHeader = '';

  let errorDetails: ErrorDetails | undefined = undefined;
  const stackTraceLines: string[] = [];
  let exceptionType = '';
  let exceptionMessage = '';
  let logCode = '';

  const rawLines: string[] = [];
  let sampleSnippet = '';

  // Single fast pass over all lines in group
  for (let i = 0; i < group.length; i++) {
    const txt = group[i].rawText;
    rawLines.push(txt);
    if (sampleSnippet.length < 2000) sampleSnippet += ' ' + txt;

    // Screen Detection
    if (!screen) {
      if (txt.includes('LogFirePage')) screen = 'LogFirePage';
      else if (txt.includes('_onPageEntered~') || txt.includes('_afterPageEntered~')) {
        const sm = txt.match(/(?:_onPageEntered~|_afterPageEntered~)([A-Za-z0-9_]+)/);
        if (sm) screen = sm[1];
      } else if (txt.includes('ActionType : OPEN_PAGE')) {
        const sm = txt.match(/OPEN_PAGE,\s*action\s*value\s*:\s*(?:[\w.]+\.)?([A-Za-z0-9_]+)/);
        if (sm) screen = sm[1];
      } else if (txt.includes('openApplication(')) {
        const sm = txt.match(/openApplication\(["']([A-Za-z0-9_]+)["']\)/);
        if (sm) screen = sm[1];
      }
    }

    // Field & Event Detection
    if (!field && txt.includes('runScript:_')) {
      const se = txt.match(/runScript:_?([A-Za-z0-9]+)~([A-Za-z0-9_]+)/);
      if (se) { event = se[1]; field = se[2]; }
    }

    if (txt.includes('handleUI:inputData=')) {
      const idm = txt.match(/inputData=InputData\{inputType=(\d+),\s*value='(.*?)',\s*isScan='(true|false)',\s*target='(.*?)',\s*source='(.*?)'/);
      if (idm) {
        scannedValue = idm[2];
        isScan = idm[3].toLowerCase() === 'true';
        targetField = idm[4];
        sourceField = idm[5];
        if (!field) field = targetField || sourceField;
        if (!event) event = isScan ? 'onBarcodeScan' : 'inputData';
      }
    } else if (txt.includes('handleUI: ')) {
      const huia = txt.match(/handleUI:\s*([A-Z_]+)\s+with\s+value\s+'(.*?)'\s+from\s+source\s+'(.*?)'\s+to\s+target\s+'(.*?)'/);
      if (huia) {
        if (!event) event = huia[1];
        if (!scannedValue) scannedValue = huia[2];
        sourceField = huia[3];
        targetField = huia[4];
        if (!field) field = targetField || sourceField;
      }
    }

    // API Detection
    if (txt.includes('.runWebService')) {
      const am = txt.match(/(\S+_WS|\S+WebService)\.runWebService/);
      if (am) apiName = am[1];
      if (txt.includes('result ')) {
        const rres = txt.match(/result\s*(\d{3})(?:\s+([\s\S]*))?/);
        if (rres) {
          responseCode = parseInt(rres[1], 10);
          responseBody = (rres[2] || '').trim();
        }
      }
      if (txt.includes('Total time =')) {
        const rdur = txt.match(/Total\s*time\s*=\s*(\d+)\s*ms/);
        if (rdur) durationMs = parseInt(rdur[1], 10);
      }
    }

    if (txt.includes('RestWebService.request: Request Method =')) {
      const rm = txt.match(/Request\s*Method\s*=\s*([A-Z]+)/);
      if (rm) method = rm[1];
    }
    if (txt.includes('RestWebService.request: URL =') || txt.includes('RestWebService.postAction:') || txt.includes('RestWebService.patchAction:')) {
      const ru = txt.match(/(?:URL\s*=|postAction:|patchAction:|getAction:)\s*(https?:\/\/\S+)/);
      if (ru) url = ru[1];
    }
    if (txt.includes('RestWebService.authorizationRequest:')) {
      const ra = txt.match(/authorizationRequest:\s*(\S+\s+\S+|\S+)/);
      if (ra) authHeader = ra[1];
    }
    if (txt.includes('Request Body =') || txt.includes('requestBody:')) {
      const idx = txt.indexOf('Request Body =');
      if (idx !== -1) requestPayload = txt.substring(idx + 14).trim();
      else {
        const idx2 = txt.indexOf('requestBody:');
        if (idx2 !== -1) requestPayload = txt.substring(idx2 + 12).trim();
      }
    }
    if (!requestPayload && txt.includes('Final Payload:')) {
      requestPayload = txt.substring(txt.indexOf('Final Payload:') + 14).trim();
    }

    // Stack Trace & Errors
    if (txt.startsWith('\tat ') || txt.startsWith('    at ')) {
      stackTraceLines.push(txt.trim());
      if (!logCode) {
        const sm = txt.match(/at\s+([a-zA-Z0-9_$.]+)\(([^)]+)\)/);
        if (sm) logCode = `${sm[1]}:${sm[2]}`;
      }
    } else if (txt.includes('Exception:') || txt.includes('Error:')) {
      const em = txt.match(/([a-zA-Z0-9_.]*(?:Exception|Error)):?(?:\s+(.*))?/);
      if (em) {
        exceptionType = em[1];
        exceptionMessage = em[2] || '';
      }
    }
  }

  if (!method && apiName) {
    if (apiName.startsWith('GET_')) method = 'GET';
    else if (apiName.startsWith('POST_') || apiName.includes('_POST_')) method = 'POST';
    else if (apiName.startsWith('PATCH_') || apiName.includes('_PATCH_')) method = 'PATCH';
    else if (apiName.startsWith('PUT_')) method = 'PUT';
    else if (apiName.startsWith('DELETE_')) method = 'DELETE';
  }

  if (apiName || method || url || responseCode !== undefined) {
    apiDetails = {
      name: apiName,
      method: method || (url ? 'GET' : undefined),
      url,
      requestPayload,
      responseCode,
      responseBody,
      durationMs,
      authHeader,
    };
  }

  if (exceptionType || stackTraceLines.length > 0 || level === 'ERROR') {
    if (!exceptionType) {
      exceptionType = level === 'ERROR' ? 'FlexiError' : 'Exception';
      exceptionMessage = headerLine.message || 'Error occurred';
    }
    errorDetails = {
      type: exceptionType,
      message: exceptionMessage,
      stackTrace: stackTraceLines,
    };
  }

  if (!logCode) {
    if (logger) logCode = logger;
    if (headerLine.message) {
      const fnMatch = headerLine.message.match(/^([A-Za-z0-9_.]+)\.([A-Za-z0-9_]+)/);
      if (fnMatch) logCode = `${fnMatch[1]}.${fnMatch[2]}`;
    }
  }

  // Missing values in payload
  let missingValueDetails: MissingValueInfo | undefined = undefined;
  if (requestPayload && requestPayload.startsWith('{')) {
    try {
      const parsed = JSON.parse(requestPayload);
      const emptyKeys: string[] = [];
      for (const [k, v] of Object.entries(parsed)) {
        if (v === '' || v === null || v === undefined) emptyKeys.push(k);
      }
      if (emptyKeys.length > 0) {
        missingValueDetails = {
          field: emptyKeys.join(', '),
          sourceObject: 'Request Payload',
          reason: `Payload has empty fields: [${emptyKeys.join(', ')}].`,
        };
      }
    } catch (_) {}
  }

  // Categorization & Root Cause
  let isIssue = false;
  let issueCategory: IssueCategory = 'NONE';
  let status: 'FAIL' | 'WARN' | 'PASS' | 'INFO' = 'INFO';
  let rootCauseHint = '';
  let suggestedFix = '';

  if (apiDetails?.responseCode && apiDetails.responseCode >= 400) {
    isIssue = true;
    issueCategory = 'API_FAILURE';
    status = 'FAIL';
    level = 'ERROR';

    let errSnippet = '';
    if (apiDetails.responseBody) {
      try {
        const bodyObj = JSON.parse(apiDetails.responseBody);
        errSnippet = bodyObj.message || bodyObj.code || bodyObj.error || apiDetails.responseBody.substring(0, 80);
      } catch (_) {
        errSnippet = apiDetails.responseBody.substring(0, 80);
      }
    }

    if (apiDetails.responseCode === 404) {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || 'endpoint'} returned 404 (Not Found). ${errSnippet ? `Server message: "${errSnippet}". ` : ''}Scanned record does not exist in Oracle WMS.`;
      suggestedFix = `Verify if the scanned container, pallet, or shipment number exists in Oracle WMS.`;
    } else if (apiDetails.responseCode >= 500) {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || ''} failed with 500 server error. ${errSnippet ? `Backend message: "${errSnippet}".` : ''}`;
      suggestedFix = `Check backend Oracle WMS integration endpoint logs.`;
    } else {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || ''} returned HTTP ${apiDetails.responseCode}. ${errSnippet ? `Response: "${errSnippet}".` : ''}`;
      suggestedFix = `Check request parameters and authorization credentials.`;
    }

    if (missingValueDetails) {
      rootCauseHint += ` Note: Payload also sent with empty fields: [${missingValueDetails.field}].`;
      suggestedFix += ` Ensure required fields are scanned before submit.`;
    }
  } else if (errorDetails || level === 'ERROR') {
    isIssue = true;
    issueCategory = 'EXCEPTION';
    status = 'FAIL';

    const excType = errorDetails?.type || 'Exception';
    const excMsg = errorDetails?.message || '';

    if (excType.includes('IOException') && sampleSnippet.includes('LogFireSSHConnection')) {
      rootCauseHint = `SSH Connection to Oracle WMS terminal timed out or was closed (IOException in JSCHManager:isConnected at LogFireSSHConnection:949).`;
      suggestedFix = `Check network stability between Flexi Application Server and Oracle WMS SSH backend. Ensure SSH idle timeout is configured properly.`;
    } else if (sampleSnippet.includes('ClosedChannelException') || sampleSnippet.includes('FlexiWebSocket.send')) {
      issueCategory = 'CONNECTION_DROP';
      rootCauseHint = `Client WebSocket closed unexpectedly while server tried to send data (ClosedChannelException in FlexiWebSocket.send).`;
      suggestedFix = `RF scanner or browser lost network connection or user closed the browser tab.`;
    } else {
      rootCauseHint = `Exception ${excType}: ${excMsg} at ${logCode || 'runtime'}.`;
      suggestedFix = `Inspect the stack trace in the detail panel.`;
    }
  } else if (sampleSnippet.includes('Setting destroy to true') || sampleSnippet.includes('Idle for 120 minutes')) {
    isIssue = true;
    issueCategory = 'SESSION_TIMEOUT';
    status = 'WARN';
    level = 'WARN';
    rootCauseHint = `Session ${session || 'stale'} for user "${user || 'unknown'}" was terminated by SessionMonitor due to 120 minutes of user inactivity.`;
    suggestedFix = `Advise operator to re-login. Adjust Non_Flexi_Connection_TimeOut if needed.`;
  } else if (missingValueDetails && apiDetails) {
    isIssue = true;
    issueCategory = 'MISSING_VALUE';
    status = 'WARN';
    rootCauseHint = `API request prepared with empty parameters: [${missingValueDetails.field}].`;
    suggestedFix = `Verify if the user skipped scanning.`;
  } else if (level === 'WARN') {
    isIssue = true;
    issueCategory = 'VALIDATION';
    status = 'WARN';
    rootCauseHint = headerLine.message || 'Warning detected in log';
    suggestedFix = `Review configuration properties or UI component references.`;
  } else {
    status = 'PASS';
  }

  return {
    id: `${fileId}-${startLine}-${index}`,
    fileId,
    fileName,
    startLine,
    endLine,
    timestamp,
    timestampMs,
    level,
    userName: user,
    sessionId: session,
    threadId,
    stepSeq,
    screen,
    field,
    event,
    scannedValue,
    isScan,
    targetField,
    sourceField,
    apiDetails,
    error: errorDetails,
    logCode,
    logger,
    rawLines,
    isIssue,
    issueCategory,
    missingValueDetails,
    rootCauseHint,
    suggestedFix,
    status,
  };
}

/**
 * Mask sensitive values
 */
export function maskSensitiveData(text: string): string {
  if (!text) return text;
  return text
    .replace(PARSING_RULES.sensitivePatterns.authHeader, '$1********')
    .replace(PARSING_RULES.sensitivePatterns.tokenKey, '$1********$3')
    .replace(PARSING_RULES.sensitivePatterns.passwordKey, '$1********');
}
