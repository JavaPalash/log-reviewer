'use client';

import React, { useMemo } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertOctagon, 
  SlidersHorizontal 
} from 'lucide-react';
import { FilterState, LogEntry } from '../lib/types';

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
  // Extract unique filter options from the log entries
  const options = useMemo(() => {
    const users = new Set<string>();
    const sessions = new Set<string>();
    const methods = new Set<string>();
    const codes = new Set<string>();
    const levels = new Set<string>();
    const fields = new Set<string>();
    const screens = new Set<string>();
    const events = new Set<string>();

    for (const e of entries) {
      if (e.userName) users.add(e.userName);
      if (e.sessionId) sessions.add(e.sessionId);
      if (e.apiDetails?.method) methods.add(e.apiDetails.method);
      if (e.apiDetails?.responseCode !== undefined) codes.add(e.apiDetails.responseCode.toString());
      if (e.level) levels.add(e.level);
      if (e.field) fields.add(e.field);
      if (e.screen) screens.add(e.screen);
      if (e.event) events.add(e.event);
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
    };
  }, [entries]);

  // Active filters count
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.onlyFailures) count++;
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

  const toggleArrayFilter = (key: keyof FilterState, val: string) => {
    const current = (filters[key] as string[]) || [];
    const exists = current.includes(val);
    const updated = exists ? current.filter(x => x !== val) : [...current, val];
    onFilterChange({ [key]: updated });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3 transition-colors">
      
      {/* Top Row: Search Box, Only Failures Switch, Jump Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search values, fields, API URLs, error text, log codes..."
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

      {/* Filter Dropdowns Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
        
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

        {/* Log Level filter */}
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

      </div>

    </div>
  );
};
