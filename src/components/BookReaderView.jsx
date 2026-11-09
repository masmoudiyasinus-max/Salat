import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import {
	deleteBookFromDB,
	getActiveBookId,
	getAllBooksMetadata,
	getBookFromDB,
	getCumulativeWardCeiling,
	getDailyTargetForLevel,
	getPastCompletedDays,
	getReadingHabitState,
	getTodayDateString,
	recordReadingProgress,
	saveBookToDB,
	saveReadingHabitState,
	setActiveBookId,
	setCustomDailyTarget,
} from "../services/bookStorage";
import { logError } from "../services/errorLogger";
import {
	dispatchMuneerSignal,
	MUNEER_SIGNALS,
	recordBookFlipAndCheck,
} from "../services/muneerSignalService";
import BookLibraryShelf from "./book/BookLibraryShelf";
// Child components
import { getArabicOrdinalDay } from "./book/bookUtils";
import PdfCanvasViewer from "./book/PdfCanvasViewer";
import ReaderToolbar from "./book/ReaderToolbar";
import {
	HabitProgressionHero,
	ReadingStatsModal,
} from "./book/ReadingStatsModal";

// Configure PDF.js standard worker URL (Invariant)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function BookReaderView({
	settings = {},
	onStartReading = () => {},
	onExitReading = () => {},
	isReaderActive = false,
	setIsReaderActive = () => {},
}) {
	const isEn = settings?.language === "en";

	// State
	const [habitState, setHabitState] = useState(getReadingHabitState());
	const [booksList, setBooksList] = useState([]);
	const [activeBook, setActiveBook] = useState(null);
	const [pdfDoc, setPdfDoc] = useState(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [isLoadingPdf, setIsLoadingPdf] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [customTargetInput, setCustomTargetInput] = useState("");
	const [showCustomModal, setShowCustomModal] = useState(false);
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [showControls, setShowControls] = useState(false);
	const [isHoverLocked, setIsHoverLocked] = useState(false);
	const [showUnlockTrigger, setShowUnlockTrigger] = useState(false);
	const [isMouseOverDock, setIsMouseOverDock] = useState(false);
	const [readingTheme, setReadingTheme] = useState(() => {
		try {
			const saved = localStorage.getItem("habit_tracker_reading_theme");
			return saved === "dark" ? "dark" : "default";
		} catch {
			return "default";
		}
	});
	const [ambientBrightnessScale, setAmbientBrightnessScale] = useState(1.0);

	const handleCycleTheme = useCallback(() => {
		setReadingTheme((prev) => {
			const next = prev === "dark" ? "default" : "dark";
			try {
				localStorage.setItem("habit_tracker_reading_theme", next);
			} catch {}
			return next;
		});
	}, []);

	// References
	const fileInputRef = useRef(null);
	const readerRootRef = useRef(null);
	const ambientCanvasRef = useRef(null);
	const rightPageCanvasRef = useRef(null);
	const leftPageCanvasRef = useRef(null);
	const readerContainerRef = useRef(null);
	const pageCacheRef = useRef(new Map());
	const prefetchQueueRef = useRef(new Set());
	const hideControlsTimeoutRef = useRef(null);
	const isMouseOverDockRef = useRef(false);

	const handleMouseMove = useCallback(
		(e) => {
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
			if (!isMouseOverDockRef.current) {
				hideControlsTimeoutRef.current = setTimeout(() => {
					if (!isMouseOverDockRef.current) {
						setShowControls(false);
					}
				}, 2800);
			}
		},
		[isHoverLocked],
	);

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
		habitState.customDailyTarget,
	);
	const todayLog = habitState.dailyLogs?.[today] || {
		pagesRead: 0,
		target: currentDailyTarget,
		completed: false,
	};

	const themeBackdropStyle =
		readingTheme === "dark"
			? "radial-gradient(circle at 50% 50%, #1a1814 0%, #0f0e0c 70%, #080706 100%)"
			: "radial-gradient(circle at 50% 50%, #1f2024 0%, #121316 70%, #0a0a0b 100%)";

	const canvasFilter =
		readingTheme === "dark"
			? "invert(0.88) hue-rotate(180deg) sepia(0.25) contrast(0.92) brightness(0.88)"
			: "none";

	const canvasBgColor = readingTheme === "dark" ? "#1c1a17" : "#ffffff";

	const maxWardPage = Math.min(
		totalPages || 999999,
		getCumulativeWardCeiling(habitState, today),
	);
	const maxAllowedSpreadStart =
		maxWardPage % 2 === 1 ? maxWardPage : maxWardPage - 1;

	const pastDaysCount = getPastCompletedDays(habitState, today);
	const currentDayNumber = pastDaysCount + 1;
	const wardDayTitle = isEn
		? `Day ${currentDayNumber} Ward`
		: `ورد اليوم ${getArabicOrdinalDay(currentDayNumber)}`;

	const curSpreadStart =
		currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
	const canTurnNext =
		curSpreadStart < maxAllowedSpreadStart && currentPage < totalPages;

	// 1. Offscreen High-DPI Page Renderer with contain fit
	const renderPageToOffscreen = useCallback(
		async (doc, pageNum, maxW, maxH) => {
			if (!doc || pageNum < 1 || pageNum > doc.numPages) return null;
			try {
				const page = await doc.getPage(pageNum);
				const baseViewport = page.getViewport({ scale: 1.0 });

				const availW = Math.max(120, maxW);
				const availH = Math.max(120, maxH);

				const scaleX = availW / baseViewport.width;
				const scaleY = availH / baseViewport.height;
				const fitScale = Math.min(scaleX, scaleY);

				const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
				const viewport = page.getViewport({ scale: fitScale });

				const offscreen = document.createElement("canvas");
				offscreen.width = Math.floor(viewport.width * dpr);
				offscreen.height = Math.floor(viewport.height * dpr);

				const ctx = offscreen.getContext("2d", { alpha: false });
				if (!ctx) return null;

				ctx.fillStyle = "#ffffff";
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
				if (err?.name !== "RenderingCancelledException") {
					console.error("Error rendering page offscreen:", err);
				}
				return null;
			}
		},
		[],
	);

	// 2. Prefetch Surrounding Pages in Background
	const prefetchSurroundingPages = useCallback(
		(doc, pageNum, maxW, maxH) => {
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
				if (
					!pageCacheRef.current.has(key) &&
					!prefetchQueueRef.current.has(key)
				) {
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
		},
		[activeBook, renderPageToOffscreen, maxWardPage],
	);

	const drawPageOntoCanvas = useCallback((targetCanvas, rendered) => {
		if (!targetCanvas || !rendered) return;
		targetCanvas.width = rendered.canvas.width;
		targetCanvas.height = rendered.canvas.height;
		targetCanvas.style.display = "block";
		const ctx = targetCanvas.getContext("2d", { alpha: false });
		if (ctx) {
			ctx.drawImage(rendered.canvas, 0, 0);
		}
	}, []);

	const updateAmbientCanvas = useCallback(() => {
		const ambCanvas = ambientCanvasRef.current;
		if (!ambCanvas) return;
		const ambW = 32;
		const ambH = 20;
		if (ambCanvas.width !== ambW || ambCanvas.height !== ambH) {
			ambCanvas.width = ambW;
			ambCanvas.height = ambH;
		}
		const ctx = ambCanvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return;
		ctx.clearRect(0, 0, ambW, ambH);

		ctx.filter = canvasFilter;

		const rightEl = rightPageCanvasRef.current;
		const leftEl = leftPageCanvasRef.current;
		const hasRight =
			rightEl && rightEl.style.display !== "none" && rightEl.width > 0;
		const hasLeft =
			leftEl && leftEl.style.display !== "none" && leftEl.width > 0;

		if (hasRight && hasLeft) {
			ctx.drawImage(leftEl, 0, 0, ambW / 2, ambH);
			ctx.drawImage(rightEl, ambW / 2, 0, ambW / 2, ambH);
		} else if (hasRight) {
			ctx.drawImage(rightEl, 0, 0, ambW, ambH);
		} else if (hasLeft) {
			ctx.drawImage(leftEl, 0, 0, ambW, ambH);
		}

		try {
			const imgData = ctx.getImageData(0, 0, ambW, ambH);
			const data = imgData.data;
			let totalLuma = 0;
			for (let i = 0; i < data.length; i += 4) {
				totalLuma +=
					0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
			}
			const avgLuma = totalLuma / (ambW * ambH);
			const dynamicScale = Math.min(1.35, Math.max(0.52, 105 / (avgLuma + 45)));
			setAmbientBrightnessScale(Number(dynamicScale.toFixed(2)));
		} catch {
			setAmbientBrightnessScale(1.0);
		}
	}, [canvasFilter]);

	useEffect(() => {
		updateAmbientCanvas();
	}, [updateAmbientCanvas, readingTheme]);

	// 3. Display Dual / Single Page Spread
	const displayPage = useCallback(
		async (pageNum) => {
			if (!pdfDoc || !readerContainerRef.current || !activeBook) return;

			const container = readerContainerRef.current;
			const cW = Math.floor(
				container.clientWidth || container.getBoundingClientRect().width,
			);
			const cH = Math.floor(
				container.clientHeight || container.getBoundingClientRect().height,
			);
			if (cW <= 0 || cH <= 0) return;

			const maxW = Math.floor(cW / 2);
			const maxH = cH;

			const clampedPage = Math.min(pageNum, maxAllowedSpreadStart);
			const spreadStart =
				clampedPage % 2 === 1 ? clampedPage : Math.max(1, clampedPage - 1);
			const rightPageNum = spreadStart <= maxWardPage ? spreadStart : null;
			const leftPageNum =
				spreadStart + 1 <= Math.min(pdfDoc.numPages, maxWardPage)
					? spreadStart + 1
					: null;

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

				if (rightPageCanvasRef.current) {
					if (renderedRight) {
						drawPageOntoCanvas(rightPageCanvasRef.current, renderedRight);
					} else {
						rightPageCanvasRef.current.style.display = "none";
					}
				}

				if (leftPageCanvasRef.current) {
					if (renderedLeft) {
						drawPageOntoCanvas(leftPageCanvasRef.current, renderedLeft);
					} else {
						leftPageCanvasRef.current.style.display = "none";
					}
				}

				updateAmbientCanvas();
			} catch (err) {
				console.error("Failed to display page spread:", err);
			} finally {
				prefetchSurroundingPages(pdfDoc, spreadStart, maxW, maxH);
			}
		},
		[
			pdfDoc,
			activeBook,
			renderPageToOffscreen,
			drawPageOntoCanvas,
			updateAmbientCanvas,
			prefetchSurroundingPages,
			maxWardPage,
			maxAllowedSpreadStart,
		],
	);

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

				const version = pdfjsLib.version || "4.10.38";
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

				const currentHabit = getReadingHabitState();
				const savedBookmark = currentHabit.bookmarks?.[bookId];
				const todayStr = getTodayDateString();
				const maxWardCeiling = Math.min(
					doc.numPages,
					getCumulativeWardCeiling(currentHabit, todayStr),
				);
				const maxSprStart =
					maxWardCeiling % 2 === 1 ? maxWardCeiling : maxWardCeiling - 1;

				const targetPage =
					savedBookmark?.lastPage && savedBookmark.lastPage <= doc.numPages
						? Math.min(savedBookmark.lastPage, maxSprStart)
						: 1;
				const normalizedSpread =
					targetPage % 2 === 1 ? targetPage : Math.max(1, targetPage - 1);

				setCurrentPage(normalizedSpread);
			} catch (err) {
				console.error("Failed to load PDF from buffer:", err);
				logError(err, "BookReader.LoadPdfFromBuffer");
				setPdfDoc(null);
				alert(
					isEn
						? "Failed to parse book data. The file might be corrupted."
						: "تعذر قراءة بيانات الكتاب، قد يكون الملف تالفاً.",
				);
			} finally {
				setIsLoadingPdf(false);
			}
		},
		[isEn],
	);

	// 5. Load books list and active book on mount
	const loadBooksAndActive = useCallback(async () => {
		try {
			const list = await getAllBooksMetadata();
			setBooksList(list);

			const activeId =
				getActiveBookId() || (list.length > 0 ? list[0].id : null);
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
			console.error("Error loading books:", err);
			logError(err, "BookReader.LoadActive");
		}
	}, [loadPdfFromBuffer]);

	useEffect(() => {
		loadBooksAndActive();

		const handleHabitUpdate = (e) => {
			if (e.detail) setHabitState(e.detail);
		};
		window.addEventListener("habit_reading_state_updated", handleHabitUpdate);
		return () =>
			window.removeEventListener(
				"habit_reading_state_updated",
				handleHabitUpdate,
			);
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
			console.warn("Native Fullscreen toggle notice:", err);
		}
	};

	useEffect(() => {
		const handleFullscreenChange = () => {
			const isFs = !!(
				document.fullscreenElement || document.webkitFullscreenElement
			);
			setIsFullscreen(isFs);
			setTimeout(() => {
				if (currentPage) displayPage(currentPage);
			}, 80);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			document.removeEventListener(
				"webkitfullscreenchange",
				handleFullscreenChange,
			);
		};
	}, [currentPage, displayPage]);

	// 7. Page turning logic
	const handleNextPage = useCallback(() => {
		recordBookFlipAndCheck();
		const curSpread =
			currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
		if (curSpread >= maxAllowedSpreadStart || currentPage >= totalPages) {
			return;
		}

		const nextSpread = curSpread + 2;
		if (nextSpread > maxAllowedSpreadStart) {
			return;
		}

		setCurrentPage(nextSpread);
		displayPage(nextSpread);

		if (activeBook) {
			const updated = recordReadingProgress(
				activeBook.id,
				nextSpread,
				totalPages,
				2,
			);
			setHabitState(updated);

			const todayStr = getTodayDateString();
			if (updated?.dailyLogs?.[todayStr]?.isTargetMet) {
				dispatchMuneerSignal(MUNEER_SIGNALS.DAILY_WARD_COMPLETED, {
					pagesCount: currentDailyTarget,
				});
			}
		}
	}, [
		currentPage,
		totalPages,
		activeBook,
		displayPage,
		maxAllowedSpreadStart,
		currentDailyTarget,
	]);

	const handlePrevPage = useCallback(() => {
		if (currentPage > 1) {
			recordBookFlipAndCheck();
			const spreadStart =
				currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
			const prevPage = Math.max(1, spreadStart - 2);

			setCurrentPage(prevPage);
			displayPage(prevPage);

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
				else if (document.webkitExitFullscreen)
					await document.webkitExitFullscreen();
			} catch (err) {
				console.warn("Exit fullscreen notice:", err);
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
			const targetTag =
				target && target.tagName ? target.tagName.toLowerCase() : "";
			if (
				targetTag === "input" ||
				targetTag === "textarea" ||
				targetTag === "select" ||
				(target && target.isContentEditable) ||
				(target &&
					typeof target.closest === "function" &&
					target.closest('[contenteditable="true"]'))
			) {
				return;
			}

			if (e.key === "ArrowRight") {
				e.preventDefault();
				e.stopPropagation();
				if (isEn) {
					if (canTurnNext) handleNextPage();
				} else {
					handlePrevPage();
				}
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				e.stopPropagation();
				if (isEn) {
					handlePrevPage();
				} else {
					if (canTurnNext) handleNextPage();
				}
			} else if (e.key === " " || e.key === "PageDown") {
				e.preventDefault();
				e.stopPropagation();
				if (e.shiftKey) {
					handlePrevPage();
				} else if (canTurnNext) {
					handleNextPage();
				}
			} else if (e.key === "PageUp") {
				e.preventDefault();
				e.stopPropagation();
				handlePrevPage();
			} else if (e.key === "Home") {
				e.preventDefault();
				e.stopPropagation();
				setCurrentPage(1);
				displayPage(1);
			} else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				toggleNativeFullscreen();
			} else if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				handleCycleTheme();
			} else if (e.key === "Escape") {
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

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [
		isReaderActive,
		isEn,
		totalPages,
		canTurnNext,
		isHoverLocked,
		handleNextPage,
		handlePrevPage,
		handleCloseReader,
		handleCycleTheme,
		displayPage,
	]);

	// 10. Handle ResizeObserver
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

	// Handle File Upload
	const processUploadedPdfFile = async (file) => {
		if (!file) return;

		if (
			!file.name.toLowerCase().endsWith(".pdf") &&
			file.type !== "application/pdf"
		) {
			alert(
				isEn
					? "Please upload a valid PDF book"
					: "يرجى اختيار كتاب بصيغة PDF صالحة",
			);
			return;
		}

		try {
			setIsLoadingPdf(true);
			const arrayBuffer = await file.arrayBuffer();
			const bookId = "book_" + Date.now();

			const bufferForDB = arrayBuffer.slice(0);
			const bufferForPdf = new Uint8Array(arrayBuffer.slice(0));

			const version = pdfjsLib.version || "4.10.38";
			const tempTask = pdfjsLib.getDocument({
				data: bufferForPdf,
				cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
				cMapPacked: true,
				standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
			});
			const tempPdf = await tempTask.promise;
			const numPages = tempPdf.numPages;

			const savedRecord = await saveBookToDB(
				bookId,
				file.name.replace(/\.pdf$/i, ""),
				(file.size / (1024 * 1024)).toFixed(1) + " MB",
				bufferForDB,
				numPages,
			);

			setActiveBookId(bookId);
			setActiveBook(savedRecord);
			setPdfDoc(tempPdf);
			setTotalPages(numPages);
			setCurrentPage(1);

			const list = await getAllBooksMetadata();
			setBooksList(list);

			recordReadingProgress(bookId, 1, numPages, 0);
		} catch (err) {
			console.error("Failed to save and parse PDF:", err);
			logError(err, "BookReader.Upload");
			alert(
				isEn
					? "Failed to process PDF book: " + (err.message || "Unknown error")
					: "تعذر تحميل ملف الكتاب: " + (err.message || "تأكد من سلامة الملف"),
			);
		} finally {
			setIsLoadingPdf(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
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
		if (
			!confirm(
				isEn
					? "Delete this book from local storage?"
					: "هل تريد حذف هذا الكتاب من التخزين المحلي؟",
			)
		)
			return;

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

	const handleSaveCustomTarget = (target) => {
		if (target > 0) {
			const updated = setCustomDailyTarget(target);
			setHabitState(updated);
			setShowCustomModal(false);
		}
	};

	return (
		<div
			ref={readerRootRef}
			className={`book-reader-view-wrapper ${isFullscreen || isReaderActive ? "native-fullscreen-active" : ""}`}
			style={
				isReaderActive || isFullscreen
					? {
							position: "fixed",
							inset: 0,
							width: "100vw",
							height: "100vh",
							zIndex: 999999,
							background: themeBackdropStyle,
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							overflow: "hidden",
							padding: "8px 16px",
							boxSizing: "border-box",
						}
					: {
							width: "100%",
							maxWidth: "1100px",
							margin: "0 auto",
						}
			}
		>
			{/* 1. Habit Progression Hero & Daily Ward Dashboard + 2. Current Book & Library */}
			{!isReaderActive && (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "16px",
						marginBottom: "0px",
					}}
				>
					<HabitProgressionHero
						habitState={habitState}
						currentDailyTarget={currentDailyTarget}
						todayLog={todayLog}
						onOpenCustomModal={() => {
							setCustomTargetInput(String(habitState.customDailyTarget || 30));
							setShowCustomModal(true);
						}}
						isEn={isEn}
					/>

					<BookLibraryShelf
						booksList={booksList}
						activeBook={activeBook}
						currentPage={currentPage}
						totalPages={totalPages}
						isLoadingPdf={isLoadingPdf}
						isDraggingOver={isDraggingOver}
						fileInputRef={fileInputRef}
						onFileUpload={handleFileUpload}
						onOpenReader={handleOpenReader}
						onSelectBook={handleSelectBook}
						onDeleteBook={handleDeleteBook}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						isEn={isEn}
					/>
				</div>
			)}

			{/* 3. Interactive Fullscreen Active Reading Mode */}
			{typeof document !== "undefined" &&
				isReaderActive &&
				ReactDOM.createPortal(
					<div
						onMouseMove={handleMouseMove}
						onMouseEnter={() => setShowControls(true)}
						onMouseLeave={handleMouseLeave}
						style={{
							position: "fixed",
							inset: 0,
							width: "100vw",
							height: "100vh",
							zIndex: 999999,
							background: themeBackdropStyle,
							overflow: "hidden",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							transition: "background 0.4s ease",
						}}
					>
						<PdfCanvasViewer
							canTurnNext={canTurnNext}
							todayLog={todayLog}
							onNextPage={handleNextPage}
							onPrevPage={handlePrevPage}
							readerContainerRef={readerContainerRef}
							ambientCanvasRef={ambientCanvasRef}
							rightPageCanvasRef={rightPageCanvasRef}
							leftPageCanvasRef={leftPageCanvasRef}
							ambientBrightnessScale={ambientBrightnessScale}
							canvasBgColor={canvasBgColor}
							canvasFilter={canvasFilter}
							themeBackdropStyle={themeBackdropStyle}
							isLoadingPdf={isLoadingPdf}
							isEn={isEn}
						/>

						<ReaderToolbar
							activeBook={activeBook}
							wardDayTitle={wardDayTitle}
							readingTheme={readingTheme}
							isHoverLocked={isHoverLocked}
							showControls={showControls}
							isMouseOverDock={isMouseOverDock}
							showUnlockTrigger={showUnlockTrigger}
							isFullscreen={isFullscreen}
							onCycleTheme={handleCycleTheme}
							onLockHover={() => {
								setIsHoverLocked(true);
								setShowControls(false);
								setShowUnlockTrigger(false);
							}}
							onUnlockHover={() => {
								setIsHoverLocked(false);
								setShowControls(true);
							}}
							onToggleFullscreen={toggleNativeFullscreen}
							onCloseReader={handleCloseReader}
							onMouseEnterDock={() => {
								isMouseOverDockRef.current = true;
								setIsMouseOverDock(true);
								if (hideControlsTimeoutRef.current) {
									clearTimeout(hideControlsTimeoutRef.current);
								}
								setShowControls(true);
							}}
							onMouseLeaveDock={() => {
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
							isEn={isEn}
						/>
					</div>,
					document.body,
				)}

			{/* Custom Goal Modal */}
			<ReadingStatsModal
				isOpen={showCustomModal}
				onClose={() => setShowCustomModal(false)}
				initialTarget={
					parseInt(customTargetInput, 10) || habitState.customDailyTarget || 30
				}
				onSaveTarget={handleSaveCustomTarget}
				isEn={isEn}
			/>
		</div>
	);
}
