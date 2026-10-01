'use client';

import React, { useMemo } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertOctagon, 
  Code,
  Sparkles,
  Server,
  Barcode,
  Layers,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { FilterState, LogEntry, EntryType } from '../lib/types';

interface FilterBarProps {
  entries: LogEntry[];
  filters: FilterState;
  onFilterChange: (update: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onJumpToLatest: () => void;
  onJumpToOldest: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  entries,
  filters,
  onFilterChange,
  onClearFilters,
  onJumpToLatest,
  onJumpToOldest,
}) => {
  // Extract unique filter options and counts from the log entries
  const options = useMemo(() => {
    const users = new Set<string>();
    const sessions = new Set<string>();
    const methods = new Set<string>();
    const codes = new Set<string>();
    const levels = new Set<string>();
    const fields = new Set<string>();
    const screens = new Set<string>();
    const events = new Set<string>();
    const tenants = new Set<string>();

    const entryTypeCounts: Record<EntryType, number> = {
      FLEXI_METHOD: 0,
      SCRIPT_CODE: 0,
      API_CALL: 0,
      ERROR: 0,
      USER_INPUT: 0,
      PLATFORM: 0,
    };

    let scmCount = 0;
    let wmsCount = 0;

    for (const e of entries) {
      if (e.userName) users.add(e.userName);
      if (e.sessionId) sessions.add(e.sessionId);
      if (e.apiDetails?.method) methods.add(e.apiDetails.method);
      if (e.apiDetails?.responseCode !== undefined) codes.add(e.apiDetails.responseCode.toString());
      if (e.level) levels.add(e.level);
      if (e.field) fields.add(e.field);
      if (e.screen) screens.add(e.screen);
      if (e.event) events.add(e.event);
      if (e.tenant) tenants.add(e.tenant);

      if (e.entryType && entryTypeCounts[e.entryType] !== undefined) {
        entryTypeCounts[e.entryType]++;
      }

      if (e.appType === 'SCM') scmCount++;
      else if (e.appType === 'WMS') wmsCount++;
    }

    return {
      users: Array.from(users).sort(),
      sessions: Array.from(sessions).sort(),
      methods: Array.from(methods).sort(),
      codes: Array.from(codes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
      levels: Array.from(levels).sort(),
      fields: Array.from(fields).sort(),
      screens: Array.from(screens).sort(),
      events: Array.from(events).sort(),
      tenants: Array.from(tenants).sort(),
      entryTypeCounts,
      scmCount,
      wmsCount,
    };
  }, [entries]);

  // Active filters count
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.onlyFailures) count++;
    if (!filters.focusFlexiOnly) count++; // Not default
    if (filters.entryTypes?.length) count += filters.entryTypes.length;
    if (filters.appTypes?.length) count += filters.appTypes.length;
    if (filters.tenants?.length) count += filters.tenants.length;
    count += filters.users.length;
    count += filters.sessions.length;
    count += filters.apiMethods.length;
    count += filters.responseCodes.length;
    count += filters.logLevels.length;
    count += filters.fields.length;
    count += filters.screens.length;
    count += filters.events.length;
    return count;
  }, [filters]);

  const toggleEntryType = (type: EntryType) => {
    const current = filters.entryTypes || [];
    const exists = current.includes(type);
    const updated = exists ? current.filter(t => t !== type) : [...current, type];
    onFilterChange({ entryTypes: updated });
  };

  const toggleAppType = (app: string) => {
    const current = filters.appTypes || [];
    const exists = current.includes(app);
    const updated = exists ? current.filter(a => a !== app) : [...current, app];
    onFilterChange({ appTypes: updated });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3 transition-colors">
      
      {/* Row 1: Search Box, Quick Toggles and Jump Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Flexi methods, scripts, API calls, error text, scanned values..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Toggles and Jump Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Flexi Focus Mode Toggle */}
          <button
            onClick={() => onFilterChange({ focusFlexiOnly: !filters.focusFlexiOnly })}
            title={filters.focusFlexiOnly ? "Flexi Focus is Active: Hiding raw terminal VT100 dumps" : "Showing all logs including raw platform VT100 dumps"}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shadow-xs ${
              filters.focusFlexiOnly
                ? 'bg-purple-600 text-white border-purple-700 shadow-purple-500/20'
                : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>🎯</span>
            <span>{filters.focusFlexiOnly ? 'Flexi Focus: ON' : 'All Platform Logs'}</span>
          </button>

          {/* Only Failures Toggle */}
          <button
            onClick={() => onFilterChange({ onlyFailures: !filters.onlyFailures })}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              filters.onlyFailures
                ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Only Failures</span>
          </button>

          {/* Jump to Latest (Top of list) */}
          <button
            onClick={onJumpToLatest}
            title="Jump to latest entries (top of UI)"
            className="px-2.5 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center gap-1 transition-colors"
          >
            <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden md:inline">Jump to Latest</span>
          </button>

          {/* Jump to Oldest (Bottom of list) */}
          <button
            onClick={onJumpToOldest}
            title="Jump to oldest entries (bottom of UI)"
            className="px-2.5 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center gap-1 transition-colors"
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Jump to Oldest</span>
          </button>

          {/* Clear Filters Button */}
          {activeCount > 0 && (
            <button
              onClick={onClearFilters}
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({activeCount})</span>
            </button>
          )}

        </div>

      </div>

      {/* Row 2: Category Filters (Flexi Methods, Scripts, APIs, System Pills) */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
        
        {/* System / App Selector */}
        <div className="flex items-center gap-1 mr-2 bg-gray-100 dark:bg-gray-900/80 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onFilterChange({ appTypes: [] })}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              !filters.appTypes?.length
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            All Systems
          </button>
          {options.scmCount > 0 && (
            <button
              onClick={() => toggleAppType('SCM')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                filters.appTypes?.includes('SCM')
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40'
              }`}
            >
              <span>SCM Cloud</span>
              <span className="text-[10px] px-1 rounded-full bg-teal-800/20">{options.scmCount}</span>
            </button>
          )}
          {options.wmsCount > 0 && (
            <button
              onClick={() => toggleAppType('WMS')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                filters.appTypes?.includes('WMS')
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
            >
              <span>WMS Cloud</span>
              <span className="text-[10px] px-1 rounded-full bg-blue-800/20">{options.wmsCount}</span>
            </button>
          )}
        </div>

        {/* Entry Type Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 font-medium">Filter by Focus:</span>

          {/* Flexi Methods */}
          <button
            onClick={() => toggleEntryType('FLEXI_METHOD')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.entryTypes?.includes('FLEXI_METHOD')
                ? 'bg-purple-100 dark:bg-purple-950/90 text-purple-800 dark:text-purple-200 border-purple-400 ring-2 ring-purple-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-purple-50/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Flexi Methods</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200/60 dark:bg-purple-900/60 font-mono">
              {options.entryTypeCounts.FLEXI_METHOD}
            </span>
          </button>

          {/* Script Code */}
          <button
            onClick={() => toggleEntryType('SCRIPT_CODE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.entryTypes?.includes('SCRIPT_CODE')
                ? 'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-400 ring-2 ring-emerald-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-emerald-50/50'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Scripts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 font-mono">
              {options.entryTypeCounts.SCRIPT_CODE}
            </span>
          </button>

          {/* API Calls */}
          <button
            onClick={() => toggleEntryType('API_CALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.entryTypes?.includes('API_CALL')
                ? 'bg-blue-100 dark:bg-blue-950/90 text-blue-800 dark:text-blue-200 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-blue-50/50'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>API Calls</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-200/60 dark:bg-blue-900/60 font-mono">
              {options.entryTypeCounts.API_CALL}
            </span>
          </button>

          {/* Errors */}
          <button
            onClick={() => toggleEntryType('ERROR')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.entryTypes?.includes('ERROR')
                ? 'bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-400 ring-2 ring-rose-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-rose-50/50'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Errors</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200/60 dark:bg-rose-900/60 font-mono">
              {options.entryTypeCounts.ERROR}
            </span>
          </button>

          {/* User Inputs & Scans */}
          <button
            onClick={() => toggleEntryType('USER_INPUT')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.entryTypes?.includes('USER_INPUT')
                ? 'bg-sky-100 dark:bg-sky-950/90 text-sky-800 dark:text-sky-200 border-sky-400 ring-2 ring-sky-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-sky-50/50'
            }`}
          >
            <Barcode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>User Scans</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-200/60 dark:bg-sky-900/60 font-mono">
              {options.entryTypeCounts.USER_INPUT}
            </span>
          </button>
        </div>

      </div>

      {/* Row 3: Filter Dropdowns Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
        
        {/* User filter */}
        <select
          value={filters.users[0] || ''}
          onChange={(e) => onFilterChange({ users: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.users.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">User: All ({options.users.length})</option>
          {options.users.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Session ID filter */}
        <select
          value={filters.sessions[0] || ''}
          onChange={(e) => onFilterChange({ sessions: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.sessions.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Session: All ({options.sessions.length})</option>
          {options.sessions.map(s => (
            <option key={s} value={s}>Session {s}</option>
          ))}
        </select>

        {/* Screen Name filter */}
        <select
          value={filters.screens[0] || ''}
          onChange={(e) => onFilterChange({ screens: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.screens.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Screen: All ({options.screens.length})</option>
          {options.screens.map(sc => (
            <option key={sc} value={sc}>{sc}</option>
          ))}
        </select>

        {/* Field Name filter */}
        <select
          value={filters.fields[0] || ''}
          onChange={(e) => onFilterChange({ fields: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.fields.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Field: All ({options.fields.length})</option>
          {options.fields.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        {/* Event filter */}
        <select
          value={filters.events[0] || ''}
          onChange={(e) => onFilterChange({ events: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.events.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Event: All ({options.events.length})</option>
          {options.events.map(ev => (
            <option key={ev} value={ev}>{ev}</option>
          ))}
        </select>

        {/* API Method filter */}
        <select
          value={filters.apiMethods[0] || ''}
          onChange={(e) => onFilterChange({ apiMethods: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.apiMethods.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Method: All</option>
          {['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Response Code filter */}
        <select
          value={filters.responseCodes[0] || ''}
          onChange={(e) => onFilterChange({ responseCodes: e.target.value ? [e.target.value] : [] })}
          className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
            filters.responseCodes.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value="">Status Code: All</option>
          {options.codes.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Tenant filter (if any) */}
        {options.tenants.length > 0 ? (
          <select
            value={filters.tenants?.[0] || ''}
            onChange={(e) => onFilterChange({ tenants: e.target.value ? [e.target.value] : [] })}
            className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
              filters.tenants?.length ? 'border-teal-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <option value="">Tenant: All ({options.tenants.length})</option>
            {options.tenants.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          /* Log Level filter fallback */
          <select
            value={filters.logLevels[0] || ''}
            onChange={(e) => onFilterChange({ logLevels: e.target.value ? [e.target.value] : [] })}
            className={`py-1.5 px-2 rounded-lg border text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${
              filters.logLevels.length > 0 ? 'border-blue-500 font-semibold' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <option value="">Level: All</option>
            {['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}

      </div>

    </div>
  );
};
