import { History, Plus } from "lucide-react";
import { Button } from "open-glass-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ensureDailySuggestions,
	getDailySuggestions,
} from "../services/dailySuggestionsService";
import {
	correctSpellingText,
	generateSessionContextualTitle,
	generateSessionTitle,
	sendGeminiChatMessage,
} from "../services/geminiApi";
import {
	executeSettingsActionDirectly,
	extractMuneerAction,
} from "../services/muneerActions";
import { APP_EVENTS } from "../services/prayerConstants";
import {
	compressImageFile,
	createNewSession,
	deleteSession,
	getActiveSessionId,
	getChatSessions,
	getSettings,
	resetChatSessions,
	saveActiveSessionId,
	saveChatSessions,
	updateSessionMessages,
	updateSessionTitle,
} from "../services/storage";
import ChatInputBar from "./chat/ChatInputBar";
import ChatMessageList from "./chat/ChatMessageList";
import ChatSessionDrawer from "./chat/ChatSessionDrawer";
// Child components
import {
	extractSegmentsFromEditor,
	insertFileChipToEditor,
} from "./chat/chatEditorUtils";
import { ImagePreviewModal } from "./chat/FileAttachmentList";
import GlassViewShell from "./layout/GlassViewShell";

const CHAT_AWAY_RESET_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)
const LAST_LEFT_CHAT_STORAGE_KEY = "prayer_tracker_last_left_chat_time";

export default function ChatView({
	settings,
	onNavigateToSettings,
	onSettingsSaved,
	isActive = true,
	isOnline: propIsOnline,
}) {
	const lang = settings?.language || "ar";
	const isEn = lang === "en";

	const [isOnline, setIsOnline] = useState(() =>
		propIsOnline !== undefined
			? propIsOnline
			: typeof navigator !== "undefined"
				? navigator.onLine
				: true,
	);

	useEffect(() => {
		if (propIsOnline !== undefined) {
			setIsOnline(propIsOnline);
		}
	}, [propIsOnline]);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	const [sessions, setSessions] = useState(() => getChatSessions());
	const [dailySuggestions, setDailySuggestions] = useState(() =>
		getDailySuggestions(lang),
	);
	const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
	const [activeSessionId, setActiveSessionIdState] = useState(() => {
		const id = getActiveSessionId();
		const list = getChatSessions();
		if (id && list.some((s) => s.id === id)) return id;
		return list[0]?.id || "";
	});

	// Sync daily suggestions from storage events
	useEffect(() => {
		const handleSuggestionsUpdate = (e) => {
			if (e.detail?.suggestions && Array.isArray(e.detail.suggestions)) {
				setDailySuggestions(e.detail.suggestions);
				setIsGeneratingSuggestions(false);
			}
		};
		window.addEventListener(
			"prayer_tracker_suggestions_updated",
			handleSuggestionsUpdate,
		);
		return () =>
			window.removeEventListener(
				"prayer_tracker_suggestions_updated",
				handleSuggestionsUpdate,
			);
	}, []);

	// System trigger: Request fresh suggestions from the model once per day in background
	useEffect(() => {
		const currentApiKey = (
			settings?.geminiApiKey ||
			getSettings()?.geminiApiKey ||
			""
		).trim();
		const cached = getDailySuggestions(lang);
		if (cached && cached.length > 0) {
			setDailySuggestions(cached);
			setIsGeneratingSuggestions(false);
		} else if (currentApiKey) {
			setIsGeneratingSuggestions(true);
			ensureDailySuggestions(currentApiKey, lang)
				.then((res) => {
					if (Array.isArray(res) && res.length > 0) {
						setDailySuggestions(res);
					}
				})
				.catch(() => {})
				.finally(() => {
					setIsGeneratingSuggestions(false);
				});
		} else {
			setIsGeneratingSuggestions(false);
		}
	}, [settings?.geminiApiKey, lang]);

	const validSessions =
		Array.isArray(sessions) && sessions.length > 0
			? sessions
			: getChatSessions();
	const activeSession =
		validSessions.find((s) => s.id === activeSessionId) ||
		validSessions[0] ||
		{};
	const messages = Array.isArray(activeSession.messages)
		? activeSession.messages
		: [];
	const isCurrentChatEmpty = !messages.some((m) => m && m.sender === "user");

	const lastChatActivityTimeRef = useRef(() => {
		try {
			const stored = localStorage.getItem(LAST_LEFT_CHAT_STORAGE_KEY);
			return stored ? parseInt(stored, 10) : Date.now();
		} catch {
			return Date.now();
		}
	});

	const recordChatActivity = useCallback(() => {
		const now = Date.now();
		lastChatActivityTimeRef.current = now;
		try {
			localStorage.setItem(LAST_LEFT_CHAT_STORAGE_KEY, String(now));
		} catch {
			// Ignore
		}
	}, []);

	// Track user presence and inactivity in the AI chat view (2-min reset invariant)
	useEffect(() => {
		if (isActive) {
			const lastActivity =
				typeof lastChatActivityTimeRef.current === "function"
					? lastChatActivityTimeRef.current()
					: lastChatActivityTimeRef.current;
			const now = Date.now();

			if (
				lastActivity > 0 &&
				now - lastActivity >= CHAT_AWAY_RESET_TIMEOUT_MS
			) {
				const currentMsgs = Array.isArray(activeSession?.messages)
					? activeSession.messages
					: [];
				const hasUserMsgs = currentMsgs.some((m) => m && m.sender === "user");

				if (hasUserMsgs) {
					try {
						const { newSession, sessions: updated } = createNewSession();
						setSessions(updated);
						setActiveSessionIdState(newSession.id);
					} catch (err) {
						console.error(
							"Error auto-creating new chat session after 2m inactivity:",
							err,
						);
					}
				}
			}

			recordChatActivity();
		} else {
			recordChatActivity();
		}
	}, [isActive, activeSession?.messages, recordChatActivity]);

	useEffect(() => {
		if (!isActive) return;

		let lastThrottle = 0;
		const handleUserInteraction = () => {
			const now = Date.now();
			if (now - lastThrottle >= 3000) {
				lastThrottle = now;
				recordChatActivity();
			}
		};

		window.addEventListener("mousemove", handleUserInteraction, {
			passive: true,
		});
		window.addEventListener("keydown", handleUserInteraction, {
			passive: true,
		});
		window.addEventListener("touchstart", handleUserInteraction, {
			passive: true,
		});
		window.addEventListener("scroll", handleUserInteraction, { passive: true });

		return () => {
			window.removeEventListener("mousemove", handleUserInteraction);
			window.removeEventListener("keydown", handleUserInteraction);
			window.removeEventListener("touchstart", handleUserInteraction);
			window.removeEventListener("scroll", handleUserInteraction);
		};
	}, [isActive, recordChatActivity]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!isActive) return;

			if (document.visibilityState === "hidden") {
				recordChatActivity();
			} else if (document.visibilityState === "visible") {
				const lastActivity =
					typeof lastChatActivityTimeRef.current === "function"
						? lastChatActivityTimeRef.current()
						: lastChatActivityTimeRef.current;
				const now = Date.now();

				if (
					lastActivity > 0 &&
					now - lastActivity >= CHAT_AWAY_RESET_TIMEOUT_MS
				) {
					const currentMsgs = Array.isArray(activeSession?.messages)
						? activeSession.messages
						: [];
					const hasUserMsgs = currentMsgs.some((m) => m && m.sender === "user");

					if (hasUserMsgs) {
						try {
							const { newSession, sessions: updated } = createNewSession();
							setSessions(updated);
							setActiveSessionIdState(newSession.id);
						} catch (err) {
							console.error(
								"Error auto-creating new chat session after visibility timeout:",
								err,
							);
						}
					}
				}

				recordChatActivity();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [isActive, activeSession?.messages, recordChatActivity]);

	const [editingMessageId, setEditingMessageId] = useState(null);
	const [editText, setEditText] = useState("");
	const [hasInputContent, setHasInputContent] = useState(false);
	const [previewImageModal, setPreviewImageModal] = useState(null);

	const heroEditorRef = useRef(null);
	const activeEditorRef = useRef(null);
	const attachedFilesMapRef = useRef({});
	const [, setContextTick] = useState(0);

	useEffect(() => {
		const handleContextUpdate = () => {
			setContextTick((prev) => prev + 1);
		};
		window.addEventListener(APP_EVENTS.RECORDS_UPDATED, handleContextUpdate);
		window.addEventListener(
			APP_EVENTS.NAFL_RECORDS_UPDATED,
			handleContextUpdate,
		);
		window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleContextUpdate);
		window.addEventListener(
			APP_EVENTS.PRAYER_TIMES_UPDATED,
			handleContextUpdate,
		);

		return () => {
			window.removeEventListener(
				APP_EVENTS.RECORDS_UPDATED,
				handleContextUpdate,
			);
			window.removeEventListener(
				APP_EVENTS.NAFL_RECORDS_UPDATED,
				handleContextUpdate,
			);
			window.removeEventListener(
				APP_EVENTS.SETTINGS_UPDATED,
				handleContextUpdate,
			);
			window.removeEventListener(
				APP_EVENTS.PRAYER_TIMES_UPDATED,
				handleContextUpdate,
			);
		};
	}, []);

	useEffect(() => {
		const handler = (e) => {
			if (e.detail) {
				setPreviewImageModal(e.detail);
			}
		};
		window.addEventListener("preview-chat-image", handler);
		return () => window.removeEventListener("preview-chat-image", handler);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && previewImageModal) {
				setPreviewImageModal(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [previewImageModal]);

	const [isLoading, setIsLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [typingState, setTypingState] = useState("hidden"); // 'hidden', 'visible', 'exiting'
	const [correctingMsgId, setCorrectingMsgId] = useState(null);
	const [errorMessage, setErrorMessage] = useState(null);
	const [feedbackMap, setFeedbackMap] = useState({});
	const [copiedMsgId, setCopiedMsgId] = useState(null);
	const [hoveredInfoMsgId, setHoveredInfoMsgId] = useState(null);
	const messagesEndRef = useRef(null);
	const fileInputRef = useRef(null);
	const typewriterIntervalRef = useRef(null);
	const pauseResumeCallbackRef = useRef(null);
	const abortControllerRef = useRef(null);

	// Smooth GPU Entrance & Exit Animation Lifecycle for Typing Indicator (AGENTS.md Invariant 13)
	useEffect(() => {
		let timer;
		if (isLoading) {
			setTypingState("visible");
		} else {
			setTypingState((prev) => {
				if (prev === "visible") {
					timer = setTimeout(() => {
						setTypingState("hidden");
					}, 280);
					return "exiting";
				}
				return "hidden";
			});
		}
		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [isLoading]);

	const hasGeminiKey = Boolean(
		settings && settings.geminiApiKey && settings.geminiApiKey.trim(),
	);

	const scrollToBottom = () => {
		try {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		} catch {
			// Ignore scroll errors
		}
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages.length, isLoading, isStreaming]);

	useEffect(() => {
		return () => {
			if (typewriterIntervalRef.current) {
				clearTimeout(typewriterIntervalRef.current);
				clearInterval(typewriterIntervalRef.current);
			}
			if (abortControllerRef.current) abortControllerRef.current.abort();
		};
	}, []);

	const handleTogglePauseResume = () => {
		if (!isStreaming) return;

		if (!isPaused) {
			if (typewriterIntervalRef.current) {
				clearTimeout(typewriterIntervalRef.current);
				typewriterIntervalRef.current = null;
			}
			setIsPaused(true);
		} else {
			setIsPaused(false);
			if (pauseResumeCallbackRef.current) {
				typewriterIntervalRef.current = setTimeout(
					pauseResumeCallbackRef.current,
					60,
				);
			}
		}
	};

	const handleStopGeneration = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		if (typewriterIntervalRef.current) {
			clearTimeout(typewriterIntervalRef.current);
			clearInterval(typewriterIntervalRef.current);
			typewriterIntervalRef.current = null;
		}
		pauseResumeCallbackRef.current = null;
		setIsPaused(false);

		let latestFinalMsgs = [];
		setSessions((prevSessions) => {
			return prevSessions.map((s) => {
				if (s.id === activeSession.id) {
					const finalized = (s.messages || []).map((m) =>
						m.isTyping ? { ...m, isTyping: false } : m,
					);
					updateSessionMessages(s.id, finalized);
					latestFinalMsgs = finalized;
					return { ...s, messages: finalized };
				}
				return s;
			});
		});

		setIsLoading(false);
		setIsStreaming(false);

		const pendingIdx = latestFinalMsgs.findIndex(
			(m) => m && m.sender === "user" && m.status === "pending",
		);
		if (pendingIdx >= 0) {
			const pendingMsg = latestFinalMsgs[pendingIdx];
			const priorHistory = latestFinalMsgs.slice(0, pendingIdx);
			setTimeout(() => {
				handleProcessPendingMessage(pendingMsg, priorHistory);
			}, 320);
		}
	};

	const streamAssistantResponse = (rawFullText, baseMessages, msgMetadata) => {
		if (typewriterIntervalRef.current) {
			clearTimeout(typewriterIntervalRef.current);
			clearInterval(typewriterIntervalRef.current);
			typewriterIntervalRef.current = null;
		}
		setIsPaused(false);
		pauseResumeCallbackRef.current = null;

		const { cleanText, action } = extractMuneerAction(rawFullText);
		const textToStream = cleanText || rawFullText;

		if (action) {
			executeSettingsActionDirectly(action, onSettingsSaved);
		}

		setIsStreaming(true);
		const msgId = msgMetadata.id || (Date.now() + 1).toString();

		const tokens = textToStream.match(/\S+\s*|\s+/g) || [textToStream];
		const totalTokens = tokens.length;
		let currentTokenIndex = 0;

		const initialAssistantMsg = {
			...msgMetadata,
			id: msgId,
			sender: "assistant",
			text: "",
			action: action || null,
			actionStatus: "applied",
			isTyping: true,
		};

		const existsIndex = baseMessages.findIndex((m) => m.id === msgId);
		let currentList =
			existsIndex >= 0
				? baseMessages.map((m) => (m.id === msgId ? initialAssistantMsg : m))
				: [...baseMessages, initialAssistantMsg];

		setSessions((prevSessions) =>
			prevSessions.map((s) =>
				s.id === activeSession.id ? { ...s, messages: currentList } : s,
			),
		);

		const typeNext = () => {
			if (currentTokenIndex >= totalTokens) {
				if (typewriterIntervalRef.current) {
					clearTimeout(typewriterIntervalRef.current);
					typewriterIntervalRef.current = null;
				}
				pauseResumeCallbackRef.current = null;
				setIsStreaming(false);
				setIsPaused(false);

				const completedMsg = {
					...msgMetadata,
					id: msgId,
					sender: "assistant",
					text: textToStream,
					action: action || null,
					isTyping: false,
				};

				const finalMsgs = currentList.map((m) =>
					m.id === msgId ? completedMsg : m,
				);
				const saved = updateSessionMessages(activeSession.id, finalMsgs);
				setSessions([...saved]);
				setTimeout(scrollToBottom, 40);

				const nextPendingIdx = finalMsgs.findIndex(
					(m) => m && m.sender === "user" && m.status === "pending",
				);
				if (nextPendingIdx >= 0) {
					const nextPendingMsg = finalMsgs[nextPendingIdx];
					const priorHistory = finalMsgs.slice(0, nextPendingIdx);
					setTimeout(() => {
						handleProcessPendingMessage(nextPendingMsg, priorHistory);
					}, 350);
				}
				return;
			}

			currentTokenIndex += 1;
			const currentToken = tokens[currentTokenIndex - 1] || "";

			const partialText = tokens.slice(0, currentTokenIndex).join("");
			currentList = currentList.map((m) =>
				m.id === msgId
					? { ...m, text: partialText, action: action || null, isTyping: true }
					: m,
			);

			setSessions((prevSessions) =>
				prevSessions.map((s) =>
					s.id === activeSession.id ? { ...s, messages: currentList } : s,
				),
			);
			scrollToBottom();

			const minDelay = 20;
			const maxDelay = 45;
			let nextDelayMs =
				Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

			if (currentTokenIndex < totalTokens) {
				if (/[.؟?!…]/.test(currentToken)) {
					nextDelayMs += 100;
				} else if (/[،,؛;:]/.test(currentToken)) {
					nextDelayMs += 50;
				}
			}

			typewriterIntervalRef.current = setTimeout(typeNext, nextDelayMs);
		};

		pauseResumeCallbackRef.current = typeNext;
		typewriterIntervalRef.current = setTimeout(typeNext, 80);
	};

	const handleSelectSession = (id) => {
		const currentList = getChatSessions();
		const cleaned = currentList.filter((s) => {
			const hasMsgs = Array.isArray(s.messages) && s.messages.length > 0;
			return hasMsgs || s.id === id;
		});
		const finalSessions = cleaned.length > 0 ? cleaned : [currentList[0]];
		saveChatSessions(finalSessions);
		setSessions(finalSessions);
		setActiveSessionIdState(id);
		saveActiveSessionId(id);
	};

	const handleCreateNewSession = () => {
		if (isCurrentChatEmpty) return;
		try {
			const { newSession, sessions: updated } = createNewSession();
			setSessions(updated);
			setActiveSessionIdState(newSession.id);
		} catch (e) {
			console.error("Error creating new session:", e);
		}
	};

	const handleDeleteCurrentSession = () => {
		try {
			if (validSessions.length <= 1) {
				const updated = updateSessionMessages(activeSession.id, []);
				setSessions([...updated]);
				return;
			}

			const updated = deleteSession(activeSession.id);
			setSessions(updated.sessions || updated);
			if (updated.activeId) {
				setActiveSessionIdState(updated.activeId);
				saveActiveSessionId(updated.activeId);
			}
		} catch (e) {
			console.error("Error deleting session:", e);
		}
	};

	const handleDeleteSessionById = (e, sessionId) => {
		if (e) e.stopPropagation();
		try {
			if (validSessions.length <= 1) {
				const updated = updateSessionMessages(sessionId, []);
				setSessions([...updated]);
				return;
			}

			const updated = deleteSession(sessionId);
			const sessionList = updated.sessions || updated;
			setSessions(sessionList);
			if (activeSession.id === sessionId && updated.activeId) {
				setActiveSessionIdState(updated.activeId);
				saveActiveSessionId(updated.activeId);
			}
		} catch (err) {
			console.error("Error deleting session by id:", err);
		}
	};

	const handleResetAllChats = () => {
		if (
			window.confirm(
				"هل أنت متأكد من رغبتك في مسح كافة سجلات المحادثات الذكية والبدء من جديد؟",
			)
		) {
			try {
				const resetData = resetChatSessions();
				setSessions(resetData);
				if (resetData.length > 0) {
					setActiveSessionIdState(resetData[0].id);
					saveActiveSessionId(resetData[0].id);
				}
			} catch (e) {
				console.error("Error resetting chat sessions:", e);
			}
		}
	};

	const handleFileUpload = (e) => {
		const files = Array.from(e.target.files || []);
		if (!files.length) return;

		try {
			const isHero = !messages.some((m) => m.sender === "user");
			const targetEditor = isHero
				? heroEditorRef.current
				: activeEditorRef.current;

			files.forEach((file) => {
				if (file.type && file.type.startsWith("image/")) {
					compressImageFile(file, 1000, 1000, 0.7).then((compressedContent) => {
						const fileObj = {
							id:
								"file_" +
								Date.now() +
								"_" +
								Math.random().toString(36).substr(2, 4),
							name: file.name,
							size: (file.size / 1024).toFixed(1) + " KB",
							type: file.type || "image/png",
							isImage: true,
							content:
								typeof compressedContent === "string" ? compressedContent : "",
						};

						attachedFilesMapRef.current[fileObj.id] = fileObj;
						if (targetEditor) {
							insertFileChipToEditor(
								targetEditor,
								fileObj,
								attachedFilesMapRef,
								setHasInputContent,
							);
						}
					});
				} else {
					const reader = new FileReader();
					reader.onload = (event) => {
						const content = event.target?.result;
						const fileObj = {
							id:
								"file_" +
								Date.now() +
								"_" +
								Math.random().toString(36).substr(2, 4),
							name: file.name,
							size: (file.size / 1024).toFixed(1) + " KB",
							type: file.type || "ملف",
							isImage: false,
							content: typeof content === "string" ? content : "",
						};

						attachedFilesMapRef.current[fileObj.id] = fileObj;
						if (targetEditor) {
							insertFileChipToEditor(
								targetEditor,
								fileObj,
								attachedFilesMapRef,
								setHasInputContent,
							);
						}
					};
					reader.readAsText(file);
				}
			});

			if (fileInputRef.current) fileInputRef.current.value = "";
		} catch (err) {
			console.error("File upload error:", err);
		}
	};

	const handleSend = async (textToSend, customPriorMessages = null) => {
		const baseMessages = Array.isArray(customPriorMessages)
			? customPriorMessages
			: messages;
		const isHero = !baseMessages.some((m) => m && m.sender === "user");
		const targetEditor = isHero
			? heroEditorRef.current
			: activeEditorRef.current;
		let extractedSegments = [];
		let query = "";
		let extractedFiles = [];

		if (textToSend) {
			query = textToSend;
			extractedSegments = [{ type: "text", value: textToSend }];
		} else if (targetEditor) {
			extractedSegments = extractSegmentsFromEditor(
				targetEditor,
				attachedFilesMapRef.current,
			);
			query = extractedSegments
				.filter((s) => s.type === "text")
				.map((s) => s.value)
				.join(" ");
			extractedFiles = extractedSegments
				.filter((s) => s.type === "file")
				.map((s) => s.file);
		}

		if (!query.trim() && extractedFiles.length === 0) return;

		if (!isOnline) {
			setErrorMessage(
				isEn
					? "AI Chat is locked in offline mode. Please connect to the internet to chat with Sheikh Muneer."
					: "محادثة الذكاء الاصطناعي مقفلة في وضع عدم الاتصال. يُرجى الاتصال بالإنترنت لبدء الحوار مع الشيخ منير.",
			);
			return;
		}

		if (!hasGeminiKey) {
			setErrorMessage(
				isEn
					? "Gemini API Key is required. Please go to Settings to add your key."
					: "مفتاح Gemini API غير مضاف. يُرجى الانتقال إلى الإعدادات وإدخال المفتاح أولاً.",
			);
			return;
		}

		if (isLoading || isStreaming) {
			const pendingUserMsg = {
				id: Date.now().toString(),
				sender: "user",
				text: query.trim() || "تحليل المحتوى المرفق",
				segments: extractedSegments,
				attachedFiles: extractedFiles,
				status: "pending",
				timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};

			const newMessages = [...baseMessages, pendingUserMsg];
			const updatedSessions = updateSessionMessages(
				activeSession.id,
				newMessages,
			);
			setSessions([...updatedSessions]);

			if (targetEditor) {
				targetEditor.innerHTML = "";
				setHasInputContent(false);
			}
			attachedFilesMapRef.current = {};
			return;
		}

		setErrorMessage(null);
		const userMsg = {
			id: Date.now().toString(),
			sender: "user",
			text: query.trim() || "تحليل المحتوى المرفق",
			segments: extractedSegments,
			attachedFiles: extractedFiles,
			timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
				hour: "2-digit",
				minute: "2-digit",
			}),
		};

		const newMessages = [...baseMessages, userMsg];
		const updatedSessions = updateSessionMessages(
			activeSession.id,
			newMessages,
		);
		setSessions([...updatedSessions]);

		if (targetEditor) {
			targetEditor.innerHTML = "";
			setHasInputContent(false);
		}
		attachedFilesMapRef.current = {};
		setIsLoading(true);

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const res = await sendGeminiChatMessage(
				settings.geminiApiKey,
				newMessages,
				query || "تحليل المحتوى المرفق",
				settings.tavilyApiKey,
				extractedFiles,
				controller.signal,
				extractedSegments,
			);

			abortControllerRef.current = null;
			setIsLoading(false);

			if (res && res.success) {
				await new Promise((r) => setTimeout(r, 280));

				const rawText =
					typeof res.text === "string" ? res.text : String(res.text || "");
				const msgMetadata = {
					id: (Date.now() + 1).toString(),
					sender: "assistant",
					usedSearch: Boolean(res.usedSearch),
					durationSeconds: res.durationSeconds
						? String(res.durationSeconds)
						: null,
					timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
						hour: "2-digit",
						minute: "2-digit",
					}),
				};

				streamAssistantResponse(rawText, newMessages, msgMetadata);
				handleCheckAndGenerateSessionTitle(newMessages, rawText);
			} else {
				setErrorMessage(res?.error || "حدث خطأ أثناء معالجة الطلب.");
			}
		} catch (err) {
			abortControllerRef.current = null;
			setIsLoading(false);
			if (err.name !== "AbortError") {
				setErrorMessage(`حدث خطأ غير متوقع: ${err.message}`);
			}
		}
	};

	const handleCheckAndGenerateSessionTitle = (
		sessionMsgs,
		incomingAssistantText,
	) => {
		if (!settings?.geminiApiKey || !activeSession?.id) return;

		const currentSession =
			validSessions.find((s) => s.id === activeSession.id) || activeSession;
		if (currentSession.titleFinalized) return;

		const assistantRepliesCount =
			sessionMsgs.filter((m) => m && m.sender === "assistant" && !m.isTyping)
				.length + 1;

		if (assistantRepliesCount === 1) {
			const isDefaultTitle =
				!currentSession?.title ||
				currentSession.title.startsWith("محادثة جديدة") ||
				currentSession.title.startsWith("محادثة رئيسية");

			if (isDefaultTitle) {
				const firstUser = sessionMsgs.find((m) => m && m.sender === "user");
				const userText = firstUser?.text || "محادثة";
				generateSessionTitle(
					settings.geminiApiKey,
					userText,
					incomingAssistantText,
				).then((initialTitle) => {
					if (initialTitle) {
						const updated = updateSessionTitle(
							activeSession.id,
							initialTitle,
							false,
						);
						setSessions(
							Array.isArray(updated) ? [...updated] : getChatSessions(),
						);
					}
				});
			}
		} else if (assistantRepliesCount === 5) {
			generateSessionContextualTitle(settings.geminiApiKey, sessionMsgs).then(
				(primaryTitle) => {
					if (primaryTitle) {
						const updated = updateSessionTitle(
							activeSession.id,
							primaryTitle,
							true,
						);
						setSessions(
							Array.isArray(updated) ? [...updated] : getChatSessions(),
						);
					}
				},
			);
		}
	};

	const handleCancelPendingMessage = (pendingMsgId) => {
		setSessions((prevSessions) => {
			return prevSessions.map((s) => {
				if (s.id === activeSession.id) {
					const filtered = (s.messages || []).filter(
						(m) => m.id !== pendingMsgId,
					);
					updateSessionMessages(s.id, filtered);
					return { ...s, messages: filtered };
				}
				return s;
			});
		});
	};

	const handleProcessPendingMessage = async (pendingMsg, priorHistory) => {
		if (!pendingMsg || !hasGeminiKey) return;

		const activeUserMsg = { ...pendingMsg, status: undefined };
		const currentSessionMsgs = [...priorHistory, activeUserMsg];

		setSessions((prevSessions) =>
			prevSessions.map((s) => {
				if (s.id === activeSession.id) {
					updateSessionMessages(s.id, currentSessionMsgs);
					return { ...s, messages: currentSessionMsgs };
				}
				return s;
			}),
		);

		setErrorMessage(null);
		setIsLoading(true);

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const res = await sendGeminiChatMessage(
				settings.geminiApiKey,
				currentSessionMsgs,
				activeUserMsg.text,
				settings.tavilyApiKey,
				activeUserMsg.attachedFiles || [],
				controller.signal,
				activeUserMsg.segments || [],
			);

			abortControllerRef.current = null;
			setIsLoading(false);

			if (res && res.success) {
				await new Promise((r) => setTimeout(r, 280));
				const rawText =
					typeof res.text === "string" ? res.text : String(res.text || "");
				const msgMetadata = {
					id: (Date.now() + 1).toString(),
					sender: "assistant",
					usedSearch: Boolean(res.usedSearch),
					durationSeconds: res.durationSeconds
						? String(res.durationSeconds)
						: null,
					timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
						hour: "2-digit",
						minute: "2-digit",
					}),
				};

				streamAssistantResponse(rawText, currentSessionMsgs, msgMetadata);
				handleCheckAndGenerateSessionTitle(currentSessionMsgs, rawText);
			} else {
				setErrorMessage(res?.error || "حدث خطأ أثناء معالجة الطلب.");
			}
		} catch (err) {
			abortControllerRef.current = null;
			setIsLoading(false);
			if (err.name !== "AbortError") {
				setErrorMessage(`حدث خطأ غير متوقع: ${err.message}`);
			}
		}
	};

	const handleRegenerateResponse = async (assistantMsgId) => {
		if (isLoading || isStreaming || !hasGeminiKey) return;
		const msgIdx = messages.findIndex((m) => m.id === assistantMsgId);
		if (msgIdx < 0) return;

		const historyUpToTarget = messages.slice(0, msgIdx);
		const targetUserMsg = historyUpToTarget[historyUpToTarget.length - 1];

		const queryText = targetUserMsg
			? typeof targetUserMsg.text === "string"
				? targetUserMsg.text
				: String(targetUserMsg.text || "")
			: "إعادة توليد الإجابة";
		const filesForApi = targetUserMsg?.attachedFiles || [];
		const segmentsForApi = targetUserMsg?.segments || [];

		const updatedSessions = updateSessionMessages(
			activeSession.id,
			historyUpToTarget,
		);
		setSessions([...updatedSessions]);

		setErrorMessage(null);
		setIsLoading(true);

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const res = await sendGeminiChatMessage(
				settings.geminiApiKey,
				historyUpToTarget,
				queryText,
				settings.tavilyApiKey,
				filesForApi,
				controller.signal,
				segmentsForApi,
			);

			abortControllerRef.current = null;
			setIsLoading(false);

			if (res && res.success) {
				await new Promise((r) => setTimeout(r, 280));

				const rawText =
					typeof res.text === "string" ? res.text : String(res.text || "");
				const msgMetadata = {
					id: (Date.now() + 1).toString(),
					sender: "assistant",
					usedSearch: Boolean(res.usedSearch),
					durationSeconds: res.durationSeconds
						? String(res.durationSeconds)
						: null,
					timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
						hour: "2-digit",
						minute: "2-digit",
					}),
					isRegenerated: true,
				};

				streamAssistantResponse(rawText, historyUpToTarget, msgMetadata);
			} else {
				setErrorMessage(res?.error || "تعذر إعادة التوليد.");
			}
		} catch (err) {
			abortControllerRef.current = null;
			setIsLoading(false);
			if (err.name !== "AbortError") {
				setErrorMessage(`حدث خطأ أثناء إعادة التوليد: ${err.message}`);
			}
		}
	};

	const handleResendUserMessage = (msg) => {
		if (!msg || isLoading || isStreaming) return;
		const msgIdx = messages.findIndex((m) => m.id === msg.id);
		if (msgIdx < 0) return;

		const priorMessages = messages.slice(0, msgIdx);
		const textToSend =
			typeof msg.text === "string" ? msg.text : String(msg.text || "");
		if (
			!textToSend.trim() &&
			(!msg.attachedFiles || msg.attachedFiles.length === 0)
		)
			return;

		if (Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0) {
			msg.attachedFiles.forEach((f) => {
				if (f && f.id) attachedFilesMapRef.current[f.id] = f;
			});
		}
		handleSend(textToSend, priorMessages);
	};

	const handleDeleteMessage = (msgId) => {
		const filtered = messages.filter((m) => m && m.id !== msgId);
		const updated = updateSessionMessages(activeSession.id, filtered);
		setSessions([...updated]);
	};

	const handleCorrectSpelling = async (msg) => {
		if (!msg || correctingMsgId) return;
		const currentApiKey = (
			settings?.geminiApiKey ||
			getSettings()?.geminiApiKey ||
			""
		).trim();
		if (!currentApiKey) {
			alert(
				"يرجى إضافة مفتاح Gemini API في الإعدادات أولاً لتفعيل التدقيق الإملائي بالذكاء الاصطناعي.",
			);
			return;
		}
		let originalText =
			typeof msg.text === "string" ? msg.text : String(msg.text || "");
		if (!originalText.trim() && Array.isArray(msg.segments)) {
			originalText = msg.segments
				.filter((s) => s.type === "text")
				.map((s) => s.value)
				.join(" ");
		}
		if (!originalText.trim()) return;

		setCorrectingMsgId(msg.id);
		try {
			const corrected = await correctSpellingText(currentApiKey, originalText);
			if (
				corrected &&
				corrected.trim() &&
				corrected.trim() !== originalText.trim()
			) {
				const finalText = corrected.trim();
				let updatedSegments = null;
				if (Array.isArray(msg.segments) && msg.segments.length > 0) {
					const files = msg.segments.filter((s) => s.type === "file");
					updatedSegments = [{ type: "text", value: finalText }, ...files];
				}

				const updatedMsgs = messages.map((m) =>
					m.id === msg.id
						? {
								...m,
								text: finalText,
								segments: updatedSegments || m.segments,
								isEdited: true,
							}
						: m,
				);

				const saved = updateSessionMessages(activeSession.id, updatedMsgs);
				setSessions([...saved]);
			}
		} catch (err) {
			console.warn("Spell correction failed:", err);
		} finally {
			setCorrectingMsgId(null);
		}
	};

	const handleStartEditMessage = (msg) => {
		if (!msg) return;
		setEditingMessageId(msg.id);
		setEditText(
			typeof msg.text === "string" ? msg.text : String(msg.text || ""),
		);
	};

	const handleSaveEditedMessage = (msgId) => {
		if (!editText.trim() || isLoading || isStreaming) return;
		const targetIdx = messages.findIndex((m) => m && m.id === msgId);
		if (targetIdx < 0) return;

		const priorMessages = messages.slice(0, targetIdx);
		const textToSend = editText.trim();

		setEditingMessageId(null);
		setEditText("");

		handleSend(textToSend, priorMessages);
	};

	const handleToggleFeedback = (msgId, type) => {
		setFeedbackMap((prev) => ({
			...prev,
			[msgId]: prev[msgId] === type ? null : type,
		}));
	};

	const handleCopyMessage = async (msgId, text) => {
		try {
			const { cleanText } = extractMuneerAction(text);
			await navigator.clipboard.writeText(cleanText || text);
			setCopiedMsgId(msgId);
			setTimeout(() => {
				setCopiedMsgId((prev) => (prev === msgId ? null : prev));
			}, 2000);
		} catch (e) {
			console.warn("Clipboard write failed:", e);
		}
	};

	const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

	useEffect(() => {
		if (isHistoryModalOpen) {
			const fresh = getChatSessions();
			setSessions(fresh);
		}
	}, [isHistoryModalOpen]);

	const handleQuickTagClick = (prompt) => {
		handleSend(prompt);
	};

	return (
		<GlassViewShell width="wide" className="chat-view">
			<div className="chat-layout">
				{/* Main Active Chat Area */}
				<div
					className={`chat-main ${messages.some((m) => m.sender === "user") ? "active-mode" : "hero-mode"}`}
					style={{ position: "relative" }}
				>
					{!messages.some((m) => m.sender === "user") ? (
						/* Gemini-Style Centered Hero Landing View */
						<div
							style={{
								flex: 1,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								padding: "48px 36px",
								gap: "24px",
								width: "100%",
							}}
						>
							{/* Centered Salam SVG Headline */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									width: "100%",
									maxWidth: "560px",
									margin: "0 auto 10px auto",
								}}
							>
								<img
									src="/salam.svg"
									alt="السلام"
									style={{
										width: "100%",
										maxWidth: "520px",
										height: "auto",
										objectFit: "contain",
										filter: "drop-shadow(0 4px 24px rgba(0, 0, 0, 0.75))",
										userSelect: "none",
										pointerEvents: "none",
									}}
								/>
							</div>

							{/* Centered Hero Input Capsule */}
							<ChatInputBar
								variant="hero"
								isOnline={isOnline}
								hasGeminiKey={hasGeminiKey}
								isLoading={isLoading}
								isStreaming={isStreaming}
								isPaused={isPaused}
								hasInputContent={hasInputContent}
								setHasInputContent={setHasInputContent}
								onSend={handleSend}
								onStopGeneration={handleStopGeneration}
								onTogglePauseResume={handleTogglePauseResume}
								onFileUpload={handleFileUpload}
								onNavigateToSettings={onNavigateToSettings}
								editorRef={heroEditorRef}
								attachedFilesMapRef={attachedFilesMapRef}
								fileInputRef={fileInputRef}
								isEn={isEn}
							/>

							{/* Generating Suggestions Loading Indicator */}
							{isGeneratingSuggestions &&
								(!Array.isArray(dailySuggestions) ||
									dailySuggestions.length === 0) && (
									<div
										style={{
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "10px",
											padding: "8px 22px",
											borderRadius: "var(--radius-pill)",
											backgroundColor: "rgba(255, 255, 255, 0.04)",
											border: "1px solid rgba(255, 255, 255, 0.1)",
											color: "var(--text-muted)",
											fontSize: "0.82rem",
											animation: "fadeIn 0.25s ease-out",
										}}
									>
										<span style={{ opacity: 0.85 }}>
											{isEn
												? "Crafting daily suggestions"
												: "جاري صياغة أسئلة واقتراحات اليوم"}
										</span>
										<div
											style={{
												display: "inline-flex",
												gap: "5px",
												alignItems: "center",
											}}
										>
											<span className="typing-dot" />
											<span className="typing-dot" />
											<span className="typing-dot" />
										</div>
									</div>
								)}

							{/* Quick Dynamic Suggestion Prompt Cards */}
							{Array.isArray(dailySuggestions) &&
								dailySuggestions.length > 0 &&
								!isGeneratingSuggestions && (
									<div
										style={{
											display: "flex",
											flexWrap: "wrap",
											gap: "10px",
											justifyContent: "center",
											maxWidth: "740px",
											alignItems: "center",
										}}
									>
										{dailySuggestions.map((promptText, idx) => (
											<Button
												key={idx}
												type="button"
												variant="secondary"
												size="small"
												onClick={() => handleQuickTagClick(promptText)}
												style={{
													borderRadius: "var(--radius-pill)",
												}}
											>
												<span>{promptText}</span>
											</Button>
										))}
									</div>
								)}

							{/* Centered Actions: History & New Chat Buttons */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: "10px",
									marginTop: "8px",
								}}
							>
								<Button
									type="button"
									variant="secondary"
									size="small"
									onClick={() => setIsHistoryModalOpen(true)}
									style={{
										borderRadius: "var(--radius-pill)",
									}}
									id="open-history-modal-btn"
									title={
										isEn
											? "View and manage chat history"
											: "عرض وإدارة سجل المحادثات السابقة"
									}
								>
									<History size={14} />
									<span>{isEn ? "Chat History" : "سجل المحادثات"}</span>
								</Button>

								<Button
									type="button"
									variant="primary"
									size="small"
									onClick={handleCreateNewSession}
									disabled={isCurrentChatEmpty}
									style={{
										borderRadius: "var(--radius-pill)",
									}}
									id="new-chat-btn"
									title={
										isCurrentChatEmpty
											? isEn
												? "Current chat is already empty"
												: "المحادثة الحالية فارغة بالفعل"
											: isEn
												? "Start a new conversation"
												: "بدء محادثة جديدة"
									}
								>
									<Plus size={14} />
									<span>{isEn ? "New Chat" : "محادثة جديدة"}</span>
								</Button>
							</div>
						</div>
					) : (
						<>
							{/* Active Chat Top Header Bar */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "flex-end",
									padding: "12px 20px",
									borderBottom: "none",
									backgroundColor: "transparent",
									flexShrink: 0,
								}}
							>
								<div
									style={{ display: "flex", alignItems: "center", gap: "8px" }}
								>
									<Button
										type="button"
										variant="secondary"
										size="small"
										onClick={() => setIsHistoryModalOpen(true)}
										style={{
											borderRadius: "var(--radius-pill)",
										}}
										id="active-open-history-btn"
										title={isEn ? "View chat history" : "عرض سجل المحادثات"}
									>
										<History size={13} />
										<span>{isEn ? "Chat History" : "سجل المحادثات"}</span>
									</Button>

									<Button
										type="button"
										variant="primary"
										size="small"
										onClick={handleCreateNewSession}
										disabled={isCurrentChatEmpty}
										style={{
											borderRadius: "var(--radius-pill)",
										}}
										id="active-new-chat-btn"
										title={
											isCurrentChatEmpty
												? isEn
													? "Current chat is already empty"
													: "المحادثة الحالية فارغة بالفعل"
												: isEn
													? "Start a new conversation"
													: "بدء محادثة جديدة"
										}
									>
										<Plus size={13} />
										<span>{isEn ? "New Chat" : "محادثة جديدة"}</span>
									</Button>
								</div>
							</div>

							{/* Chat Messages Window */}
							<ChatMessageList
								messages={messages}
								typingState={typingState}
								isLoading={isLoading}
								isStreaming={isStreaming}
								errorMessage={errorMessage}
								editingMessageId={editingMessageId}
								setEditingMessageId={setEditingMessageId}
								editText={editText}
								setEditText={setEditText}
								correctingMsgId={correctingMsgId}
								copiedMsgId={copiedMsgId}
								feedbackMap={feedbackMap}
								hoveredInfoMsgId={hoveredInfoMsgId}
								setHoveredInfoMsgId={setHoveredInfoMsgId}
								messagesEndRef={messagesEndRef}
								handleCancelPendingMessage={handleCancelPendingMessage}
								handleSaveEditedMessage={handleSaveEditedMessage}
								handleStartEditMessage={handleStartEditMessage}
								handleCorrectSpelling={handleCorrectSpelling}
								handleResendUserMessage={handleResendUserMessage}
								handleCopyMessage={handleCopyMessage}
								handleDeleteMessage={handleDeleteMessage}
								handleToggleFeedback={handleToggleFeedback}
								handleRegenerateResponse={handleRegenerateResponse}
								settings={settings}
								isEn={isEn}
							/>

							{/* Floating Streamlined Bottom Input Area */}
							<div
								style={{
									position: "absolute",
									bottom: 0,
									left: 0,
									right: 0,
									zIndex: 10,
									padding: "16px 20px 16px 20px",
									background: "transparent",
									borderTop: "none",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: "8px",
									width: "100%",
									pointerEvents: "none",
								}}
							>
								<ChatInputBar
									variant="active"
									isOnline={isOnline}
									hasGeminiKey={hasGeminiKey}
									isLoading={isLoading}
									isStreaming={isStreaming}
									isPaused={isPaused}
									hasInputContent={hasInputContent}
									setHasInputContent={setHasInputContent}
									onSend={handleSend}
									onStopGeneration={handleStopGeneration}
									onTogglePauseResume={handleTogglePauseResume}
									onFileUpload={handleFileUpload}
									onNavigateToSettings={onNavigateToSettings}
									editorRef={activeEditorRef}
									attachedFilesMapRef={attachedFilesMapRef}
									fileInputRef={fileInputRef}
									isEn={isEn}
								/>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Chat History & Sessions Drawer Modal */}
			<ChatSessionDrawer
				isOpen={isHistoryModalOpen}
				onClose={() => setIsHistoryModalOpen(false)}
				sessions={validSessions}
				activeSessionId={activeSession.id}
				onSelectSession={handleSelectSession}
				onCreateNewSession={handleCreateNewSession}
				onDeleteSessionById={handleDeleteSessionById}
				onDeleteCurrentSession={handleDeleteCurrentSession}
				onResetAllChats={handleResetAllChats}
				isEn={isEn}
			/>

			{/* High-Resolution Image Lightbox Modal */}
			<ImagePreviewModal
				file={previewImageModal}
				onClose={() => setPreviewImageModal(null)}
				isEn={isEn}
			/>
		</GlassViewShell>
	);
}
