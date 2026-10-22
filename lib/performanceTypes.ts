export type DelayCategory = 
  | 'USER_HOLD'             // User idle / paused on screen before submitting
  | 'RF_TERMINAL_LATENCY'   // Oracle WMS SSH host processing delay (SendKey)
  | 'API_LATENCY'           // Web Service REST API call execution
  | 'SCRIPT_LATENCY'        // Flexi BeanShell script execution / initialization
  | 'SCREEN_PARSING'        // RF screen parsing & dynamic layout personalization
  | 'NORMAL';               // Fast response (<1000ms)

export interface ScreenEventDetail {
  id: string;
  timestamp: string;
  timestampMs: number;
  durationMs: number;
  durationFormatted: string;
  isReportedDuration: boolean; // true if from LogFireTime, API Total time, script init ms; false if interval
  event: string; // 'onFocus', 'onExit', 'onKeyPress', 'ENTER', 'MOUSE_ENTER', 'SCAN', 'API_CALL', 'SCRIPT', 'SUBMIT', 'NAVIGATE', etc.
  field: string; // e.g. 'textPalletLPN', 'textLocn', 'ORG_CODE', 'ITEM_DESC'
  value?: string; // e.g. scanned barcode, entered text
  stepSeq?: string;
  lineNo: number; // original line number in log file (1-indexed physical Notepad++ line)
  status: 'PASS' | 'WARN' | 'FAIL'; // WARN if slow (>1500ms), FAIL if error/4xx/5xx
  details: string;

  // Root Cause / Delay Reason Diagnostics
  delayCategory?: DelayCategory;
  whySlow?: string; // Plain-English diagnostic explanation of why this step took time
  userHoldTimeMs?: number; // Time user spent holding screen before this action
  serverLatencyMs?: number; // Backend terminal / SSH response latency
  apiLatencyMs?: number; // Remote web service API latency
  scriptLatencyMs?: number; // Flexi script execution latency
}

export interface ScreenTransaction {
  id: string;
  screenName: string; // Friendly title e.g. "MANUAL PUTAWAY", "Change Organization", "On Hand Inquiry"
  screenCode: string; // Technical code e.g. "FUSION_CHG_ORG", "menu3MANUALPUTAWAY", "1193"
  appType: 'SCM' | 'WMS' | 'UNKNOWN';
  fileName: string;
  fileId: string;
  userName: string;
  sessionId: string;
  threadId: string;
  startTime: string;
  startTimeMs: number;
  endTime: string;
  endTimeMs: number;
  totalDurationMs: number;
  totalDurationFormatted: string;
  startLine: number;
  endLine: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'HAS_ERROR';
  eventsCount: number;
  apiCallsCount: number;
  apiTotalDurationMs: number;
  maxEventDurationMs: number;
  slowestEventName: string;
  primaryDelayCategory?: DelayCategory;
  primaryDelayReason?: string;
  events: ScreenEventDetail[];
}

export interface PerformanceSummary {
  totalTransactions: number;
  avgDurationMs: number;
  avgDurationFormatted: string;
  maxDurationMs: number;
  slowestScreen: string;
  totalEventsCount: number;
  avgEventDurationMs: number;
  screenNames: string[];
}
