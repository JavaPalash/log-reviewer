import { LogEntry, LogLevel, ParsedLogFile, IssueCategory, ApiDetails, ErrorDetails, MissingValueInfo, FlexiMethodDetails, EntryType } from './types';
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
 * Helper to detect whether log is Oracle SCM Cloud or Oracle WMS Cloud
 */
export function detectAppType(sampleText: string, fileName: string): 'SCM' | 'WMS' | 'UNKNOWN' {
  const s = (sampleText.substring(0, 50000) + ' ' + fileName).toUpperCase();
  if (
    s.includes('SCM') ||
    s.includes('PURECS') ||
    s.includes('FUSION') ||
    s.includes('FSCMRESTAPI') ||
    s.includes('SEHA') ||
    s.includes('PICK_RELEASE') ||
    s.includes('PICK_WAVE') ||
    s.includes('MOVEMENT_REQUEST') ||
    s.includes('KEDASU')
  ) {
    return 'SCM';
  }
  if (
    s.includes('WMS') ||
    s.includes('LOGFIRE') ||
    s.includes('LGFAPI') ||
    s.includes('WS-G-HK') ||
    s.includes('TEXTPLTLPN') ||
    s.includes('ASN RECEIVING') ||
    s.includes('ORACLE WMS')
  ) {
    return 'WMS';
  }
  return 'UNKNOWN';
}

/**
 * Helper to extract user, session, and tenant from thread block, message, or file name
 */
function extractUserAndSession(threadBlock: string, message: string, fileName: string = ''): { user: string; session: string; threadId: string; stepSeq: string; tenant: string } {
  let user = '';
  let session = '';
  let threadId = '';
  let stepSeq = '';
  let tenant = '';

  if (threadBlock) {
    const tm = threadBlock.match(PARSING_RULES.patterns.threadTenant);
    if (tm && tm[1] && tm[1] !== '') {
      tenant = tm[1].trim();
    }

    const m = threadBlock.match(PARSING_RULES.patterns.threadUserSession);
    if (m) {
      user = m[1]?.trim() || '';
      session = m[2]?.trim() || '';
      threadId = m[4] ? `Thread-${m[4].trim()}` : '';
      stepSeq = m[5]?.trim() || '';
    } else {
      threadId = threadBlock.trim();
    }
  }

  if ((!user || !session) && message) {
    const sm = message.match(PARSING_RULES.patterns.sessionMonitorUserSession);
    if (sm) {
      user = sm[1]?.trim() || '';
      session = sm[2]?.trim() || '';
    }
  }

  // Fallback to filename: e.g. WS-G-HK_038381784196022690_181.log or SAI.KEDASU_PURECS.COM_038521788334364984_434.log
  if ((!user || !session) && fileName) {
    const fnMatch = fileName.match(PARSING_RULES.patterns.fileNameUserSession);
    if (fnMatch) {
      if (!user) user = fnMatch[1].trim();
      if (!session) session = fnMatch[2].trim();
    }
  }

  return { user, session, threadId, stepSeq, tenant };
}

/**
 * Main parser with smart API block grouping and SCM/WMS awareness
 */
export function parseLogContent(content: string, fileName: string, fileId: string = 'file-1'): ParsedLogFile {
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  const appType = detectAppType(content, fileName);

  const entries: LogEntry[] = [];
  let currentGroup: RawLogLineInfo[] = [];
  let inApiCall = false;
  let fileTenant = '';

  let activeScreen = '';
  let activeField = '';
  let activeEvent = '';

  function flushGroup(group: RawLogLineInfo[]) {
    if (!group || group.length === 0) return;
    const entry = processGroupToEntry(group, fileName, fileId, entries.length, appType, activeScreen, activeField, activeEvent);
    if (entry) {
      if (entry.screen) activeScreen = entry.screen;
      if (entry.field) activeField = entry.field;
      if (entry.event && entry.event !== entry.apiDetails?.name) activeEvent = entry.event;
      if (!fileTenant && entry.tenant) fileTenant = entry.tenant;
      entries.push(entry);
    }
  }

  for (let i = 0; i < totalLines; i++) {
    const rawText = lines[i];
    const lineInfo = tryParseHeader(rawText, i + 1);

    if (lineInfo.isHeader) {
      const msg = lineInfo.message || '';

      // Screen context tracking across lines
      if (msg.includes('LogFirePage')) activeScreen = 'LogFirePage';
      else if (msg.includes('_onPageEntered~') || msg.includes('_afterPageEntered~')) {
        const sm = msg.match(/(?:_onPageEntered~|_afterPageEntered~)([A-Za-z0-9_]+)/);
        if (sm) activeScreen = sm[1];
      } else if (msg.includes('ActionType : OPEN_PAGE')) {
        const sm = msg.match(/OPEN_PAGE,\s*action\s*value\s*:\s*(?:[\w.]+\.)?([A-Za-z0-9_]+)/);
        if (sm) activeScreen = sm[1];
      } else if (msg.includes('openApplication(')) {
        const sm = msg.match(/openApplication\(["']([A-Za-z0-9_]+)["']\)/);
        if (sm) activeScreen = sm[1];
      } else if (msg.includes('lookup_code:')) {
        const sm = msg.match(/lookup_code:\s*([A-Za-z0-9_]+)/);
        if (sm) activeScreen = sm[1];
      }

      // Field & Event context tracking across lines
      if (msg.includes('.runScript:') || msg.includes('runScript:_')) {
        const se = msg.match(/(?:([A-Za-z0-9_]+)\.)?runScript:_?([A-Za-z0-9]+)~([A-Za-z0-9_]+)/);
        if (se) {
          if (se[1] && !activeScreen) activeScreen = se[1];
          activeEvent = se[2];
          activeField = se[3] || se[1] || '';
        }
      } else if (msg.includes('handleUI:inputData=')) {
        const idm = msg.match(/target='(.*?)'/);
        if (idm && idm[1]) activeField = idm[1];
        activeEvent = 'onBarcodeScan';
      } else if (msg.includes('handleUI: ')) {
        const huia = msg.match(/handleUI:\s*([A-Z_]+)\s+with\s+value\s+'(.*?)'\s+from\s+source\s+'(.*?)'\s+to\s+target\s+'(.*?)'/);
        if (huia) {
          activeEvent = huia[1];
          activeField = huia[4] || huia[3] || activeField;
        }
      }

      const isCalling = msg.includes('<-------- Calling ');
      const isScmApiStart = !inApiCall && !msg.includes('FlexiWebService.') && /\b([A-Za-z0-9_]+)\.runWebService\s*$/.test(msg);
      const isRestStart = !inApiCall && (
        msg.includes('RestWebService.request: Request Method = ') ||
        msg.includes('RestWebService. Request Method = ') ||
        msg.includes('FlexiWebService.callWebService:name:') ||
        msg.includes('FlexiWebService.runWebService: ID=') ||
        msg.includes('FlexiWebService.runWebService: Cache disabled') ||
        msg.includes('RestWebService.request:ID=') ||
        msg.includes('RestWebService.getAction') ||
        msg.includes('RestWebService.postAction') ||
        msg.includes('RestWebService.patchAction') ||
        msg.includes('RestWebService.putAction') ||
        msg.includes('RestWebService.deleteAction')
      );
      const isApiStart = isCalling || isScmApiStart || isRestStart;

      const isApiContinuation = inApiCall && !isCalling && !isScmApiStart && (
        msg.includes('RestWebService') ||
        msg.includes('FlexiWebService') ||
        msg.includes('.runWebService') ||
        msg.includes('FLEXI_OVERRIDE_SSO_AUTHENTICATION') ||
        msg.includes('Request Authorization:') ||
        msg.includes('Authenticator Configuration') ||
        msg.includes('FlexiUtil.transformTokenString2:') ||
        msg.includes('runScript-onResponseReceived') ||
        /failed\s+with\s+response\s+code:\s*\d{3}\b/i.test(msg) ||
        msg.includes('SUCCESS') ||
        msg.includes('FAILED')
      );

      if (isApiStart) {
        if (currentGroup.length > 0) {
          flushGroup(currentGroup);
        }
        currentGroup = [lineInfo];
        inApiCall = true;
      } else if (isApiContinuation) {
        currentGroup.push(lineInfo);
        const hasClosingBracket = msg.includes('}') || msg.includes(']');
        if (
          ((msg.includes('runWebService: result') || msg.includes('postAction result:') || msg.includes('getAction result:')) && hasClosingBracket) ||
          msg.includes('SUCCESS') ||
          msg.includes('FAILED')
        ) {
          flushGroup(currentGroup);
          currentGroup = [];
          inApiCall = false;
        }
      } else {
        if (currentGroup.length > 0) {
          flushGroup(currentGroup);
        }
        currentGroup = [lineInfo];
        inApiCall = false;
      }
    } else {
      currentGroup.push(lineInfo);
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
    appType,
    tenant: fileTenant,
    entries,
  };
}

/**
 * Processes a grouped block of raw lines into a structured LogEntry in a single fast pass
 */
function processGroupToEntry(
  group: RawLogLineInfo[],
  fileName: string,
  fileId: string,
  index: number,
  appType: 'SCM' | 'WMS' | 'UNKNOWN' = 'UNKNOWN',
  fallbackScreen: string = '',
  fallbackField: string = '',
  fallbackEvent: string = ''
): LogEntry | null {
  if (group.length === 0) return null;

  const headerLine = group.find(l => l.isHeader) || group[0];
  const startLine = group[0].lineNum;
  const endLine = group[group.length - 1].lineNum;
  const timestamp = headerLine.timestamp || '';
  const timestampMs = headerLine.timestampMs || 0;
  let level: LogLevel = headerLine.level || 'INFO';
  const logger = headerLine.logger || '';

  const { user, session, threadId, stepSeq, tenant } = extractUserAndSession(
    headerLine.threadBlock || '',
    headerLine.message || '',
    fileName
  );

  let screen = '';
  let field = '';
  let event = '';
  let scannedValue = '';
  let isScan = false;
  let targetField = '';
  let sourceField = '';
  let dialogMessage = '';

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

  // Flexi-specific metadata
  let flexiMethod: FlexiMethodDetails | undefined = undefined;
  let scriptCode = '';
  let scriptErrorLine: number | undefined = undefined;

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
      } else if (txt.includes('.runScript:')) {
        const sm = txt.match(/([A-Za-z0-9_]+)\.runScript:(?:_onPageEntered|onSessionApplicationEnter|onLoginEvent)/);
        if (sm) screen = sm[1];
      } else if (txt.includes('lookup_code:')) {
        const sm = txt.match(/lookup_code:\s*([A-Za-z0-9_]+)/);
        if (sm) screen = sm[1];
      }
    }

    // Field & Event Detection
    if (!field && (txt.includes('.runScript:') || txt.includes('runScript:_'))) {
      const se = txt.match(/(?:([A-Za-z0-9_]+)\.)?runScript:_?([A-Za-z0-9]+)~([A-Za-z0-9_]+)/);
      if (se) {
        event = se[2];
        field = se[3] || se[1] || '';
      }
    }

    // Script Code Extraction
    if (!scriptCode && (txt.includes('runScript:') || txt.includes(', running script script:'))) {
      const codeLines: string[] = [];
      const eqIdx = txt.indexOf(' = ');
      if (eqIdx !== -1 && eqIdx + 3 < txt.length) {
        const firstLine = txt.substring(eqIdx + 3).trim();
        if (firstLine) codeLines.push(firstLine);
      }
      for (let j = i + 1; j < group.length; j++) {
        if (group[j].isHeader) break;
        codeLines.push(group[j].rawText);
      }
      if (codeLines.length > 0) {
        scriptCode = codeLines.join('\n').trim();
      }
    }

    // FlexiAPI Method Detection
    if (!flexiMethod && txt.includes('FlexiAPI.')) {
      if (txt.includes('FlexiAPI.putObject:key:')) {
        const m = txt.match(/FlexiAPI\.putObject:key:\s*([A-Za-z0-9_]+)(?:,\s*object:\s*(.*))?/);
        if (m) flexiMethod = { methodName: 'putObject', key: m[1], value: m[2] ? m[2].trim() : undefined };
      } else if (txt.includes('FlexiAPI.getObject:key:')) {
        const m = txt.match(/FlexiAPI\.getObject:key:\s*([A-Za-z0-9_]+)/);
        if (m) flexiMethod = { methodName: 'getObject', key: m[1] };
      } else if (txt.includes('FlexiAPI.putSessionObject:key:')) {
        const m = txt.match(/FlexiAPI\.putSessionObject:key:\s*([A-Za-z0-9_]+)(?:,\s*object:\s*(.*))?/);
        if (m) flexiMethod = { methodName: 'putSessionObject', key: m[1], value: m[2] ? m[2].trim() : undefined };
      } else if (txt.includes('FlexiAPI.getSessionObject:key:')) {
        const m = txt.match(/FlexiAPI\.getSessionObject:key:\s*([A-Za-z0-9_]+)/);
        if (m) flexiMethod = { methodName: 'getSessionObject', key: m[1] };
      } else if (txt.includes('FlexiAPI.removeObject:key:')) {
        const m = txt.match(/FlexiAPI\.removeObject:key:\s*([A-Za-z0-9_]+)/);
        if (m) flexiMethod = { methodName: 'removeObject', key: m[1] };
      } else if (txt.includes('FlexiAPI.removeSessionObject:key:')) {
        const m = txt.match(/FlexiAPI\.removeSessionObject:key:\s*([A-Za-z0-9_]+)/);
        if (m) flexiMethod = { methodName: 'removeSessionObject', key: m[1] };
      } else if (txt.includes('FlexiAPI.gotoComponent:')) {
        const m = txt.match(/FlexiAPI\.gotoComponent:(?:componentName:|target:)\s*([A-Za-z0-9_]+)/);
        if (m) flexiMethod = { methodName: 'gotoComponent', target: m[1] };
      } else if (txt.includes('FlexiAPI.setStatusMessage:')) {
        const m = txt.match(/FlexiAPI\.setStatusMessage:message[=:]\s*(.*)/);
        if (m) flexiMethod = { methodName: 'setStatusMessage', message: m[1].trim() };
      } else if (txt.includes('FlexiAPI.executeQuery:query')) {
        const m = txt.match(/FlexiAPI\.executeQuery:query\s+(.*?)(?:,\s*parameters\s+(.*))?$/);
        if (m) flexiMethod = { methodName: 'executeQuery', query: m[1].trim(), value: m[2] ? m[2].trim() : undefined };
      } else if (txt.includes('FlexiAPI.executeUpdate:query')) {
        const m = txt.match(/FlexiAPI\.executeUpdate:query\s+(.*?)(?:,\s*parameters\s+(.*))?$/);
        if (m) flexiMethod = { methodName: 'executeUpdate', query: m[1].trim(), value: m[2] ? m[2].trim() : undefined };
      }
    }

    // User input / Barcode scan detection
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
    } else if (txt.includes('BarcodeManager.extractBarcodes:result=')) {
      const bm = txt.match(/result=(.*)/);
      if (bm && !scannedValue) {
        scannedValue = bm[1].trim();
        isScan = true;
      }
    }

    // Dialog prompt detection
    if (txt.includes('FlexiRuntime.showOptionDialog:')) {
      const dm = txt.match(/message\s+([^,]+)/);
      if (dm) {
        dialogMessage = dm[1].trim();
        if (!flexiMethod) flexiMethod = { methodName: 'showOptionDialog', message: dialogMessage };
      }
    }

    // API Detection
    if (!apiName) {
      if (txt.includes('FlexiWebService.runWebService: finish ')) {
        const m = txt.match(/finish\s+([A-Za-z0-9_]+)/);
        if (m) apiName = m[1];
      } else if (txt.includes('FlexiWebService.runWebService: ID=')) {
        const m = txt.match(/ID=([A-Za-z0-9_]+)/);
        if (m) apiName = m[1];
      } else if (txt.includes('FlexiWebService.callWebService:name:')) {
        const m = txt.match(/callWebService:name:([A-Za-z0-9_]+)/);
        if (m) apiName = m[1];
      } else if (txt.includes('<-------- Calling ')) {
        const m = txt.match(/<--------\s*Calling\s+([A-Za-z0-9_]+)/);
        if (m) apiName = m[1];
      } else if (txt.includes('.runWebService')) {
        const m = txt.match(/\b([A-Za-z0-9_]+)\.runWebService/);
        if (m && m[1] !== 'FlexiWebService') apiName = m[1];
      } else if (/failed\s+with\s+response\s+code:\s*\d{3}\b/i.test(txt)) {
        const m = txt.match(/([A-Za-z0-9_]+)\s+failed\s+with\s+response\s+code:\s*(\d{3})/i);
        if (m) {
          if (!apiName) apiName = m[1];
          if (responseCode === undefined) responseCode = parseInt(m[2], 10);
        }
      } else if (txt.includes('runScript-onResponseReceived~')) {
        const m = txt.match(/runScript-onResponseReceived~([A-Za-z0-9_]+)/);
        if (m) apiName = m[1];
      }
    }

    if (!method) {
      const rm = txt.match(/Request\s*Method\s*=\s*([A-Z]+)/i);
      if (rm) {
        method = rm[1].toUpperCase();
      } else if (txt.includes('RestWebService.postAction')) {
        method = 'POST';
      } else if (txt.includes('RestWebService.getAction')) {
        method = 'GET';
      } else if (txt.includes('RestWebService.patchAction')) {
        method = 'PATCH';
      } else if (txt.includes('RestWebService.putAction')) {
        method = 'PUT';
      } else if (txt.includes('RestWebService.deleteAction')) {
        method = 'DELETE';
      }
    }

    if (!url) {
      const ru = txt.match(/(?:URL\s*=|postAction:|patchAction:|getAction:|putAction:|deleteAction:)\s*(https?:\/\/\S+)/i);
      if (ru) {
        url = ru[1].trim();
      } else if (txt.includes('Final statement = http')) {
        const fu = txt.match(/Final\s*statement\s*=\s*(https?:\/\/\S+)/i);
        if (fu) url = fu[1].trim();
      }
    }

    if (responseCode === undefined) {
      const rcm = txt.match(/Response\s*Code\s*=\s*(\d{3})/i);
      if (rcm) {
        responseCode = parseInt(rcm[1], 10);
      } else if (/failed\s+with\s+response\s+code:\s*(\d{3})/i.test(txt)) {
        const fm = txt.match(/failed\s+with\s+response\s+code:\s*(\d{3})/i);
        if (fm) responseCode = parseInt(fm[1], 10);
      } else if (txt.includes('result ')) {
        const rres = txt.match(/result\s+(\d{3})\b/i);
        if (rres) responseCode = parseInt(rres[1], 10);
      }
    }

    if (!responseBody) {
      if (txt.includes('.runWebService: result') || txt.includes('result:')) {
        const rbm = txt.match(/(?:\.runWebService:\s*result|\bresult:)\s*(?:(\d{3})\s*)?([\s\S]*)/);
        if (rbm && rbm[2] && (rbm[2].trim().startsWith('{') || rbm[2].trim().startsWith('['))) {
          if (rbm[2].includes('}') || rbm[2].includes(']')) {
            responseBody = rbm[2].trim();
          } else {
            // Multiline JSON
            const bodyLines = [rbm[2].trim()];
            for (let j = i + 1; j < group.length; j++) {
              if (group[j].isHeader) break;
              bodyLines.push(group[j].rawText);
              if (group[j].rawText.trim().endsWith('}') || group[j].rawText.trim().endsWith(']')) break;
            }
            responseBody = bodyLines.join('\n').trim();
          }
        }
      }
    }

    if (durationMs === undefined && txt.includes('Total time =')) {
      const rdur = txt.match(/Total\s*time\s*=\s*(\d+)\s*ms/i);
      if (rdur) durationMs = parseInt(rdur[1], 10);
    }

    if (txt.includes('RestWebService.authorizationRequest:') || txt.includes('Request Authorization:')) {
      const ra = txt.match(/(?:authorizationRequest:|Request Authorization:)\s*(\S+\s+\S+|\S+)/i);
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
        const lineSnippet = txt.length > 300 ? txt.substring(0, 300) : txt;
        const sm = lineSnippet.match(/at\s+([a-zA-Z0-9_$.]+)\(([^)]+)\)/);
        if (sm) logCode = `${sm[1]}:${sm[2]}`;
      }
    } else if (!txt.includes('runWebService: result') && (txt.includes('Exception:') || txt.includes('Error:') || txt.includes('Exception ') || txt.includes('Error ') || txt.includes('bsh.EvalError') || txt.includes('bsh.TargetError'))) {
      const lineSnippet = txt.length > 500 ? txt.substring(0, 500) : txt;
      const em = lineSnippet.match(/\b([A-Za-z0-9_.]*(?:Exception|Error))\b:?(?:\s+(.*))?/);
      if (em) {
        exceptionType = em[1];
        exceptionMessage = (em[2] || '').trim();
      }
    }

    // Capture Script Error Line if present
    if (txt.includes('at Line:')) {
      const lm = txt.match(/at\s+Line:\s*(\d+)/i);
      if (lm) {
        scriptErrorLine = parseInt(lm[1], 10);
      }
    }
  }

  if (responseCode === undefined && responseBody) {
    if (responseBody.includes('"code":"NOT_FOUND"')) responseCode = 404;
    else if (responseBody.includes('"code":"VALIDATION_ERROR"')) responseCode = 400;
  }

  if (!apiName && url) {
    const em = url.match(/\/entity\/([a-zA-Z0-9_]+)/i);
    if (em) {
      apiName = `lgfapi: ${em[1].toUpperCase()}`;
    } else {
      const scmMatch = url.match(/\/fscmRestApi\/resources\/[^/]+\/([a-zA-Z0-9_]+)/i);
      if (scmMatch) {
        apiName = `fscmRestApi: ${scmMatch[1]}`;
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

  // Extract scanned value directly from API URL query parameters if not yet captured
  if (!scannedValue && url) {
    const qParams = [
      { key: 'container_nbr', field: 'container_nbr (LPN)' },
      { key: 'container_id__container_nbr', field: 'container_nbr (LPN)' },
      { key: 'pallet_nbr', field: 'pallet_nbr' },
      { key: 'shipment_nbr', field: 'shipment_nbr' },
      { key: 'lpn', field: 'LPN' },
      { key: 'task_id__next_location_id__pick_zone', field: 'pick_zone' },
      { key: 'task_id', field: 'task_id' },
      { key: 'order_dtl_id__order_id__cust_short_text_4', field: 'shipping_option' },
    ];
    for (const qp of qParams) {
      const regex = new RegExp(`[?&]${qp.key}=([^&]+)`, 'i');
      const qm = url.match(regex);
      if (qm && qm[1]) {
        const val = decodeURIComponent(qm[1]).trim();
        if (val) {
          scannedValue = val;
          if (!field) field = qp.field;
          break;
        }
      }
    }
  }

  if (!screen && fallbackScreen) screen = fallbackScreen;
  if (!field && fallbackField) field = fallbackField;
  if (!event && fallbackEvent) event = fallbackEvent;

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
    if (!event) event = apiName;
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

  // Payload Business Failure Detection (HTTP 200/201 but error/warning in response)
  let hasBusinessFailure = false;
  let businessErrorMessage = '';
  let businessErrorType = '';

  if (responseBody) {
    try {
      const jsonStart = responseBody.indexOf('{');
      const jsonEnd = responseBody.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = responseBody.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        // 1. Check ReturnStatus
        if (parsed.ReturnStatus && typeof parsed.ReturnStatus === 'string') {
          const rs = parsed.ReturnStatus.trim().toLowerCase();
          if (rs === 'error' || rs === 'fail' || rs === 'failed' || rs === 'e') {
            hasBusinessFailure = true;
            businessErrorType = 'ReturnStatus: ' + parsed.ReturnStatus;
            businessErrorMessage = parsed.ErrorExplanation || parsed.ReturnMessage || parsed.ErrorMessage || parsed.message || parsed.ReturnStatus;
          } else if (rs === 'warning' || rs === 'warn') {
            if (parsed.ReturnMessage && /partially completed with warnings|warning|failed|error/i.test(parsed.ReturnMessage)) {
              hasBusinessFailure = true;
              businessErrorType = 'Warning: ' + parsed.ReturnStatus;
              businessErrorMessage = parsed.ReturnMessage || parsed.ErrorExplanation || '';
            }
          }
        }

        // 2. Check ErrorExplanation
        if (!hasBusinessFailure && parsed.ErrorExplanation && typeof parsed.ErrorExplanation === 'string' && parsed.ErrorExplanation.trim() && parsed.ErrorExplanation.trim().toLowerCase() !== 'null') {
          hasBusinessFailure = true;
          businessErrorType = 'ErrorExplanation';
          businessErrorMessage = parsed.ErrorExplanation.trim();
        }

        // 3. Check ReturnMessage
        if (!hasBusinessFailure && parsed.ReturnMessage && typeof parsed.ReturnMessage === 'string') {
          const rm = parsed.ReturnMessage.trim();
          if (/partially completed with warnings|fail|failed|error|rejected|denied|exception/i.test(rm)) {
            hasBusinessFailure = true;
            businessErrorType = 'ReturnMessage';
            businessErrorMessage = rm;
          }
        }

        // 4. Check standard error fields
        if (!hasBusinessFailure) {
          const errField = parsed.ErrorMessage || parsed.errorMessage || parsed.error_message || parsed.error || parsed.fault;
          if (errField && typeof errField === 'string' && errField.trim() && errField.trim().toLowerCase() !== 'null' && errField.trim().toLowerCase() !== 'ok' && errField.trim().toLowerCase() !== 'success') {
            hasBusinessFailure = true;
            businessErrorType = 'ErrorMessage';
            businessErrorMessage = errField.trim();
          } else if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            hasBusinessFailure = true;
            businessErrorType = 'Errors';
            businessErrorMessage = typeof parsed.errors[0] === 'string' ? parsed.errors[0] : (parsed.errors[0].message || JSON.stringify(parsed.errors[0]));
          }
        }
      }
    } catch (_) {
      const expMatch = responseBody.match(/"ErrorExplanation"\s*:\s*"([^"]+)"/i);
      if (expMatch && expMatch[1] && expMatch[1].toLowerCase() !== 'null') {
        hasBusinessFailure = true;
        businessErrorType = 'ErrorExplanation';
        businessErrorMessage = expMatch[1];
      }
      const retMsgMatch = responseBody.match(/"ReturnMessage"\s*:\s*"([^"]+)"/i);
      if (retMsgMatch && retMsgMatch[1] && /partially completed with warnings|fail|failed|error/i.test(retMsgMatch[1])) {
        hasBusinessFailure = true;
        businessErrorType = 'ReturnMessage';
        businessErrorMessage = retMsgMatch[1];
      }
    }
  }

  // Categorization & Root Cause
  let isIssue = false;
  let issueCategory: IssueCategory = 'NONE';
  let status: 'FAIL' | 'WARN' | 'PASS' | 'INFO' = 'INFO';
  let rootCauseHint = '';
  let suggestedFix = '';

  const whereCalled = `Called in Field "${field || 'N/A'}" at event "${event || 'N/A'}"${screen ? ` (Screen: "${screen}")` : ''}`;

  if (apiDetails?.responseCode && apiDetails.responseCode >= 400) {
    isIssue = true;
    issueCategory = 'API_FAILURE';
    status = 'FAIL';
    level = 'ERROR';

    let errSnippet = '';
    if (apiDetails.responseBody) {
      try {
        const bodyObj = JSON.parse(apiDetails.responseBody);
        errSnippet = bodyObj.message || bodyObj.code || bodyObj.error || apiDetails.responseBody.substring(0, 100);
      } catch (_) {
        errSnippet = apiDetails.responseBody.substring(0, 100);
      }
    }

    if (apiDetails.responseCode === 404) {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || 'endpoint'} returned HTTP 404 (NOT_FOUND). ${errSnippet ? `Server message: "${errSnippet}". ` : ''}${scannedValue ? `Scanned ${field || 'Container/LPN'} "${scannedValue}" was not found in inventory.` : 'Requested record was not found in backend.'} ${whereCalled}.`;
      suggestedFix = `Verify if ${field || 'record'} ${scannedValue ? `"${scannedValue}" ` : ''}exists in backend system or was already completed.`;
    } else if (apiDetails.responseCode >= 500) {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || ''} failed with HTTP ${apiDetails.responseCode} server error. ${errSnippet ? `Backend message: "${errSnippet}". ` : ''}${whereCalled}.`;
      suggestedFix = `Check backend Cloud integration endpoint logs.`;
    } else {
      rootCauseHint = `${apiDetails.method || 'API'} ${apiDetails.name || ''} returned HTTP ${apiDetails.responseCode}. ${errSnippet ? `Response: "${errSnippet}". ` : ''}${whereCalled}.`;
      suggestedFix = `Check request parameters, attributes, and authorization credentials.`;
    }

    if (missingValueDetails) {
      rootCauseHint += ` Note: Payload also sent with empty fields: [${missingValueDetails.field}].`;
      suggestedFix += ` Ensure required fields are scanned before submit.`;
    }
  } else if (hasBusinessFailure && apiDetails) {
    isIssue = true;
    issueCategory = 'API_FAILURE';
    status = 'FAIL';
    level = 'ERROR';

    rootCauseHint = `REST API ${apiDetails.name || 'endpoint'} returned HTTP ${apiDetails.responseCode || 200} with Business Failure [${businessErrorType}]: "${businessErrorMessage}". ${whereCalled}.`;
    suggestedFix = `Investigate business validation failure: "${businessErrorMessage}". Check field values and conditions passed in event "${event || 'N/A'}".`;
  } else if (dialogMessage) {
    isIssue = true;
    issueCategory = 'VALIDATION';
    status = 'WARN';
    level = 'WARN';
    if (!event) event = 'showOptionDialog';
    rootCauseHint = `WMS Dialog Prompt: "${dialogMessage}". The scanned value does not match current shipment or validation rules.`;
    suggestedFix = `Ensure operator scans an LPN that exists on this shipment.`;
  } else if (sampleSnippet.includes('LogFireSSHConnection.SendKey:content=') && !exceptionType && !apiDetails) {
    // Standard VT100 / telnet terminal render, NOT an error
    status = 'INFO';
    isIssue = false;
    issueCategory = 'NONE';
    if (!event) event = 'SSH_TERMINAL_RENDER';
  } else if (errorDetails || level === 'ERROR') {
    isIssue = true;
    issueCategory = 'EXCEPTION';
    status = 'FAIL';

    const excType = errorDetails?.type || 'Exception';
    const excMsg = errorDetails?.message || '';

    if (excType.includes('EvalError') || excMsg.includes('bsh.EvalError')) {
      rootCauseHint = `BeanShell Script Evaluation Error${scriptErrorLine ? ` at script Line ${scriptErrorLine}` : ''}: ${excMsg.substring(0, 160)}. Check variable declaration or conditions.`;
      suggestedFix = `Inspect the script code in Detail Panel (Line ${scriptErrorLine || 'N/A'}) and ensure proper variable types and null checks.`;
    } else if (excType.includes('TargetError') || excMsg.includes('bsh.TargetError')) {
      rootCauseHint = `BeanShell Runtime Exception${scriptErrorLine ? ` at script Line ${scriptErrorLine}` : ''}: ${excMsg.substring(0, 160)}.`;
      suggestedFix = `Check array bounds, null references, or object types invoked within the script.`;
    } else if (sampleSnippet.includes('No target component found')) {
      const cm = sampleSnippet.match(/No target component found\s*:\s*target name\s*([A-Za-z0-9_]+)/);
      const compName = cm ? cm[1] : 'specified component';
      rootCauseHint = `Flexi Navigation Error: Page could not find target component '${compName}'.`;
      suggestedFix = `Verify '${compName}' exists on this screen definition and is not conditionally unrendered.`;
    } else if (sampleSnippet.includes('Component is not focusable')) {
      rootCauseHint = `Flexi UI Focus Error: Cannot set focus to component because it is hidden, disabled, or read-only.`;
      suggestedFix = `Ensure component.setHidden(false) and component.setEnabled(true) are executed before calling goToComponent.`;
    } else if (excType.includes('JdbcConnectionException') || sampleSnippet.includes('JdbcConnectionException')) {
      rootCauseHint = `Database Query Failure in Flexi: Unable to execute lookup/incident query against the database.`;
      suggestedFix = `Verify database connectivity, lookup table definitions (e.g. FLEXI_LOOKUPS), and SQL syntax.`;
    } else if (excMsg.includes('Unknown content encoding x-gzip')) {
      rootCauseHint = `REST WebService Decompression Error: Oracle Cloud server returned 'x-gzip' compression which was rejected.`;
      suggestedFix = `Check RestWebService header configuration; avoid passing unsupported Accept-Encoding headers.`;
    } else if (sampleSnippet.includes('You must enter a valid combination of values for the OrderNumber')) {
      rootCauseHint = `Oracle Fusion SCM Pick Wave Error (HTTP 400): Invalid combination of OrderNumber, OrderTypeCode, or SourceSystemName.`;
      suggestedFix = `Ensure Order Number and Source System Name are validated against Oracle Fusion SCM before submitting pick wave.`;
    } else if (excType.includes('IOException') && sampleSnippet.includes('LogFireSSHConnection')) {
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

  // Determine Entry Type (Focus on Flexi code, methods, APIs, and errors vs Platform noise)
  let entryType: EntryType = 'PLATFORM';
  if (apiDetails) {
    entryType = 'API_CALL';
  } else if (isIssue || status === 'FAIL' || errorDetails || level === 'ERROR') {
    entryType = 'ERROR';
  } else if (flexiMethod) {
    entryType = 'FLEXI_METHOD';
  } else if (scriptCode || sampleSnippet.includes('runScript:') || sampleSnippet.includes('running script')) {
    entryType = 'SCRIPT_CODE';
  } else if (isScan || scannedValue || sampleSnippet.includes('handleUI:inputData=') || sampleSnippet.includes('handleUI: ENTER') || sampleSnippet.includes('BarcodeManager.extractBarcodes')) {
    entryType = 'USER_INPUT';
  } else if (
    sampleSnippet.includes('LogFireSSHConnection.SendKey') ||
    sampleSnippet.includes('Transformed Action {ActionType') ||
    sampleSnippet.includes('prevCur') ||
    sampleSnippet.includes('Session.keepAlive') ||
    sampleSnippet.includes('onWebSocketPing') ||
    sampleSnippet.includes('FlexiWebSocket.onWebSocketPing')
  ) {
    entryType = 'PLATFORM';
  } else if (logger === 'UserActionLogger' || logger === 'LogFirePage') {
    entryType = 'USER_INPUT';
  } else {
    entryType = 'PLATFORM';
  }

  // Provide meaningful default rootCauseHint for Flexi Methods if not set
  if (!rootCauseHint && flexiMethod) {
    switch (flexiMethod.methodName) {
      case 'putSessionObject':
        rootCauseHint = `Stored session variable '${flexiMethod.key}' = ${flexiMethod.value ? `"${flexiMethod.value}"` : 'null'}`;
        break;
      case 'putObject':
        rootCauseHint = `Stored component object '${flexiMethod.key}' = ${flexiMethod.value ? `"${flexiMethod.value}"` : 'null'}`;
        break;
      case 'getSessionObject':
        rootCauseHint = `Retrieved session variable '${flexiMethod.key}'`;
        break;
      case 'getObject':
        rootCauseHint = `Retrieved component object '${flexiMethod.key}'`;
        break;
      case 'removeObject':
        rootCauseHint = `Removed object '${flexiMethod.key}' from memory`;
        break;
      case 'removeSessionObject':
        rootCauseHint = `Removed session variable '${flexiMethod.key}'`;
        break;
      case 'gotoComponent':
        rootCauseHint = `Focus navigation directed to component '${flexiMethod.target || ''}'`;
        break;
      case 'setStatusMessage':
        rootCauseHint = `Flexi Status Notification: "${flexiMethod.message || ''}"`;
        break;
      case 'executeQuery':
        rootCauseHint = `Flexi SQL Query: ${flexiMethod.query ? flexiMethod.query.substring(0, 100) : ''}...`;
        break;
      case 'executeUpdate':
        rootCauseHint = `Flexi SQL Update: ${flexiMethod.query ? flexiMethod.query.substring(0, 100) : ''}...`;
        break;
    }
  } else if (!rootCauseHint && scriptCode) {
    rootCauseHint = `Executed custom script for ${field || screen || 'event'} (${event || 'script'})`;
  }

  if (!event && flexiMethod) event = flexiMethod.methodName;
  if (!field && flexiMethod?.key) field = flexiMethod.key;
  if (!field && flexiMethod?.target) field = flexiMethod.target;

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

    // SCM & Flexi focused metadata
    entryType,
    appType,
    tenant,
    flexiMethod,
    scriptCode: scriptCode || undefined,
    scriptErrorLine,
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
