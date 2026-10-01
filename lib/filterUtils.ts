import { LogEntry, FilterState } from './types';
import { maskSensitiveData } from './logParser';

/**
 * Filters and sorts entries according to FilterState
 */
export function applyFiltersAndSort(entries: LogEntry[], filters: FilterState): LogEntry[] {
  let result = entries.slice();

  // 1. Search Query (fuzzy across multiple fields)
  if (filters.search && filters.search.trim() !== '') {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(e => {
      if (e.userName.toLowerCase().includes(q)) return true;
      if (e.sessionId.toLowerCase().includes(q)) return true;
      if (e.screen.toLowerCase().includes(q)) return true;
      if (e.field.toLowerCase().includes(q)) return true;
      if (e.event.toLowerCase().includes(q)) return true;
      if (e.scannedValue.toLowerCase().includes(q)) return true;
      if (e.logCode.toLowerCase().includes(q)) return true;
      if (e.rootCauseHint.toLowerCase().includes(q)) return true;
      if (e.suggestedFix.toLowerCase().includes(q)) return true;
      if (e.error?.message.toLowerCase().includes(q)) return true;
      if (e.error?.type.toLowerCase().includes(q)) return true;
      if (e.apiDetails?.name?.toLowerCase().includes(q)) return true;
      if (e.apiDetails?.url?.toLowerCase().includes(q)) return true;
      if (e.apiDetails?.method?.toLowerCase().includes(q)) return true;
      if (e.apiDetails?.responseCode?.toString().includes(q)) return true;
      // Search in raw lines as fallback
      if (e.rawLines.some(l => l.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  // 2. Only Failures toggle
  if (filters.onlyFailures) {
    result = result.filter(e => e.isIssue || e.status === 'FAIL' || e.status === 'WARN');
  }

  // 3. Users filter
  if (filters.users.length > 0) {
    const userSet = new Set(filters.users);
    result = result.filter(e => e.userName && userSet.has(e.userName));
  }

  // 4. Sessions filter
  if (filters.sessions.length > 0) {
    const sessionSet = new Set(filters.sessions);
    result = result.filter(e => e.sessionId && sessionSet.has(e.sessionId));
  }

  // 5. API Methods filter
  if (filters.apiMethods.length > 0) {
    const methodSet = new Set(filters.apiMethods.map(m => m.toUpperCase()));
    result = result.filter(e => e.apiDetails?.method && methodSet.has(e.apiDetails.method.toUpperCase()));
  }

  // 6. Response Codes filter
  if (filters.responseCodes.length > 0) {
    const codeSet = new Set(filters.responseCodes.map(c => c.toString()));
    result = result.filter(e => e.apiDetails?.responseCode !== undefined && codeSet.has(e.apiDetails.responseCode.toString()));
  }

  // 7. Log Levels filter
  if (filters.logLevels.length > 0) {
    const levelSet = new Set(filters.logLevels.map(l => l.toUpperCase()));
    result = result.filter(e => levelSet.has(e.level.toUpperCase()));
  }

  // 8. Fields filter
  if (filters.fields.length > 0) {
    const fieldSet = new Set(filters.fields);
    result = result.filter(e => e.field && fieldSet.has(e.field));
  }

  // 9. Events filter
  if (filters.events.length > 0) {
    const eventSet = new Set(filters.events);
    result = result.filter(e => e.event && eventSet.has(e.event));
  }

  // 10. Screens filter
  if (filters.screens.length > 0) {
    const screenSet = new Set(filters.screens);
    result = result.filter(e => e.screen && screenSet.has(e.screen));
  }

  // 11. Date range filter
  if (filters.dateStart) {
    const startMs = parseFilterDate(filters.dateStart);
    if (startMs > 0) {
      result = result.filter(e => e.timestampMs >= startMs);
    }
  }
  if (filters.dateEnd) {
    const endMs = parseFilterDate(filters.dateEnd, true);
    if (endMs > 0) {
      result = result.filter(e => e.timestampMs <= endMs);
    }
  }

  // 12. Sorting: Newest first (bottom-to-top) vs Oldest first (top-to-bottom)
  // When 'newest' (default):
  // Compare timestampMs descending.
  // If timestampMs are equal or missing, compare startLine descending (later lines in file = newer).
  result.sort((a, b) => {
    if (filters.sortOrder === 'newest') {
      if (a.timestampMs !== b.timestampMs) {
        return b.timestampMs - a.timestampMs; // Descending
      }
      return b.startLine - a.startLine; // Descending line number
    } else {
      if (a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs; // Ascending
      }
      return a.startLine - b.startLine; // Ascending line number
    }
  });

  // 13. Mask sensitive data if enabled
  if (filters.maskSensitive) {
    result = result.map(e => ({
      ...e,
      scannedValue: maskSensitiveData(e.scannedValue),
      rootCauseHint: maskSensitiveData(e.rootCauseHint),
      rawLines: e.rawLines.map(l => maskSensitiveData(l)),
      apiDetails: e.apiDetails ? {
        ...e.apiDetails,
        url: maskSensitiveData(e.apiDetails.url || ''),
        requestPayload: maskSensitiveData(e.apiDetails.requestPayload || ''),
        authHeader: maskSensitiveData(e.apiDetails.authHeader || ''),
      } : undefined,
    }));
  }

  return result;
}

function parseFilterDate(dStr: string, isEndOfDay = false): number {
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return 0;
    if (isEndOfDay) {
      d.setHours(23, 59, 59, 999);
    }
    return d.getTime();
  } catch {
    return 0;
  }
}
