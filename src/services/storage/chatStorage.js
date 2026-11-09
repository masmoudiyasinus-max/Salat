import { safeSetLocalStorageItem } from "./storageCore.js";
import { KEYS } from "./storageKeys.js";

export function createInitialChatSession() {
	return {
		id: "session_default",
		title: "محادثة رئيسية",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		messages: [],
	};
}

export function sanitizeChatSessions(sessions) {
	if (!Array.isArray(sessions) || sessions.length === 0) {
		return [createInitialChatSession()];
	}
	return sessions.map((sess, sIdx) => ({
		id: sess.id || `session_${sIdx}_${Date.now()}`,
		title: typeof sess.title === "string" ? sess.title : "محادثة",
		createdAt: sess.createdAt || new Date().toISOString(),
		updatedAt: sess.updatedAt || new Date().toISOString(),
		messages: Array.isArray(sess.messages)
			? sess.messages
					.filter((m) => {
						const textVal =
							typeof m.text === "string" ? m.text : String(m.text || "");
						return (
							!textVal.includes("أهلاً بك! أنا الشيخ منير، رفيقك ومعينك") &&
							!textVal.includes("تم إعادة تهيئة المحادثة") &&
							!textVal.includes("Claude Opus 4.8 System Prompt")
						);
					})
					.map((m, mIdx) => {
						const textVal =
							typeof m.text === "string"
								? m.text
								: typeof m.text === "object" && m.text !== null
									? m.text.error || m.text.message || JSON.stringify(m.text)
									: String(m.text || "");

						return {
							id: m.id || `msg_${mIdx}_${Date.now()}`,
							sender: m.sender === "user" ? "user" : "assistant",
							text: textVal,
							attachedFiles: Array.isArray(m.attachedFiles)
								? m.attachedFiles
								: [],
							timestamp:
								m.timestamp ||
								new Date().toLocaleTimeString("en-US", {
									hour: "2-digit",
									minute: "2-digit",
									hour12: false,
								}),
							usedSearch: Boolean(m.usedSearch),
							durationSeconds: m.durationSeconds
								? String(m.durationSeconds)
								: null,
							isEdited: Boolean(m.isEdited),
							isRegenerated: Boolean(m.isRegenerated),
						};
					})
			: [],
	}));
}

export function getChatSessions() {
	const data = localStorage.getItem(KEYS.CHAT_SESSIONS);
	const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION_ID) || "";
	if (!data) {
		const defaultSession = createInitialChatSession();
		localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
		localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
		return [defaultSession];
	}
	try {
		const parsed = JSON.parse(data);
		let sanitized = sanitizeChatSessions(parsed);
		// Auto-purge any empty sessions (0 messages) that are not the currently active session
		sanitized = sanitized.filter((s) => {
			const hasMsgs = Array.isArray(s.messages) && s.messages.length > 0;
			return hasMsgs || s.id === activeId;
		});
		if (sanitized.length === 0) {
			sanitized = [createInitialChatSession()];
		}
		saveChatSessions(sanitized);
		return sanitized;
	} catch {
		const defaultSession = createInitialChatSession();
		localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
		localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
		return [defaultSession];
	}
}

export function resetChatSessions() {
	const defaultSession = createInitialChatSession();
	safeSetLocalStorageItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
	safeSetLocalStorageItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
	return [defaultSession];
}

export function saveChatSessions(sessions) {
	safeSetLocalStorageItem(KEYS.CHAT_SESSIONS, JSON.stringify(sessions), () => {
		// If quota exceeded, strip heavy binary image data from older sessions
		if (!Array.isArray(sessions)) return [createInitialChatSession()];
		const stripped = sessions.map((sess, sIdx) => {
			if (sIdx > 1) {
				return {
					...sess,
					messages: Array.isArray(sess.messages)
						? sess.messages.map((m) => ({
								...m,
								attachedFiles: (m.attachedFiles || []).map((f) => ({
									...f,
									content: "",
								})),
							}))
						: [],
				};
			}
			return sess;
		});
		return stripped;
	});
}

export function getActiveSessionId() {
	if (typeof localStorage === "undefined") return "";
	return localStorage.getItem(KEYS.ACTIVE_SESSION_ID) || "";
}

export function saveActiveSessionId(id) {
	safeSetLocalStorageItem(KEYS.ACTIVE_SESSION_ID, id);
}

export function createNewSession(customTitle = "") {
	let sessions = getChatSessions();
	// Auto-remove any empty sessions before adding a fresh session
	sessions = sessions.filter(
		(s) => Array.isArray(s.messages) && s.messages.length > 0,
	);
	const newId = "session_" + Date.now();
	const newSession = {
		id: newId,
		title:
			customTitle ||
			`محادثة جديدة ${new Date().toLocaleDateString("ar-EG-u-nu-latn")}`,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		messages: [],
	};

	const updated = [newSession, ...sessions];
	saveChatSessions(updated);
	saveActiveSessionId(newId);
	return { newSession, sessions: updated };
}

export function updateSessionMessages(sessionId, messages) {
	const sessions = getChatSessions();
	const idx = sessions.findIndex((s) => s.id === sessionId);
	if (idx >= 0) {
		let title = sessions[idx].title;
		const firstUserMsg = messages.find((m) => m.sender === "user");
		if (
			firstUserMsg &&
			!sessions[idx].titleFinalized &&
			(title.startsWith("محادثة جديدة") || title.startsWith("محادثة رئيسية"))
		) {
			const msgStr =
				typeof firstUserMsg.text === "string"
					? firstUserMsg.text
					: String(firstUserMsg.text || "");
			title = msgStr.slice(0, 30) + (msgStr.length > 30 ? "..." : "");
		}

		sessions[idx] = {
			...sessions[idx],
			title,
			messages,
			updatedAt: new Date().toISOString(),
		};
		saveChatSessions(sessions);
	}
	return sessions;
}

export function updateSessionTitle(sessionId, newTitle, isFinalized = false) {
	if (!sessionId || !newTitle || !newTitle.trim()) return getChatSessions();
	const sessions = getChatSessions();
	const idx = sessions.findIndex((s) => s.id === sessionId);
	if (idx >= 0) {
		sessions[idx] = {
			...sessions[idx],
			title: newTitle.trim(),
			titleFinalized: Boolean(isFinalized),
			updatedAt: new Date().toISOString(),
		};
		saveChatSessions(sessions);
	}
	return sessions;
}

export function deleteSession(sessionId) {
	let sessions = getChatSessions();
	sessions = sessions.filter((s) => s.id !== sessionId);

	if (sessions.length === 0) {
		const defaultSession = createInitialChatSession();
		sessions = [defaultSession];
	}

	saveChatSessions(sessions);
	saveActiveSessionId(sessions[0].id);
	return { activeId: sessions[0].id, sessions };
}
