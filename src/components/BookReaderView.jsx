import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BookOpen,
  Upload,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Award,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  BookMarked,
  X,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  saveBookToDB,
  getBookFromDB,
  getAllBooksMetadata,
  deleteBookFromDB,
  getActiveBookId,
  setActiveBookId,
  getReadingHabitState,
  getTodayDateString,
  getDailyTargetForLevel,
  recordReadingProgress,
  setCustomDailyTarget,
} from '../services/bookStorage';
import { logError } from '../services/errorLogger';

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
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const fileInputRef = useRef(null);

  const today = getTodayDateString();
  const todayLog = habitState.dailyLogs?.[today] || {
    pagesRead: 0,
    target: getDailyTargetForLevel(habitState.activeLevel, habitState.isCustomUnlocked, habitState.customDailyTarget),
    completed: false,
  };

  const currentDailyTarget = getDailyTargetForLevel(
    habitState.activeLevel,
    habitState.isCustomUnlocked,
    habitState.customDailyTarget
  );

  // 1. Load books list and active book on mount
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
        }
      }
    } catch (err) {
      console.error('Error loading books:', err);
      logError(err, 'BookReader.LoadActive');
    }
  }, []);

  useEffect(() => {
    loadBooksAndActive();

    const handleHabitUpdate = (e) => {
      if (e.detail) setHabitState(e.detail);
    };
    window.addEventListener('habit_reading_state_updated', handleHabitUpdate);
    return () => window.removeEventListener('habit_reading_state_updated', handleHabitUpdate);
  }, [loadBooksAndActive]);

  // 2. Manage Blob URL lifecycle for native PDF viewer
  useEffect(() => {
    if (!activeBook?.data) {
      setPdfBlobUrl(null);
      return;
    }

    try {
      let blob;
      if (activeBook.data instanceof Blob) {
        blob = activeBook.data;
      } else {
        blob = new Blob([activeBook.data], { type: 'application/pdf' });
      }
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);

      if (activeBook.totalPages) {
        setTotalPages(activeBook.totalPages);
      }

      // Restore saved bookmark
      const currentHabit = getReadingHabitState();
      const savedBookmark = currentHabit.bookmarks?.[activeBook.id];
      if (savedBookmark?.lastPage) {
        setCurrentPage(savedBookmark.lastPage);
      }

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('Error generating PDF Blob URL:', err);
      logError(err, 'BookReader.CreateBlobUrl');
    }
  }, [activeBook]);



  // 4. Page turning logic
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);

      // Record daily habit progress
      if (activeBook) {
        const updated = recordReadingProgress(activeBook.id, nextPage, totalPages, 1);
        setHabitState(updated);
      }
    }
  }, [currentPage, totalPages, activeBook]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);

      // Save bookmark without incrementing pages count
      if (activeBook) {
        const state = getReadingHabitState();
        state.bookmarks[activeBook.id] = {
          lastPage: prevPage,
          totalPages: totalPages,
          timestamp: Date.now(),
        };
        setHabitState({ ...state });
      }
    }
  }, [currentPage, totalPages, activeBook]);

  // 5. Handle Keyboard Arrow navigation inside reading mode
  useEffect(() => {
    if (!isReaderActive) return;

    const handleKeyDown = (e) => {
      // Isolate and prioritize page turning
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        // In Arabic RTL, ArrowRight moves to next page; in LTR, moves to prev
        if (isEn) handlePrevPage();
        else handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (isEn) handleNextPage();
        else handlePrevPage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseReader();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isReaderActive, isEn, handleNextPage, handlePrevPage]);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // 6. Handle File Processing (Shared for File Picker & Drag-and-Drop)
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
      setPdfDocument(tempPdf);
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

  // 7. Start & Close Reading Mode
  const handleOpenReader = () => {
    if (!activeBook) return;
    setIsReaderActive(true);
    onStartReading(); // Auto-switches background to custom_image
  };

  const handleCloseReader = () => {
    setIsReaderActive(false);
    onExitReading(); // Restores previous background smoothly
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
        setPdfDocument(null);
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
    <div className="book-reader-view-wrapper" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', animation: 'previewFadeIn 0.3s ease-out' }}>
      {/* 1. Habit Progression Hero & Daily Ward Dashboard */}
      {!isReaderActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
          {/* Missed Grace Day Warning Banner */}
          {habitState.missedGraceWarning && (
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.10)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f59e0b',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.86rem', fontWeight: '600', lineHeight: 1.5 }}>
                {isEn
                  ? '⚠️ You missed yesterday! Read today’s ward to preserve your streak and progress.'
                  : '⚠️ لقد انقطعت بالأمس! اقرأ ورد اليوم للحفاظ على سلسلتك ومستواك وتفادي إعادة الضبط.'}
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
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

            {/* Integrated Metrics Sub-Grid (Exact Dashboard Style) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              {[
                { lvl: 1, title: isEn ? 'Week 1' : 'الأسبوع الأول', pages: 10, daysReq: 7 },
                { lvl: 2, title: isEn ? 'Week 2' : 'الأسبوع الثاني', pages: 20, daysReq: 14 },
                { lvl: 3, title: isEn ? 'Week 3' : 'الأسبوع الثالث', pages: 30, daysReq: 21 },
                { lvl: 4, title: isEn ? 'Mastery' : 'الانضباط والحرية', pages: habitState.customDailyTarget || 30, isUnlocked: habitState.isCustomUnlocked },
              ].map((step) => {
                const isActive = habitState.activeLevel === step.lvl;
                const isDone = habitState.completedDays >= step.daysReq || (step.lvl === 4 && habitState.isCustomUnlocked);
                const stepColor = isDone ? '#22c55e' : isActive ? 'var(--accent-blue)' : 'var(--text-secondary)';

                return (
                  <div
                    key={step.lvl}
                    style={{
                      background: isActive
                        ? 'rgba(59, 130, 246, 0.08)'
                        : isDone
                        ? 'rgba(34, 197, 94, 0.06)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: isActive
                        ? '1px solid rgba(59, 130, 246, 0.35)'
                        : isDone
                        ? '1px solid rgba(34, 197, 94, 0.25)'
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: stepColor, fontSize: '0.75rem', fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isDone ? (
                          <CheckCircle2 size={13} />
                        ) : isActive ? (
                          <Sparkles size={13} />
                        ) : (
                          <Lock size={12} style={{ opacity: 0.6 }} />
                        )}
                        <span>{step.title}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>
                        {step.daysReq ? `${step.daysReq} ${isEn ? 'd' : 'يوم'}` : ''}
                      </span>
                    </div>

                    <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: '800', color: stepColor, marginTop: '4px' }}>
                      {step.pages}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        {step.lvl === 4 && habitState.isCustomUnlocked
                          ? (isEn ? 'pages (Custom)' : 'صفحة (مخصص)')
                          : (isEn ? 'pages/d' : 'صفحة / يوم')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Today's Progress Bar */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {isEn ? "Today's Reading Progress:" : 'إنجاز ورد اليوم:'}
                </span>
                <span style={{ fontWeight: '700', color: todayLog.completed ? '#22c55e' : 'var(--accent-blue)' }}>
                  {todayLog.pagesRead} / {currentDailyTarget} {isEn ? 'pages' : 'صفحة'}{' '}
                  {todayLog.completed && (isEn ? ' (Completed 🎉)' : ' (تم الإنجاز 🎉)')}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 'var(--radius-pill)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((todayLog.pagesRead / currentDailyTarget) * 100))}%`,
                    backgroundColor: todayLog.completed ? '#22c55e' : 'var(--accent-blue)',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '54px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '36px 20px',
                  borderRadius: '12px',
                  border: isDraggingOver
                    ? '2px dashed var(--status-on-time)'
                    : '2px dashed rgba(255, 255, 255, 0.20)',
                  backgroundColor: isDraggingOver
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
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
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeBook?.id === b.id ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: activeBook?.id === b.id ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
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

      {/* 3. Interactive Fullscreen Active Reading Mode (Comfortable Eye-Care Reader) */}
      {isReaderActive && (
        <div
          className="book-active-reader-stage"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: '80vh',
            width: '100%',
            animation: 'previewFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative',
          }}
        >
          {/* Top Floating Reader Toolbar */}
          <div
            style={{
              position: 'sticky',
              top: '12px',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '920px',
              padding: '10px 20px',
              background: 'rgba(10, 10, 14, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              marginBottom: '16px',
            }}
          >
            {/* Left: Book Title & Bookmark Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--status-on-time)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                }}
              >
                <Bookmark size={15} />
                <span>
                  {isEn ? `Page ${currentPage} of ${totalPages}` : `صفحة ${currentPage} من ${totalPages}`}
                </span>
              </div>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeBook?.name}
              </span>
            </div>

            {/* Center: Ward Progress Chip */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: todayLog.completed ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                border: todayLog.completed ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.10)',
                fontSize: '0.80rem',
                fontWeight: '700',
                color: todayLog.completed ? '#22c55e' : 'var(--text-primary)',
              }}
            >
              <Award size={14} />
              <span>
                {isEn
                  ? `${todayLog.pagesRead}/${currentDailyTarget} pages today`
                  : `الورد: ${todayLog.pagesRead} من ${currentDailyTarget} صفحة`}
              </span>
            </div>

            {/* Right: Fullscreen & Close Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => setIsFullscreen(!isFullscreen)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                }}
                title={isFullscreen ? (isEn ? 'Exit Fullscreen' : 'إنهاء ملء الشاشة') : (isEn ? 'Fullscreen' : 'ملء الشاشة')}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isFullscreen ? (isEn ? 'Minimize' : 'تصغير') : (isEn ? 'Fullscreen' : 'ملء الشاشة')}</span>
              </button>

              <button
                className="btn-secondary"
                onClick={handleCloseReader}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                }}
                title={isEn ? 'Exit Reader' : 'إنهاء القراءة'}
              >
                <X size={14} />
                <span>{isEn ? 'Exit' : 'خروج'}</span>
              </button>
            </div>
          </div>

          {/* Native Embedded High-Performance PDF Stage */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: isFullscreen ? 'calc(100vh - 150px)' : '76vh',
              height: isFullscreen ? 'calc(100vh - 150px)' : '76vh',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.75)',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              margin: '0 auto 20px auto',
            }}
          >
            {/* Visual Bookmark Ribbon Flag */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: '24px',
                backgroundColor: '#ef4444',
                color: '#fff',
                padding: '6px 12px',
                fontSize: '0.74rem',
                fontWeight: '800',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                pointerEvents: 'none',
              }}
            >
              <Bookmark size={12} fill="#fff" />
              <span>{isEn ? `Page ${currentPage}` : `صفحة ${currentPage}`}</span>
            </div>

            {pdfBlobUrl ? (
              <iframe
                key={`${activeBook?.id}_p${currentPage}`}
                src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=1`}
                title={activeBook?.name || 'Book PDF Viewer'}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  backgroundColor: '#ffffff',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-secondary)',
                  gap: '12px',
                }}
              >
                <Sparkles size={28} className="spin" color="#3b82f6" />
                <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                  {isEn ? 'Loading book...' : 'جاري تجهيز الكتاب...'}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Floating Page Turning Bar (Also accessible via Arrow keys) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '8px 24px',
              background: 'rgba(10, 10, 14, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              marginBottom: '32px',
              width: 'fit-content',
              margin: '0 auto 32px auto',
            }}
          >
            <button
              className="btn-secondary"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <ChevronRight size={17} />
              <span>{isEn ? 'Previous Page' : 'الصفحة السابقة'}</span>
            </button>

            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', minWidth: '80px', textAlign: 'center' }}>
              {isEn
                ? `Page ${currentPage}${totalPages ? ` of ${totalPages}` : ''}`
                : `صفحة ${currentPage}${totalPages ? ` من ${totalPages}` : ''}`}
            </span>

            <button
              className="btn-primary"
              onClick={handleNextPage}
              disabled={totalPages > 0 && currentPage >= totalPages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '0.86rem',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <span>{isEn ? 'Next Page' : 'الصفحة التالية'}</span>
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Custom Goal Modal (Unlocked on 21 days) */}
      {showCustomModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
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
        </div>
      )}
    </div>
  );
}
