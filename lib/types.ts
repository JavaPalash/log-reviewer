export type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'TRACE' | 'FATAL';

export type IssueCategory =
  | 'API_FAILURE'
  | 'EXCEPTION'
  | 'MISSING_VALUE'
  | 'VALIDATION'
  | 'SESSION_TIMEOUT'
  | 'CONNECTION_DROP'
  | 'NONE';

export interface ApiDetails {
  name?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | string;
  url?: string;
  requestPayload?: string;
  responseCode?: number;
  responseBody?: string;
  durationMs?: number;
  authHeader?: string;
}

export interface MissingValueInfo {
  field: string;
  sourceObject?: string;
  reason: string;
}

export interface ErrorDetails {
  type: string;
  message: string;
  stackTrace?: string[];
  exceptionClass?: string;
}

export interface LogEntry {
  id: string;
  fileId: string;
  fileName: string;
  startLine: number; // Original line number in log file (1-indexed)
  endLine: number;
  timestamp: string; // Formatted YYYY-MM-DD HH:mm:ss.SSS
  timestampMs: number; // Unix epoch ms for sorting across files
  level: LogLevel;
  userName: string;
  sessionId: string;
  threadId: string;
  stepSeq: string;
  screen: string;
  field: string;
  event: string; // onFocus, onExit, onKeyPress, afterFocus, beforeExit, onClick, afterPageEntered, etc.
  scannedValue: string;
  isScan: boolean;
  targetField?: string;
  sourceField?: string;
  apiDetails?: ApiDetails;
  error?: ErrorDetails;
  logCode: string; // Code reference/class/method e.g. LogFirePage.java:3904
  logger: string; // e.g. UserActionLogger, LogFirePage, WebShell
  rawLines: string[]; // contiguous raw log lines in ORIGINAL order
  isIssue: boolean;
  issueCategory: IssueCategory;
  missingValueDetails?: MissingValueInfo;
  rootCauseHint: string;
  suggestedFix: string;
  status: 'FAIL' | 'WARN' | 'PASS' | 'INFO';
}

export interface ParsedLogFile {
  id: string;
  fileName: string;
  fileSize: number;
  totalLines: number;
  totalEntries: number;
  errorCount: number;
  warnCount: number;
  entries: LogEntry[];
}

export interface FilterState {
  search: string;
  users: string[];
  sessions: string[];
  apiMethods: string[];
  responseCodes: string[];
  logLevels: string[];
  fields: string[];
  events: string[];
  screens: string[];
  onlyFailures: boolean;
  dateStart?: string;
  dateEnd?: string;
  sortOrder: 'newest' | 'oldest'; // 'newest' = bottom-to-top, 'oldest' = top-to-bottom
  maskSensitive: boolean;
}

export interface RcaReportData {
  title: string;
  dateRange: string;
  analyzedFiles: string[];
  totalLogs: number;
  totalIssues: number;
  uniqueUsers: string[];
  uniqueSessions: string[];
  rootCauseSummary: string;
  impactAnalysis: string;
  recommendedResolution: string;
  selectedIssues: LogEntry[];
}
