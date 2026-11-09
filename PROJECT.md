# Project: Habit Tracker Comprehensive Graphify Decoupling & Dead Code Elimination

## Architecture
The Habit Tracker is a local-first, privacy-respecting React 19 single-page application consisting of:
- **Core Time & Calculation Engine**: `adhanCalculator.js`, `aladhanApiService.js`, `countryLocalization.js`, `storage.js`, `timeUtils.js`, `dataReadiness.js`.
- **Prayer Views & Timers**: `PrayerTrackerView.jsx`, `ActivePrayerHero.jsx`, `LiveClock.jsx`, `LiveCountdown.jsx`, `LiveProgressBar.jsx`, `ScheduleTableModal.jsx`.
- **Sheikh Muneer AI Chat**: `ChatView.jsx`, `geminiApi.js`, `muneerSignalService.js`, `markdownFormatter.jsx` (local storage chat history, prompt assembly, streaming, Speech Synthesis).
- **Book Reader**: `BookReaderView.jsx`, `bookStorage.js` (pdfjs-dist rendering, shelf, bookmarking, zoom/rotation, dual-page RTL).
- **Audio & Tasbeeh**: `AudioPlayerView.jsx`, `audioStorage.js`, `TasbeehView.jsx`, `tasbeehStorage.js`.
- **Settings, Analytics & Shell**: `SettingsView.jsx`, `DashboardView.jsx`, `App.jsx`, `Header.jsx`, `src/index.css`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Root Duplicate Assets Removal | Remove duplicate fonts & SVGs from project root (~1.34 MB) | M1 | Survey (Explorer 1) |
| 2 | Dead Files Cleanup | Delete unused `src/App.css`, `read_logs.js`, `public/icon.png`, `public/tasbih.svg` | M1 | Survey (Explorer 1) |
| 3 | Dead Exported Functions Removal | Remove 10 unused functions with 0 callers across services | M1 | Survey (Explorer 1) |
| 4 | Dead Dependency Removal | Uninstall `papaparse` from package.json (0 callers after CSV removal) | M1 | Survey (Explorer 1) |
| 5 | Unused CSS Keyframes Cleanup | Delete `@keyframes cursorBlink` and `@keyframes modalScale` in `src/index.css` | M1 | Survey (Explorer 1) |
| 6 | Markdown Parsing Deduplication | Centralize markdown parsing via `src/services/markdownFormatter.jsx` | M1 | Survey (Explorer 1, 2) |
| 7 | ChatView God Node Decoupling | Extract child components (`ChatMessageList`, `ChatInputBar`, `ChatSessionDrawer`) | M2 | Survey (Explorer 2) |
| 8 | BookReaderView God Node Decoupling | Extract child components (`BookLibraryShelf`, `PdfCanvasViewer`, `ReaderToolbar`) | M2 | Survey (Explorer 2) |
| 9 | SettingsView God Node Decoupling | Extract section components (`LocationSettings`, `PrayerSettings`, `DataBackup`) | M2 | Survey (Explorer 2) |
| 10 | TasbeehView & AudioPlayerView Decoupling | Extract child components into `src/components/tasbeeh/` and `src/components/audio/` | M2 | Survey (Explorer 2) |
| 11 | CountryLocalization Data Extraction | Extract 1,300 lines of static city maps into `cityData.js`, keep Facade | M2 | Survey (Explorer 2) |
| 12 | Storage Service Modularization | Organize storage slices under `src/services/storage/`, keep Facade | M2 | Survey (Explorer 2) |
| 13 | DOM Retentive Mounting Invariant | Enforce all 6 views permanently mounted in DOM via `.view-pane` | M3 | Survey (Explorer 3) |
| 14 | Choreographed Hand-Off & Keyframes | Enforce 280ms typing indicator exit fade & keyframe state machine | M3 | Survey (Explorer 3, AGENTS.md) |
| 15 | Background Transition Curtain Invariant | Enforce 280ms drop, `img.decode()` sensor, and 0.85s dissolve lift | M3 | Survey (Explorer 3, AGENTS.md) |
| 16 | GeminiApi Ineffective Import Resolution | Align static vs dynamic imports of `geminiApi.js` to enable clean chunking | M3 | Survey (Explorer 1, 3) |
| 17 | Local-First & Anti-Spam Invariants | Enforce IndexedDB for binaries, localStorage for metadata, tap throttles | M3 | Survey (Explorer 3) |
| 18 | Full Build, Lint & Runtime Validation | Run `npm run build`, `npm run lint`, verify local server on port 5173 | M4 | ORIGINAL_REQUEST |
| 19 | Challenger & Forensic Audit Verification | Empirical testing, regression suite (62/62), authentic implementation audit | M4 | ORIGINAL_REQUEST, AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Dead Code & Orphaned Symbol Elimination (R1) | Delete dead files/assets, remove 10 dead exported functions, uninstall papaparse, remove unused CSS keyframes, deduplicate markdown logic | none | DONE (8 files deleted, ~1.35 MB reclaimed, 12 dead funcs removed, papaparse uninstalled, 126/126 tests pass) |
| 2 | God Node Decoupling & Modular Architecture (R2) | Decouple ChatView, BookReaderView, SettingsView, TasbeehView, AudioPlayerView; extract cityData.js and modular storage slices via Facades | M1 | DONE (29 modular components extracted across 7 domain directories, 2 sovereign facades, 0 lint warnings/errors, 182/182 tests pass) |
| 3 | Invariant Preservation & AGENTS.md Hardening (R3) | Enforce DOM retentive mounting, 280ms handoff timing, background curtain, import chunking, local-first storage rules | M2 | IN_PROGRESS |
| 4 | Final Verification, Build, Local Server & Forensic Audit | `npm run build`, `npm run lint`, runtime validation on port 5173, full 62/62 regression pass, Challenger empirical test, Forensic Auditor gate | M1, M2, M3 | PLANNED |

## Interface Contracts
### `src/services/markdownFormatter.jsx` ↔ `ChatView.jsx` & `MuneerToastNotification.jsx`
- `parseInlineMarkdownStatic(text)`: Pure function returning React nodes for bold, italic, code, quotes, lists, headings.
- Must be the single source of truth for inline markdown across the application.

### `src/services/countryLocalization.js` (Facade) ↔ Consumers
- Must re-export `COUNTRIES`, `CITY_COORDINATES`, `resolveTimezoneForLocation`, etc. from `src/services/localization/cityData.js` and algorithm helpers.
- Consumers continue importing from `src/services/countryLocalization.js` with zero signature changes.

### `src/services/storage.js` (Facade) ↔ Consumers
- Must re-export `getSettings`, `saveSettings`, `getHistory`, `saveHistory`, `computeSummaryStats`, `exportAllUserData`, `importAllUserData` from modular slices.
- Eliminates CSV dead functions (`exportToCSV`, `importFromCSV`) while maintaining 100% compatibility with JSON backup/restore.

### DOM View Mounting Invariant (`src/App.jsx` ↔ `src/index.css`)
- All 6 view panes (`PrayerTrackerView`, `ChatView`, `BookReaderView`, `TasbeehView`, `AudioPlayerView`, `SettingsView`) MUST remain permanently rendered in DOM:
  `<div className={`view-pane ${activeTab === 'key' ? 'active' : 'hidden'}`}>`
- CSS rules: `.view-pane.active { display: flex !important; }` and `.view-pane.hidden { display: none !important; }`.
- Under NO circumstances may these be converted to conditional unmounting (`{activeTab === 'key' && ...}`).

## Code Layout
- `src/components/`:
  - `chat/`: Sub-components extracted from `ChatView.jsx`
  - `book/`: Sub-components extracted from `BookReaderView.jsx`
  - `settings/`: Section components extracted from `SettingsView.jsx`
  - `tasbeeh/`: Sub-components extracted from `TasbeehView.jsx`
  - `audio/`: Sub-components extracted from `AudioPlayerView.jsx`
  - `prayer/`: Sub-components for prayer hero, countdown, table
- `src/services/`: Pure business logic, calculation engines, storage facades.
  - `localization/`: Static city data tables decoupled from localization algorithms.
  - `storage/`: Granular domain storage slices.
- `src/index.css`: Global styles, CSS variables, and `@keyframes` animations.
- `.agents/`: Agent coordination metadata ONLY.
