# Log Reviewer - Intellinum Flexi Log Analyzer & Diagnostic

A modern, high-performance web application designed for Intellinum Flexi teams to review application screen logs and server error logs in seconds—replacing tedious manual raw log file reading.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Web Workers**, ready to deploy on **Vercel** with zero extra configuration.

---

## 🌟 Why Log Reviewer?

In warehouse RF operations, Intellinum Flexi servers write logs continuously to the bottom of the file. Support engineers and developers troubleshoot issues by reading the file **from bottom to top (newest first)** to immediately spot what broke, why it broke, and what the operator was doing right before the failure.

**Log Reviewer** automates this entire manual workflow:
1. **Default Newest-First Order**: The latest log entries appear at the very top of the table, dashboard, session timeline, and RCA report.
2. **Atomic Multi-Line Grouping**: Stack traces, multi-line REST API requests/responses, and UI actions are grouped in their original order *before* reversing, so traces and JSON payloads remain readable.
3. **Original Line Numbers Preserved**: Exact log line numbers from the raw file (e.g. `L12574` or `L1874-1879`) are displayed on every entry for instant cross-referencing.
4. **Client-Side Privacy & Scale**: Parsing occurs entirely in the browser using **Web Workers**. Large files (50MB+) parse in milliseconds without freezing the UI or sending sensitive enterprise log data over the wire.

---

## 🚀 Key Features

### 1. Multi-File Log Upload
- Drag-and-drop or browse multiple log files simultaneously (`.log`, `.txt`, `.json`, `.csv`).
- Real-time progress bar reporting lines scanned and memory parsing stages.
- Pre-loaded one-click sample buttons:
  - **Screen Session Log** (`WS-G-HK`): Demonstrates field events, barcode inputs, and REST API 404 failures.
  - **Server Error Log** (`flexi-error`): Demonstrates SSH IOExceptions and SessionMonitor idle terminations.

### 2. Intelligent Flexi Log Parser
Extracts and normalizes all Flexi-specific structures:
- **Timestamp & Level**: `YYYY-MM-DD HH:mm:ss.SSS` with epoch ms precision.
- **User & Session ID**: Automatically extracted from thread blocks (e.g. `[][WS-G-HK(181)-[(181)Thread-509]-[3]]` -> User: `WS-G-HK`, Session: `181`).
- **Screen / Page Name**: Automatically resolved from `runScript:_onPageEntered~`, `OPEN_PAGE`, or `openApplication`.
- **Field & Event**: `onFocus`, `onExit`, `onKeyPress`, `afterFocus`, `beforeExit`, `onClick`, `afterClick`, `MOUSE_ENTER`, `ENTER`.
- **Scanned vs Input Value**: Distinguishes barcode scans (`isScan: true`) from keyboard entries.
- **REST API Call Bundling**: Correlates method (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`), URL, payload, HTTP status code (`200`, `202`, `404`, `500`), duration, and response body into a single coherent entry.
- **Exception & Stack Trace Handling**: Captures full Java stack traces with line references (e.g. `LogFirePage.java:3904`).

### 3. Automated Issue Detection & Root Cause Hints
- **HTTP 4xx / 5xx Failures**: Identifies failed endpoints, parses response error bodies, and generates plain-English explanations (e.g., *"API GET_INVENTROY_WS returned 404 (Not Found). Queried record does not exist in Oracle WMS"*).
- **Missing / Null Payload Values**: Flags empty keys in JSON payloads (e.g., missing `LPNNumber` or `orderNumber`).
- **SSH / Socket Drop**: Flags `java.io.IOException: null` in `JSCHManager.isConnected` when communication to backend Oracle WMS terminal drops.
- **WebSocket Drops**: Detects `ClosedChannelException` on `FlexiWebSocket.send` when RF scanner devices lose Wi-Fi.
- **Session Timeout**: Flags user inactivity terminations from `SessionMonitor` (120-minute idle threshold).

### 4. Interactive Dashboard
- Summary cards: Total Entries, Total Failures, Failed APIs, Active Users, and Sessions.
- **Latest Issues Banner**: The 5 most recent failures detected from the bottom of the log file.
- **Top 5 Failing APIs**: Visual bar chart ranking endpoints by failure frequency.
- **Top 5 Failing Fields**: Visual bar chart ranking screen fields by input/validation failures.

### 5. Multi-Faceted Filters & Search
- Global search box across scanned values, field names, API URLs, error text, and log codes.
- "Only Failures" quick toggle.
- Filter dropdowns: User, Session ID, API Method, Status Code, Log Level, Screen, Field.
- Clickable pills on User and Session IDs to filter instantly.
- "Jump to Latest" (top) and "Jump to Oldest" (bottom) quick-scroll buttons.

### 6. Session Execution Timeline
- Select any Session ID to view a chronological step-by-step visual replay of the operator's journey:
  `Field Focus` → `Scanned Value` → `API Request` → `API Response` → `Failure Point`.
- Highlights failed steps in high-contrast red cards with root cause diagnostics.
- Toggle between **Newest Step First** (to see the failure immediately) and **Chronological** (to replay user steps from login).

### 7. Slide-Over Detail Panel
- Pretty-printed, collapsible JSON request payloads and responses with one-click copy.
- Full Java stack trace viewer.
- Copyable raw log lines box with original file line numbers.
- Previous / Next entry navigation in the currently active sort order.

### 8. RCA Report Generator & Multi-Format Exports
- **Generate RCA Report**: Creates an executive Root Cause Analysis report with:
  - Executive Metadata (Date range, impacted users, sessions, source files).
  - **Editable textareas** for *Root Cause Summary*, *Business & System Impact*, and *Recommended Resolution* so engineers can customize the narrative before export.
  - Interactive issue selection table.
  - Multi-format export: **Standalone HTML Report**, **PDF Document**, **Excel (.xlsx)**, and **Print View**.
- Export raw/filtered results to **Excel (.xlsx)**, **CSV**, and **PDF**.

### 9. Privacy & Masking
- Toggle **Mask Sensitive Values** in one click to redact `Authorization: Basic ...` headers, tokens, and passwords.

---

## 🛠️ Project Structure

```
log-reviewer/
├── app/
│   ├── globals.css          # Tailwind CSS styles and dark mode themes
│   ├── layout.tsx           # Root HTML layout and metadata
│   └── page.tsx             # Main App Router page
├── components/
│   ├── Navbar.tsx           # Top navigation bar, sort toggle, and exports
│   ├── LogUploader.tsx      # Multi-file drag & drop and progress bar
│   ├── Dashboard.tsx        # KPI metrics, top failing APIs/fields, recent issues
│   ├── FilterBar.tsx        # Multi-select filters, search, jump buttons
│   ├── ResultsTable.tsx     # Paginated table with column toggles and badges
│   ├── SessionTimeline.tsx  # Step-by-step visual session journey
│   ├── DetailPanel.tsx      # Slide-over inspector for payloads, traces & raw lines
│   └── RcaReportModal.tsx   # Executive RCA report editor and export modal
├── lib/
│   ├── types.ts             # TypeScript interfaces for log entries, filters, RCA
│   ├── parsingRules.ts      # Configurable regex patterns and detection rules
│   ├── logParser.ts         # High-performance linear parser and grouping engine
│   ├── filterUtils.ts       # Filtering, sorting (newest-first), and masking
│   ├── exportUtils.ts       # Excel, CSV, PDF, and HTML report generators
│   └── workerClient.ts      # Web Worker manager with main-thread fallback
├── public/
│   ├── workers/
│   │   └── logParserWorker.js # Dedicated Web Worker script
│   └── sample-logs/         # Built-in sample screen and server logs
├── package.json
└── tsconfig.json
```

---

## ⚙️ Updating Parsing Rules (`lib/parsingRules.ts`)

If your Flexi logging format changes, you do not need to rewrite the app. Simply edit `lib/parsingRules.ts`:

```typescript
export const PARSING_RULES: ParsingRuleConfig = {
  patterns: {
    logHeader: /^\[([A-Z ]{4,5})\]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(.*)/,
    threadUserSession: /([A-Za-z0-9_-]+)\((\d+)\)(?:-\[\((\d+)\)Thread-([0-9A-Za-z_-]+)\])?(?:-\[(\d+)\])?/,
    sessionMonitorUserSession: /username\s+([A-Za-z0-9_-]+)\s*,?\s*session\s+id\s*:\s*(\d+)/i,
    // ...
  }
};
```

---

## 💻 Running Locally

### Prerequisites
- Node.js 18.17+ or 20+

### Steps
1. Navigate to the project directory:
   ```bash
   cd log-reviewer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deploying on Vercel

The app is fully configured for Vercel with zero extra settings required.

### Option 1: Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option 2: GitHub / GitLab / Bitbucket
1. Push this directory to your Git repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Log Reviewer"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com).
3. Click **"Add New Project"** and import the repository.
4. Framework Preset will automatically detect **Next.js**.
5. Click **"Deploy"**. The app will build and deploy in under 1 minute.
