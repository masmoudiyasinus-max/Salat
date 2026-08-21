# Project: Habit Tracker Full-Codebase Audit & Hardening

## Architecture
The Habit Tracker is a local-first, privacy-respecting React 19 single-page application consisting of:
- **Core Time & Calculation Engine**: `adhanCalculator.js`, `aladhanApiService.js`, `countryLocalization.js`, `storage.js`.
- **Prayer Views & Timers**: `PrayerTrackerView.jsx`, `ActivePrayerHero.jsx`, `LiveClock.jsx`, `LiveCountdown.jsx`, `LiveProgressBar.jsx`, `ScheduleTableModal.jsx`.
- **Sheikh Muneer AI Chat**: `ChatView.jsx`, `geminiApi.js` (local storage chat history, prompt assembly, streaming, Speech Synthesis).
- **Book Reader**: `BookReaderView.jsx`, `bookStorage.js` (pdfjs-dist rendering, shelf, bookmarking, zoom/rotation).
- **Settings, Analytics & Shell**: `SettingsView.jsx`, `DashboardView.jsx`, `App.jsx`, `Header.jsx`, `index.css`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Aladhan Calculation Method Map | Support numeric string IDs and standard method resolution | M1 | Survey (Explorer 1) [DONE] |
| 2 | City/Country Cache Validation | Isolate source schedule cache by city and country | M1 | Survey (Explorer 1) [DONE] |
| 3 | Streak Continuity Logic | Validate 1-day calendar continuity for on-time habit streaks | M1 | Survey (Explorer 1, 3) [DONE] |
| 4 | Core Services Cleanup | Remove dead imports, unused functions, fix DST calculation | M1 | Survey (Explorer 1, 2) [DONE] |
| 5 | Midnight-to-Fajr Countdown Fix | Correct day offset calculation in early morning pre-Fajr hours | M2 | Survey (Explorer 1) [DONE] |
| 6 | Schedule Modal Timezone Sync | Use effective location timezone for today's ISO and prayer rows | M2 | Survey (Explorer 1) [DONE] |
| 7 | Prayer Tracker Dead Code Elimination | Remove unused handlers (handleMarkMissed, handleStatusChange, etc.) | M2 | Survey (Explorer 1) [DONE] |
| 8 | ChatView Reference & State Fixes | Fix saveChatSessions import, setInputPrompt references, file attachment state | M3 | Survey (Explorer 2) |
| 9 | ChatView Session Deletion Fix | Fix deleteSession return object handling | M3 | Survey (Explorer 2) |
| 10 | Sheikh Muneer Speech Synthesis | Provide native TTS voice playback controls for assistant responses | M3 | Survey (Explorer 2, ORIGINAL_REQUEST) |
| 11 | BookReader PDF Loader & State Fix | Restore loadPdf / setPdfDoc state setters, clean dead icon imports | M3 | Survey (Explorer 2) |
| 12 | SettingsView Timezone Import Fix | Import resolveTimezoneForLocation in SettingsView | M4 | Survey (Explorer 3) |
| 13 | SettingsView Event Listener Cleanup | Remove duplicate SETTINGS_UPDATED event listeners | M4 | Survey (Explorer 3) |
| 14 | CSS @keyframes Definitions | Add fadeIn and slideUp keyframes in src/index.css | M4 | Survey (Explorer 3, AGENTS.md) |
| 15 | Dashboard Timeframe Alignment | Align 3-month filter and local timezone date boundaries | M4 | Survey (Explorer 3) |
| 16 | App & Header Dead Code Cleanup | Remove unused state variables and unused imports | M4 | Survey (Explorer 3) |
| 17 | Final Build & Oxlint Verification | Achieve 0 errors in npm run build and npx oxlint src | M5 | ORIGINAL_REQUEST |
| 18 | QA & Forensic Audit Gate | Rigorous regression review and authentic implementation verification | M5 | ORIGINAL_REQUEST, AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Core Services & Time Engine | `src/services/adhanCalculator.js`, `aladhanApiService.js`, `storage.js`, `bookStorage.js`, `permissionService.js` | none | DONE |
| 2 | Prayer Tracker & Live Time Views | `src/components/PrayerTrackerView.jsx`, `ActivePrayerHero.jsx`, `LiveClock.jsx`, `LiveCountdown.jsx`, `LiveProgressBar.jsx`, `ScheduleTableModal.jsx` | M1 | DONE |
| 3 | Sheikh Muneer AI Chat & Book Reader | `src/components/ChatView.jsx`, `BookReaderView.jsx`, `geminiApi.js` | M1 | DONE |
| 4 | Settings, Dashboard, App & Keyframes | `src/components/SettingsView.jsx`, `DashboardView.jsx`, `App.jsx`, `Header.jsx`, `src/index.css` | M1 | IN_PROGRESS |
| 5 | Full Build, Oxlint & QA Verification | Full repository audit, build test, oxlint, challenger and forensic verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### `src/services/adhanCalculator.js` ↔ `src/components/PrayerTrackerView.jsx` & `SettingsView.jsx`
- `getPrayerTimes(date, coords, method, options)` returns prayer times object `{ Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, ... }`.
- `ALADHAN_METHOD_MAP` must resolve numeric strings (e.g. `'4'`, `'5'`, `'9'`, `'13'`) as well as integers and names.
- `getSourceScheduleCache` must key on `${city}_${country}_${year}_${month}_${method}`.

### `src/services/storage.js` ↔ `PrayerTrackerView.jsx` & `DashboardView.jsx`
- `computeSummaryStats(history)` returns `{ currentStreak, bestStreak, totalCompleted, ... }`. Streak requires `diffInDays === 1`.
- `deleteSession(sessionId)` returns `{ activeId: string, sessions: Session[] }`.

### `src/services/countryLocalization.js` ↔ `SettingsView.jsx`
- `resolveTimezoneForLocation(city, country)` must be exported and imported correctly by `SettingsView.jsx`.

## Code Layout
- `src/components/`: React UI components.
- `src/services/`: Pure business logic, calculations, local storage abstractions, external API helpers.
- `src/index.css`: Global styles, CSS variables, and `@keyframes` animations.
- `.agents/`: Agent coordination metadata ONLY.
