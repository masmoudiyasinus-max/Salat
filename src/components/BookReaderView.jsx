import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BookOpen,
  Upload,
  Bookmark,
  Flame,
  AlertTriangle,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Sparkles,
  BookMarked,
  X,
  FileText,
  Settings as SettingsIcon,
  Sun,
  Moon,
} from 'lucide-react';
import {
  saveBookToDB,
  getBookFromDB,
  getAllBooksMetadata,
  deleteBookFromDB,
  getActiveBookId,
  setActiveBookId,
  getReadingHabitState,
  saveReadingHabitState,
  getTodayDateString,
  getDailyTargetForLevel,
  getPastCompletedDays,
  recordReadingProgress,
  setCustomDailyTarget,
  getCumulativeWardCeiling,
} from '../services/bookStorage';
import { logError } from '../services/errorLogger';
import { recordBookFlipAndCheck, dispatchMuneerSignal, MUNEER_SIGNALS } from '../services/muneerSignalService';

function getArabicOrdinalDay(dayNumber) {
  const ordinals = [
    '',
    'الأول',
    'الثاني',
    'الثالث',
    'الرابع',
    'الخامس',
    'السادس',
    'السابع',
    'الثامن',
    'التاسع',
    'العاشر',
    'الحادي عشر',
    'الثاني عشر',
    'الثالث عشر',
    'الرابع عشر',
    'الخامس عشر',
    'السادس عشر',
    'السابع عشر',
    'الثامن عشر',
    'التاسع عشر',
    'العشرون',
    'الحادي والعشرون',
    'الثاني والعشرون',
    'الثالث والعشرون',
    'الرابع والعشرون',
    'الخامس والعشرون',
    'السادس والعشرون',
    'السابع والعشرون',
    'الثامن والعشرون',
    'التاسع والعشرون',
    'الثلاثون',
  ];
  return ordinals[dayNumber] || `رقم ${dayNumber}`;
}

// Configure PDF.js standard worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function BookReaderView({
  settings = {},
  onStartReading = () => {},
  onExitReading = () => {},
  isReaderActive = false,
  setIsReaderActive = () => {},
}) {
  const isEn = settings?.language === 'en';

  // State
  const [habitState, setHabitState] = useState(getReadingHabitState());
  const [booksList, setBooksList] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isHoverLocked, setIsHoverLocked] = useState(false);
  const [showUnlockTrigger, setShowUnlockTrigger] = useState(false);
  const [isMouseOverDock, setIsMouseOverDock] = useState(false);
  const [readingTheme, setReadingTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('habit_tracker_reading_theme');
      return saved === 'dark' ? 'dark' : 'default';
    } catch {
      return 'default';
    }
  });
  const [ambientBrightnessScale, setAmbientBrightnessScale] = useState(1.0);

  const handleCycleTheme = useCallback(() => {
    setReadingTheme((prev) => {
      const next = prev === 'dark' ? 'default' : 'dark';
      try {
        localStorage.setItem('habit_tracker_reading_theme', next);
      } catch {}
      return next;
    });
  }, []);

  // References
  const fileInputRef = useRef(null);
  const readerRootRef = useRef(null);
  const ambientCanvasRef = useRef(null); // Ambient Canvas for YouTube-style real-time page color glow
  const rightPageCanvasRef = useRef(null); // Physical Right -> Odd Page (1, 3, 5...)
  const leftPageCanvasRef = useRef(null);  // Physical Left -> Even Page (2, 4, 6...)
  const readerContainerRef = useRef(null);
  const pageCacheRef = useRef(new Map());
  const prefetchQueueRef = useRef(new Set());
  const hideControlsTimeoutRef = useRef(null);
  const isMouseOverDockRef = useRef(false);

  const handleMouseMove = useCallback((e) => {
    if (isHoverLocked) {
      if (e && e.clientY >= window.innerHeight - 60) {
        setShowUnlockTrigger(true);
      } else {
        setShowUnlockTrigger(false);
      }
      return;
    }
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    // Strictly forbid hiding if mouse is currently hovering over the dock
    if (!isMouseOverDockRef.current) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverDockRef.current) {
          setShowControls(false);
        }
      }, 2800);
    }
  }, [isHoverLocked]);

  const handleMouseLeave = useCallback(() => {
    if (isMouseOverDockRef.current) return;
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    setShowControls(false);
    setShowUnlockTrigger(false);
  }, []);

  const today = getTodayDateString();
  const currentDailyTarget = getDailyTargetForLevel(
    habitState.activeLevel,
    habitState.isCustomUnlocked,
    habitState.customDailyTarget
  );
  const todayLog = habitState.dailyLogs?.[today] || {
    pagesRead: 0,
    target: currentDailyTarget,
    completed: false,
  };

  // Dynamic Eye-Care Theme Variables (Warm Amber Night Tint)
  const themeBackdropStyle =
    readingTheme === 'dark'
      ? 'radial-gradient(circle at 50% 50%, #1a1814 0%, #0f0e0c 70%, #080706 100%)'
      : 'radial-gradient(circle at 50% 50%, #1f2024 0%, #121316 70%, #0a0a0b 100%)';

  const canvasFilter =
    readingTheme === 'dark'
      ? 'invert(0.88) hue-rotate(180deg) sepia(0.25) contrast(0.92) brightness(0.88)'
      : 'none';

  const canvasBgColor = readingTheme === 'dark' ? '#1c1a17' : '#ffffff';

  // Today's exact cumulative ward ceiling (e.g. Page 10 for Day 1, Page 20 for Day 2, Page 30 for Day 3)
  const maxWardPage = Math.min(totalPages || 999999, getCumulativeWardCeiling(habitState, today));
  // The maximum spread start page (e.g. 9 for spread [9, 10] of Day 1's 10-page ward, 19 for Day 2's [19, 20])
  const maxAllowedSpreadStart = (maxWardPage % 2 === 1) ? maxWardPage : maxWardPage - 1;

  const pastDaysCount = getPastCompletedDays(habitState, today);
  const currentDayNumber = pastDaysCount + 1;
  const wardDayTitle = isEn
    ? `Day ${currentDayNumber} Ward`
    : `ورد اليوم ${getArabicOrdinalDay(currentDayNumber)}`;

  const curSpreadStart = (currentPage % 2 === 1) ? currentPage : Math.max(1, currentPage - 1);

  // Can the user turn next? Strictly forbidden if current spread is already at maxAllowedSpreadStart (e.g. 9 for Day 1 [9, 10])
  const canTurnNext = curSpreadStart < maxAllowedSpreadStart && currentPage < totalPages;



  // 1. Offscreen High-DPI Page Renderer with contain fit
  const renderPageToOffscreen = useCallback(async (doc, pageNum, maxW, maxH) => {
    if (!doc || pageNum < 1 || pageNum > doc.numPages) return null;
    try {
      const page = await doc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1.0 });

      // Calculate contain scale so page fits precisely within allowed dimensions
      const availW = Math.max(120, maxW);
      const availH = Math.max(120, maxH);

      const scaleX = availW / baseViewport.width;
      const scaleY = availH / baseViewport.height;
      const fitScale = Math.min(scaleX, scaleY);

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: fitScale });

      const offscreen = document.createElement('canvas');
      offscreen.width = Math.floor(viewport.width * dpr);
      offscreen.height = Math.floor(viewport.height * dpr);

      const ctx = offscreen.getContext('2d', { alpha: false });
      if (!ctx) return null;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      };

      const task = page.render(renderContext);
      await task.promise;

      return {
        canvas: offscreen,
        viewportWidth: Math.floor(viewport.width),
        viewportHeight: Math.floor(viewport.height),
        fitScale,
        maxW,
        maxH,
        dpr,
      };
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error rendering page offscreen:', err);
      }
      return null;
    }
  }, []);

  // 2. Prefetch Surrounding Pages in Background
  const prefetchSurroundingPages = useCallback((doc, pageNum, maxW, maxH) => {
    if (!doc || !activeBook) return;
    const pagesToPrefetch = [
      pageNum + 1,
      pageNum + 2,
      pageNum + 3,
      pageNum - 1,
      pageNum - 2,
      pageNum + 4,
      pageNum + 5,
    ].filter((p) => p >= 1 && p <= Math.min(doc.numPages, maxWardPage));

    pagesToPrefetch.forEach((p) => {
      const key = `${activeBook.id}_p${p}_${maxW}x${maxH}`;
      if (!pageCacheRef.current.has(key) && !prefetchQueueRef.current.has(key)) {
        prefetchQueueRef.current.add(key);
        renderPageToOffscreen(doc, p, maxW, maxH)
          .then((rendered) => {
            if (rendered) {
              pageCacheRef.current.set(key, rendered);
              if (pageCacheRef.current.size > 24) {
                const oldestKey = pageCacheRef.current.keys().next().value;
                if (oldestKey) pageCacheRef.current.delete(oldestKey);
              }
            }
          })
          .catch(() => {})
          .finally(() => {
            prefetchQueueRef.current.delete(key);
          });
      }
    });
  }, [activeBook, renderPageToOffscreen, maxWardPage]);

  // Helper to draw rendered page onto target canvas
  const drawPageOntoCanvas = useCallback((targetCanvas, rendered) => {
    if (!targetCanvas || !rendered) return;
    targetCanvas.width = rendered.canvas.width;
    targetCanvas.height = rendered.canvas.height;
    targetCanvas.style.display = 'block';
    const ctx = targetCanvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.drawImage(rendered.canvas, 0, 0);
    }
  }, []);

  // Helper to update ambient canvas with dynamic sampled pixels from page
  const updateAmbientCanvas = useCallback(() => {
    const ambCanvas = ambientCanvasRef.current;
    if (!ambCanvas) return;
    const ambW = 32;
    const ambH = 20;
    if (ambCanvas.width !== ambW || ambCanvas.height !== ambH) {
      ambCanvas.width = ambW;
      ambCanvas.height = ambH;
    }
    const ctx = ambCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, ambW, ambH);

    // Apply active filter (e.g. invert for night mode) directly to 2D canvas context
    ctx.filter = canvasFilter;

    const rightEl = rightPageCanvasRef.current;
    const leftEl = leftPageCanvasRef.current;
    const hasRight = rightEl && rightEl.style.display !== 'none' && rightEl.width > 0;
    const hasLeft = leftEl && leftEl.style.display !== 'none' && leftEl.width > 0;

    if (hasRight && hasLeft) {
      // In RTL dual-page spread: Left Canvas on physical Left, Right Canvas on physical Right
      ctx.drawImage(leftEl, 0, 0, ambW / 2, ambH);
      ctx.drawImage(rightEl, ambW / 2, 0, ambW / 2, ambH);
    } else if (hasRight) {
      ctx.drawImage(rightEl, 0, 0, ambW, ambH);
    } else if (hasLeft) {
      ctx.drawImage(leftEl, 0, 0, ambW, ambH);
    }

    // Dynamic Auto-Exposure Luminance Clamping:
    // Reduced minimum floor for dark pages, and reduced maximum ceiling for bright pages
    try {
      const imgData = ctx.getImageData(0, 0, ambW, ambH);
      const data = imgData.data;
      let totalLuma = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLuma = totalLuma / (ambW * ambH); // range 0..255

      // Softened bounds: Minimum floor ~ 1.35x for dark/night mode, and maximum ceiling ~ 0.52x for bright paper
      const dynamicScale = Math.min(1.35, Math.max(0.52, 105 / (avgLuma + 45)));
      setAmbientBrightnessScale(Number(dynamicScale.toFixed(2)));
    } catch {
      setAmbientBrightnessScale(1.0);
    }
  }, [canvasFilter]);

  // Synchronize ambient canvas dynamically whenever readingTheme / canvasFilter changes
  useEffect(() => {
    updateAmbientCanvas();
  }, [updateAmbientCanvas, readingTheme]);

  // 3. Display Dual / Single Page Spread with Instant 0ms Cache Swap & Double Buffering
  const displayPage = useCallback(async (pageNum) => {
    if (!pdfDoc || !readerContainerRef.current || !activeBook) return;

    const container = readerContainerRef.current;
    const cW = Math.floor(container.clientWidth || container.getBoundingClientRect().width);
    const cH = Math.floor(container.clientHeight || container.getBoundingClientRect().height);
    if (cW <= 0 || cH <= 0) return;

    // Dimensions per page (Mandatory Two-Page Full-Width Split)
    const maxW = Math.floor(cW / 2);
    const maxH = cH;

    // In Arabic RTL Books:
    // Right Page (Odd: 1, 3, 5...) is ALWAYS on the physical RIGHT
    // Left Page (Even: 2, 4, 6...) is ALWAYS on the physical LEFT
    const clampedPage = Math.min(pageNum, maxAllowedSpreadStart);
    const spreadStart = clampedPage % 2 === 1 ? clampedPage : Math.max(1, clampedPage - 1);
    const rightPageNum = spreadStart <= maxWardPage ? spreadStart : null;
    const leftPageNum = spreadStart + 1 <= Math.min(pdfDoc.numPages, maxWardPage) ? spreadStart + 1 : null;

    const renderOrGetCached = async (pNum) => {
      if (!pNum) return null;
      const key = `${activeBook.id}_p${pNum}_${maxW}x${maxH}`;
      if (pageCacheRef.current.has(key)) {
        return pageCacheRef.current.get(key);
      }
      const rendered = await renderPageToOffscreen(pdfDoc, pNum, maxW, maxH);
      if (rendered) {
        pageCacheRef.current.set(key, rendered);
      }
      return rendered;
    };

    try {
      const [renderedRight, renderedLeft] = await Promise.all([
        renderOrGetCached(rightPageNum),
        renderOrGetCached(leftPageNum),
      ]);

      // Physical RIGHT: Odd Page (1, 3, 5...)
      if (rightPageCanvasRef.current) {
        if (renderedRight) {
          drawPageOntoCanvas(rightPageCanvasRef.current, renderedRight);
        } else {
          rightPageCanvasRef.current.style.display = 'none';
        }
      }

      // Physical LEFT: Even Page (2, 4, 6...)
      if (leftPageCanvasRef.current) {
        if (renderedLeft) {
          drawPageOntoCanvas(leftPageCanvasRef.current, renderedLeft);
        } else {
          leftPageCanvasRef.current.style.display = 'none';
        }
      }

      // 3. Update Ambient Light Canvas (YouTube-style Real-time Color Glow, Zero Lag)
      updateAmbientCanvas();
    } catch (err) {
      console.error('Failed to display page spread:', err);
    } finally {
      prefetchSurroundingPages(pdfDoc, spreadStart, maxW, maxH);
    }
  }, [pdfDoc, activeBook, renderPageToOffscreen, drawPageOntoCanvas, updateAmbientCanvas, prefetchSurroundingPages, maxWardPage, maxAllowedSpreadStart]);

  // 4. Load PDF from buffer using PDF.js
  const loadPdfFromBuffer = useCallback(
    async (bufferData, bookId) => {
      if (!bufferData) {
        setPdfDoc(null);
        return;
      }
      try {
        setIsLoadingPdf(true);
        let uint8Array;
        if (bufferData instanceof Uint8Array) {
          uint8Array = bufferData;
        } else if (bufferData instanceof ArrayBuffer) {
          uint8Array = new Uint8Array(bufferData);
        } else if (bufferData instanceof Blob) {
          const ab = await bufferData.arrayBuffer();
          uint8Array = new Uint8Array(ab);
        } else {
          uint8Array = new Uint8Array(bufferData);
        }

        const version = pdfjsLib.version || '4.10.38';
        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        pageCacheRef.current.clear();
        prefetchQueueRef.current.clear();

        // Restore saved bookmark if available (clamped to today's max allowed ward page)
        const currentHabit = getReadingHabitState();
        const savedBookmark = currentHabit.bookmarks?.[bookId];
        const todayStr = getTodayDateString();
        const maxWardCeiling = Math.min(doc.numPages, getCumulativeWardCeiling(currentHabit, todayStr));
        const maxSprStart = (maxWardCeiling % 2 === 1) ? maxWardCeiling : maxWardCeiling - 1;

        const targetPage = savedBookmark?.lastPage && savedBookmark.lastPage <= doc.numPages
          ? Math.min(savedBookmark.lastPage, maxSprStart)
          : 1;
        const normalizedSpread = (targetPage % 2 === 1) ? targetPage : Math.max(1, targetPage - 1);

        setCurrentPage(normalizedSpread);
      } catch (err) {
        console.error('Failed to load PDF from buffer:', err);
        logError(err, 'BookReader.LoadPdfFromBuffer');
        setPdfDoc(null);
        alert(
          isEn
            ? 'Failed to parse book data. The file might be corrupted.'
            : 'تعذر قراءة بيانات الكتاب، قد يكون الملف تالفاً.'
        );
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [isEn]
  );

  // 5. Load books list and active book on mount
  const loadBooksAndActive = useCallback(async () => {
    try {
      const list = await getAllBooksMetadata();
      setBooksList(list);

      const activeId = getActiveBookId() || (list.length > 0 ? list[0].id : null);
      if (activeId) {
        setActiveBookId(activeId);
        const bookData = await getBookFromDB(activeId);
        if (bookData && bookData.data) {
          setActiveBook(bookData);
          if (bookData.totalPages) setTotalPages(bookData.totalPages);
          loadPdfFromBuffer(bookData.data, activeId);
        }
      }
    } catch (err) {
      console.error('Error loading books:', err);
      logError(err, 'BookReader.LoadActive');
    }
  }, [loadPdfFromBuffer]);

  useEffect(() => {
    loadBooksAndActive();

    const handleHabitUpdate = (e) => {
      if (e.detail) setHabitState(e.detail);
    };
    window.addEventListener('habit_reading_state_updated', handleHabitUpdate);
    return () => window.removeEventListener('habit_reading_state_updated', handleHabitUpdate);
  }, [loadBooksAndActive]);

  // 6. Handle Native Browser Fullscreen API
  const toggleNativeFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const targetElem = readerRootRef.current || document.documentElement;
        if (targetElem.requestFullscreen) {
          await targetElem.requestFullscreen();
        } else if (targetElem.webkitRequestFullscreen) {
          await targetElem.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Native Fullscreen toggle notice:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFs);
      setTimeout(() => {
        if (currentPage) displayPage(currentPage);
      }, 80);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [currentPage, displayPage]);

  // 7. Page turning logic with instantaneous swap (Mandatory Dual Spread & Strict Daily Ward Boundary)
  const handleNextPage = useCallback(() => {
    recordBookFlipAndCheck();
    const curSpread = (currentPage % 2 === 1) ? currentPage : Math.max(1, currentPage - 1);
    if (curSpread >= maxAllowedSpreadStart || currentPage >= totalPages) {
      return; // Strictly forbidden to advance beyond the last page of the daily ward
    }

    const nextSpread = curSpread + 2;
    if (nextSpread > maxAllowedSpreadStart) {
      return;
    }

    setCurrentPage(nextSpread);
    displayPage(nextSpread);

    // Record daily habit progress
    if (activeBook) {
      const updated = recordReadingProgress(activeBook.id, nextSpread, totalPages, 2);
      setHabitState(updated);

      const todayStr = getTodayDateString();
      if (updated?.dailyLogs?.[todayStr]?.isTargetMet) {
        dispatchMuneerSignal(MUNEER_SIGNALS.DAILY_WARD_COMPLETED, { pagesCount: currentDailyTarget });
      }
    }
  }, [currentPage, totalPages, activeBook, displayPage, maxAllowedSpreadStart, currentDailyTarget]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      recordBookFlipAndCheck();
      const spreadStart = (currentPage % 2 === 1) ? currentPage : Math.max(1, currentPage - 1);
      const prevPage = Math.max(1, spreadStart - 2);

      setCurrentPage(prevPage);
      displayPage(prevPage);

      // Save bookmark without incrementing pages count
      if (activeBook) {
        const state = getReadingHabitState();
        state.bookmarks[activeBook.id] = {
          lastPage: prevPage,
          totalPages: totalPages,
          timestamp: Date.now(),
        };
        saveReadingHabitState(state);
        setHabitState({ ...state });
      }
    }
  }, [currentPage, totalPages, activeBook, displayPage]);

  // 8. Start & Close Reading Mode
  const handleOpenReader = useCallback(() => {
    if (!activeBook) return;
    setIsReaderActive(true);
    onStartReading();
  }, [activeBook, setIsReaderActive, onStartReading]);

  const handleCloseReader = useCallback(async () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen notice:', err);
      }
    }
    setIsReaderActive(false);
    onExitReading();
  }, [setIsReaderActive, onExitReading]);

  // 9. Handle Keyboard Navigation inside reading mode
  useEffect(() => {
    if (!isReaderActive) return;

    const handleKeyDown = (e) => {
      const target = e.target;
      const targetTag = target && target.tagName ? target.tagName.toLowerCase() : '';
      if (
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        targetTag === 'select' ||
        (target && target.isContentEditable) ||
        (target && typeof target.closest === 'function' && target.closest('[contenteditable="true"]'))
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (isEn) {
          if (canTurnNext) handleNextPage();
        } else {
          handlePrevPage();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (isEn) {
          handlePrevPage();
        } else {
          if (canTurnNext) handleNextPage();
        }
      } else if (e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handlePrevPage();
        } else if (canTurnNext) {
          handleNextPage();
        }
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        handlePrevPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        setCurrentPage(1);
        displayPage(1);
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleNativeFullscreen();
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        handleCycleTheme();
      } else if (e.key === 'Escape') {
        if (isHoverLocked) {
          e.preventDefault();
          e.stopPropagation();
          setIsHoverLocked(false);
          setShowControls(true);
          return;
        }
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          e.preventDefault();
          e.stopPropagation();
          handleCloseReader();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isReaderActive, isEn, totalPages, canTurnNext, isHoverLocked, handleNextPage, handlePrevPage, handleCloseReader, handleCycleTheme, displayPage]);

  // 10. Handle ResizeObserver with threshold to eliminate expansion feedback loops
  useEffect(() => {
    if (!isReaderActive || !readerRootRef.current) return;

    let lastW = 0;
    let lastH = 0;
    let resizeTimer = null;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) {
          if (Math.abs(width - lastW) > 8 || Math.abs(height - lastH) > 8) {
            lastW = width;
            lastH = height;
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              displayPage(currentPage);
            }, 100);
          }
        }
      }
    });

    resizeObserver.observe(readerRootRef.current);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [isReaderActive, currentPage, displayPage]);

  // Initial draw and strict ward boundary enforcement when reader opens or state changes
  useEffect(() => {
    if (isReaderActive && pdfDoc && currentPage) {
      if (currentPage > maxAllowedSpreadStart) {
        setCurrentPage(maxAllowedSpreadStart);
        displayPage(maxAllowedSpreadStart);
      } else {
        displayPage(currentPage);
      }
    }
  }, [isReaderActive, pdfDoc, currentPage, maxAllowedSpreadStart, displayPage]);

  // 7. Handle File Processing (Shared for File Picker & Drag-and-Drop)
  const processUploadedPdfFile = async (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert(isEn ? 'Please upload a valid PDF book' : 'يرجى اختيار كتاب بصيغة PDF صالحة');
      return;
    }

    try {
      setIsLoadingPdf(true);
      const arrayBuffer = await file.arrayBuffer();
      const bookId = 'book_' + Date.now();

      // 1. Create a safe clone for IndexedDB storage before any worker touches it
      const bufferForDB = arrayBuffer.slice(0);

      // 2. Create a safe copy for PDF.js document parsing
      const bufferForPdf = new Uint8Array(arrayBuffer.slice(0));

      const version = pdfjsLib.version || '4.10.38';
      const tempTask = pdfjsLib.getDocument({
        data: bufferForPdf,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
      });
      const tempPdf = await tempTask.promise;
      const numPages = tempPdf.numPages;

      // 3. Save the clean intact buffer into IndexedDB
      const savedRecord = await saveBookToDB(
        bookId,
        file.name.replace(/\.pdf$/i, ''),
        (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        bufferForDB,
        numPages
      );

      setActiveBookId(bookId);
      setActiveBook(savedRecord);
      setPdfDoc(tempPdf);
      setTotalPages(numPages);
      setCurrentPage(1);

      // Refresh list
      const list = await getAllBooksMetadata();
      setBooksList(list);

      // Initialize bookmark
      recordReadingProgress(bookId, 1, numPages, 0);
    } catch (err) {
      console.error('Failed to save and parse PDF:', err);
      logError(err, 'BookReader.Upload');
      alert(isEn ? 'Failed to process PDF book: ' + (err.message || 'Unknown error') : 'تعذر تحميل ملف الكتاب: ' + (err.message || 'تأكد من سلامة الملف'));
    } finally {
      setIsLoadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processUploadedPdfFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processUploadedPdfFile(file);
  };

  const handleDeleteBook = async (bookId, e) => {
    e.stopPropagation();
    if (!confirm(isEn ? 'Delete this book from local storage?' : 'هل تريد حذف هذا الكتاب من التخزين المحلي؟')) return;

    await deleteBookFromDB(bookId);
    const list = await getAllBooksMetadata();
    setBooksList(list);

    if (activeBook?.id === bookId) {
      if (list.length > 0) {
        const nextId = list[0].id;
        setActiveBookId(nextId);
        const nextBook = await getBookFromDB(nextId);
        setActiveBook(nextBook);
        if (nextBook) loadPdfFromBuffer(nextBook.data, nextId);
      } else {
        setActiveBookId(null);
        setActiveBook(null);
        setPdfDoc(null);
        setTotalPages(0);
      }
    }
  };

  const handleSelectBook = async (bookId) => {
    setActiveBookId(bookId);
    const bookData = await getBookFromDB(bookId);
    if (bookData) {
      setActiveBook(bookData);
      loadPdfFromBuffer(bookData.data, bookId);
    }
  };

  const handleSaveCustomTarget = () => {
    const target = parseInt(customTargetInput, 10);
    if (target > 0) {
      const updated = setCustomDailyTarget(target);
      setHabitState(updated);
      setShowCustomModal(false);
    }
  };

  return (
    <div
      ref={readerRootRef}
      className={`book-reader-view-wrapper ${isFullscreen || isReaderActive ? 'native-fullscreen-active' : ''}`}
      style={
        isReaderActive || isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999999,
              background: themeBackdropStyle,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              padding: '8px 16px',
              boxSizing: 'border-box',
            }
          : {
              width: '100%',
              maxWidth: '1100px',
              margin: '0 auto',
            }
      }
    >
      {/* 1. Habit Progression Hero & Daily Ward Dashboard */}
      {!isReaderActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '0px' }}>
          {/* Missed Grace Day Warning Banner */}
          {habitState.missedGraceWarning && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#ffffff',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.86rem', fontWeight: '600', lineHeight: 1.5 }}>
                {isEn
                  ? 'You missed yesterday! Read today’s ward to preserve your streak and progress.'
                  : 'لقد انقطعت بالأمس! اقرأ ورد اليوم للحفاظ على سلسلتك ومستواك وتفادي إعادة الضبط.'}
              </span>
            </div>
          )}

          {/* Unified Bento Card: Daily Reading Habit Ward */}
          <div className="bento-card" style={{ padding: '28px' }}>
            {/* Header: Title + Streak & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--status-on-time)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    {isEn ? 'Daily Reading Habit Ward' : 'ورد القراءة اليومي وبناء العادة'}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    {habitState.isCustomUnlocked
                      ? (isEn ? 'Unlocked: Free Goal Customization' : 'تم فتح وتفعيل التحديد اليدوي للورد بحرية')
                      : (isEn
                          ? `Week ${habitState.activeLevel} Goal: ${currentDailyTarget} pages per day`
                          : `هدف الأسبوع ${habitState.activeLevel}: ${currentDailyTarget} صفحة يومياً`)}
                  </p>
                </div>
              </div>

              {/* Streak Badge & Custom Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  className="sub-glass-card"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    color: '#fb923c',
                    fontWeight: '700',
                    fontSize: '0.84rem',
                  }}
                >
                  <Flame size={15} />
                  <span>
                    {habitState.streakDays || 0} {isEn ? 'Days Streak' : 'أيام متتالية'}
                  </span>
                </div>

                {habitState.isCustomUnlocked && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setCustomTargetInput(String(habitState.customDailyTarget || 30));
                      setShowCustomModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <SettingsIcon size={14} />
                    <span>{isEn ? 'Customize Ward' : 'تعديل الورد'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Today's Progress Bar */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {isEn ? "Today's Reading Progress:" : 'إنجاز ورد اليوم:'}
                </span>
                <span style={{ fontWeight: '700', color: todayLog.completed ? '#22c55e' : '#ffffff' }}>
                  {todayLog.pagesRead} / {currentDailyTarget} {isEn ? 'pages' : 'صفحة'}{' '}
                  {todayLog.completed && (isEn ? ' (Completed)' : ' (تم الإنجاز)')}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.10)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-pill)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((todayLog.pagesRead / currentDailyTarget) * 100))}%`,
                    backgroundColor: todayLog.completed ? '#22c55e' : '#ffffff',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. Unified Bento Card: Current Book & Library Shelf */}
          <div className="bento-card" style={{ padding: '28px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--status-on-time)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookMarked size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    {isEn ? 'Current Book & Library' : 'الكتاب الحالي والمكتبة'}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    {isEn
                      ? 'Local-first zero data loss library saved directly in your browser.'
                      : 'مكتبتك المحفوظة محلياً بالكامل في المتصفح مع حفظ تلقائي لصفحة التوقف.'}
                  </p>
                </div>
              </div>

              {/* Upload Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                />
                <button
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    fontSize: '0.86rem',
                  }}
                >
                  <Upload size={15} />
                  <span>{isEn ? 'Upload PDF Book' : 'رفع كتاب من الجهاز'}</span>
                </button>
              </div>
            </div>

            {/* Active Book Showcase Card */}
            {activeBook ? (
              <div
                className="sub-glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '54px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <FileText size={20} />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '2px' }}>PDF</span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                      {activeBook.name}
                    </h4>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.80rem',
                        color: 'var(--text-secondary)',
                        marginTop: '3px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--status-on-time)' }}>
                        <Bookmark size={13} />
                        {isEn ? `Last Read: Page ${currentPage}` : `آخر صفحة قرأتها: ${currentPage}`}
                      </span>
                      <span>•</span>
                      <span>{totalPages} {isEn ? 'pages' : 'صفحة'}</span>
                      <span>•</span>
                      <span>{activeBook.size}</span>
                    </div>
                  </div>
                </div>

                {/* Start Reading Action Button */}
                <button
                  className="btn-primary"
                  onClick={handleOpenReader}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    fontSize: '0.90rem',
                    fontWeight: '700',
                  }}
                >
                  <BookOpen size={16} />
                  <span>
                    {currentPage > 1
                      ? (isEn ? `Continue (Page ${currentPage})` : `متابعة القراءة (صفحة ${currentPage})`)
                      : (isEn ? 'Start Reading' : 'بدء القراءة')}
                  </span>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="sub-glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '36px 20px',
                  borderRadius: '12px',
                  border: isDraggingOver
                    ? '2px dashed var(--status-on-time) !important'
                    : '2px dashed rgba(255, 255, 255, 0.25) !important',
                  backgroundColor: isDraggingOver
                    ? 'rgba(255, 255, 255, 0.12) !important'
                    : 'rgba(18, 18, 18, 0.65) !important',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: isDraggingOver ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                }}
              >
                <Upload
                  size={36}
                  style={{
                    color: isDraggingOver ? 'var(--status-on-time)' : 'var(--text-secondary)',
                    marginBottom: '12px',
                    transition: 'color 0.2s ease, transform 0.2s ease',
                    transform: isDraggingOver ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', textAlign: 'center' }}>
                  {isDraggingOver
                    ? (isEn ? 'Drop PDF book here' : 'أسقط ملف الكتاب هنا فورياً')
                    : (isEn ? 'Drag & drop your PDF book here' : 'قم بسحب وإسقاط ملف الكتاب هنا')}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {isEn
                    ? 'Or click here to select a book from your device (saved locally)'
                    : 'أو انقر هنا لاستعراض واختيار الكتاب من جهازك (يُحفظ محلياً)'}
                </span>
              </div>
            )}

            {/* Multiple Books Shelf (if more than 1 uploaded) */}
            {booksList.length > 1 && (
              <div style={{ marginTop: '18px' }}>
                <h5 style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {isEn ? 'Other Saved Books:' : 'كتب أخرى محفوظة في مكتبتك:'}
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {booksList.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBook(b.id)}
                      className="sub-glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeBook?.id === b.id ? 'rgba(255, 255, 255, 0.12) !important' : 'rgba(18, 18, 18, 0.75) !important',
                        border: activeBook?.id === b.id ? '1px solid rgba(255, 255, 255, 0.35) !important' : '1px solid rgba(255, 255, 255, 0.14) !important',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '140px',
                        }}
                      >
                        {b.name}
                      </span>
                      <button
                        onClick={(e) => handleDeleteBook(b.id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        title={isEn ? 'Delete' : 'حذف'}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Interactive Fullscreen Active Reading Mode (Comfortable Eye-Care Two-Page Spread Reader) */}
      {typeof document !== 'undefined' && isReaderActive && ReactDOM.createPortal(
        <div
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            background: themeBackdropStyle,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.4s ease',
          }}
        >


          {/* Double-Buffered High-DPI Dual-Canvas PDF Stage (Full Bleed Viewport) */}
          <div
            ref={readerContainerRef}
            style={{
              position: 'relative',
              width: '100vw',
              height: '100vh',
              overflow: 'hidden',
              background: themeBackdropStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              transition: 'background 0.4s ease',
            }}
          >


            {/* Seamless Click-to-Turn Navigation Overlays (Left & Right Zones) */}
            {/* Left Zone: In RTL books, clicking left advances to Next Page */}
            <div
              onClick={canTurnNext ? handleNextPage : undefined}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '18%',
                height: '100%',
                cursor: canTurnNext ? 'pointer' : 'default',
                zIndex: 6,
              }}
              title={
                !canTurnNext && todayLog.completed
                  ? (isEn ? 'Daily reading ward limit reached' : 'تم الوصول لحد الورد اليومي بنجاح')
                  : (isEn ? 'Next Page' : 'الصفحة التالية')
              }
            />
            {/* Right Zone: In RTL books, clicking right goes to Previous Page */}
            <div
              onClick={handlePrevPage}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '18%',
                height: '100%',
                cursor: 'pointer',
                zIndex: 6,
              }}
              title={isEn ? 'Previous Page' : 'الصفحة السابقة'}
            />

            {/* Side-by-Side Dual Canvas Spread Layout */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'row',
                direction: 'rtl',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                width: 'auto',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                padding: 0,
                boxSizing: 'border-box',
                zIndex: 3,
              }}
            >
              {/* Ambient Canvas (YouTube Ambient Mode: Dynamically anchored to the spread in windowed and fullscreen modes) */}
              <canvas
                ref={ambientCanvasRef}
                style={{
                  position: 'absolute',
                  inset: '-50px -70px',
                  width: 'calc(100% + 140px)',
                  height: 'calc(100% + 100px)',
                  filter: `brightness(${ambientBrightnessScale}) blur(60px)`,
                  WebkitFilter: `brightness(${ambientBrightnessScale}) blur(60px)`,
                  opacity: 0.65,
                  zIndex: -1,
                  pointerEvents: 'none',
                  transition: 'opacity 0.4s ease, filter 0.4s ease',
                }}
              />

              {/* Right Canvas (1st child in RTL -> Physical RIGHT / Page 1) */}
              <canvas
                ref={rightPageCanvasRef}
                style={{
                  display: 'block',
                  boxShadow: 'none',
                  border: 'none',
                  outline: 'none',
                  borderRadius: 0,
                  backgroundColor: canvasBgColor,
                  filter: canvasFilter,
                  WebkitFilter: canvasFilter,
                  transition: 'filter 0.35s ease, background-color 0.35s ease',
                  maxWidth: '50vw',
                  maxHeight: '100vh',
                  height: '100%',
                  width: 'auto',
                  objectFit: 'contain',
                  flexShrink: 1,
                }}
              />

              {/* Left Canvas (2nd child in RTL -> Physical LEFT / Page 2) */}
              <canvas
                ref={leftPageCanvasRef}
                style={{
                  display: 'none',
                  boxShadow: 'none',
                  border: 'none',
                  outline: 'none',
                  borderRadius: 0,
                  backgroundColor: canvasBgColor,
                  filter: canvasFilter,
                  WebkitFilter: canvasFilter,
                  transition: 'filter 0.35s ease, background-color 0.35s ease',
                  maxWidth: '50vw',
                  maxHeight: '100vh',
                  height: '100%',
                  width: 'auto',
                  objectFit: 'contain',
                  flexShrink: 1,
                }}
              />
            </div>

            {/* Initial Loading Spinner (Only on cold book opening) */}
            {isLoadingPdf && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(10, 10, 10, 0.85)',
                  color: 'var(--text-secondary)',
                  gap: '12px',
                  zIndex: 20,
                }}
              >
                <Sparkles size={28} className="spin" color="#ffffff" />
                <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#ffffff' }}>
                  {isEn ? 'Loading book...' : 'جاري فتح وتجهيز الكتاب...'}
                </span>
              </div>
            )}
          </div>

          {/* Unified Floating Frosted Glass Dock (2-Row Layout: Top Info Row + Bottom Buttons Row) */}
          <div
            onMouseEnter={() => {
              isMouseOverDockRef.current = true;
              setIsMouseOverDock(true);
              if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
              }
              setShowControls(true);
            }}
            onMouseLeave={() => {
              isMouseOverDockRef.current = false;
              setIsMouseOverDock(false);
              if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
              }
              hideControlsTimeoutRef.current = setTimeout(() => {
                if (!isMouseOverDockRef.current) {
                  setShowControls(false);
                }
              }, 2400);
            }}
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: !isHoverLocked && (showControls || isMouseOverDock) ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(14px)',
              zIndex: 1000,
              backgroundColor: 'rgba(18, 18, 18, 0.90)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '24px',
              padding: '10px 18px',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              whiteSpace: 'nowrap',
              opacity: !isHoverLocked && (showControls || isMouseOverDock) ? 1 : 0,
              pointerEvents: !isHoverLocked && (showControls || isMouseOverDock) ? 'auto' : 'none',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
            }}
          >
            {/* Row 1: Dedicated Clean Book Name & Ward Day Info (Frameless) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '2px 8px',
              }}
            >
              <span
                style={{
                  fontSize: '0.96rem',
                  fontWeight: '800',
                  color: '#ffffff',
                  letterSpacing: '0.2px',
                }}
              >
                {activeBook?.name || (isEn ? 'Reading Book' : 'قراءة الكتاب')}
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.90rem' }}>•</span>
              <span
                style={{
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.75)',
                }}
              >
                {wardDayTitle}
              </span>
            </div>

            {/* Row 2: Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {/* Reading Theme Toggle (Warm Sepia / Dark / Original) */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCycleTheme}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                  backgroundColor:
                    readingTheme === 'dark'
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'rgba(255, 255, 255, 0.08)',
                  borderColor:
                    readingTheme === 'dark'
                      ? 'rgba(245, 158, 11, 0.40)'
                      : 'rgba(255, 255, 255, 0.15)',
                  color:
                    readingTheme === 'dark'
                      ? '#f59e0b'
                      : 'var(--text-primary)',
                }}
                title={isEn ? 'Toggle reading mode (Warm Night Mode / Original)' : 'تبديل نمط الإضاءة (نمط ليلي دافئ / أصلي)'}
              >
                {readingTheme === 'dark' ? (
                  <Moon size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                ) : (
                  <Sun size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                )}
                <span>
                  {readingTheme === 'dark'
                    ? (isEn ? 'Warm Night' : 'ليلي دافئ')
                    : (isEn ? 'Original' : 'أصلي')}
                </span>
              </button>

              {/* Lock Hover Button (Zero Distraction Mode) */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsHoverLocked(true);
                  setShowControls(false);
                  setShowUnlockTrigger(false);
                }}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                }}
                title={isEn ? 'Lock hover (hide all elements for distraction-free reading)' : 'قفل الهوفر (إخفاء كافة العناصر لمنع أي تشويش أثناء القراءة)'}
              >
                <Lock size={14} />
                <span>{isEn ? 'Lock Hover' : 'قفل الهوفر'}</span>
              </button>

              {/* Native Fullscreen Button */}
              <button
                type="button"
                className="btn-secondary"
                onClick={toggleNativeFullscreen}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                }}
                title={isFullscreen ? (isEn ? 'Exit Fullscreen' : 'إنهاء ملء الشاشة') : (isEn ? 'Native Browser Fullscreen' : 'ملء شاشة المتصفح')}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isFullscreen ? (isEn ? 'Exit Fullscreen' : 'تصغير الشاشة') : (isEn ? 'Fullscreen' : 'ملء الشاشة')}</span>
              </button>

              {/* Exit Reader Button */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseReader}
                style={{
                  padding: '7px 18px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                }}
                title={isEn ? 'Exit Reader' : 'إغلاق القراءة والعودة'}
              >
                <X size={14} />
                <span>{isEn ? 'Exit Reader' : 'إغلاق القراءة والعودة'}</span>
              </button>
            </div>
          </div>

          {/* Subtle Floating Unlock Button (Visible when hover is locked & cursor approaches bottom edge) */}
          {isHoverLocked && (
            <div
              style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: showUnlockTrigger ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(14px)',
                zIndex: 1000,
                opacity: showUnlockTrigger ? 1 : 0,
                pointerEvents: showUnlockTrigger ? 'auto' : 'none',
                transition: 'opacity 0.25s ease, transform 0.25s ease',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsHoverLocked(false);
                  setShowControls(true);
                }}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(18, 18, 18, 0.92)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
                title={isEn ? 'Unlock Hover (Restore Controls)' : 'إلغاء قفل الهوفر (استعادة الأزرار)'}
              >
                <Unlock size={15} />
                <span>{isEn ? 'Unlock Hover' : 'إلغاء قفل الهوفر'}</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Custom Goal Modal (Unlocked on 21 days) */}
      {typeof document !== 'undefined' && showCustomModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.80)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
          onClick={() => setShowCustomModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {isEn ? 'Customize Daily Reading Target' : 'تحديد الورد اليومي يدوياً'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 16px 0' }}>
              {isEn
                ? 'Choose your desired number of pages to read every day:'
                : 'حدد عدد الصفحات التي ترغب في قراءتها يومياً:'}
            </p>

            <input
              type="number"
              min="1"
              max="500"
              value={customTargetInput}
              onChange={(e) => setCustomTargetInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '1.1rem',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-primary)',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setShowCustomModal(false)}>
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
              <button className="btn-primary" onClick={handleSaveCustomTarget}>
                {isEn ? 'Save Target' : 'حفظ الورد'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
