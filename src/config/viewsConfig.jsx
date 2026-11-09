import {
	BookOpen,
	Calendar,
	Headphones,
	MessageSquare,
	Settings,
} from "lucide-react";
import React from "react";
import AudioPlayerView from "../components/AudioPlayerView";
import BookReaderView from "../components/BookReaderView";
import ChatView from "../components/ChatView";
import PrayerTrackerView from "../components/PrayerTrackerView";
import SettingsView from "../components/SettingsView";
import TasbeehIcon from "../components/TasbeehIcon.jsx";
import TasbeehView from "../components/TasbeehView";

/**
 * Single Source of Truth (SSOT) configuration for all Application Pages / Views.
 * Any modification to page ordering, shortcuts, titles, icons, or component rendering
 * is managed exclusively in this unified configuration.
 */
export const APP_VIEWS = [
	{
		id: "tracker",
		shortcut: "1",
		icon: Calendar,
		titleAr: "تتبع الصلوات",
		titleEn: "Prayer Tracker",
		render: (props) => (
			<PrayerTrackerView
				settings={props.settings}
				onRecordUpdated={props.handleRecordUpdated}
				isAudioMuted={props.isAudioMuted}
				onToggleAudio={props.handleToggleAudio}
				onNavigateToSettings={() => props.handleNavigateTab("settings")}
			/>
		),
	},
	{
		id: "chat",
		shortcut: "2",
		icon: MessageSquare,
		titleAr: "الدردشة الذكية",
		titleEn: "AI Chat",
		offlineNoticeAr: "الدردشة الذكية (تصفح المحادثات السابقة - بدون إنترنت)",
		offlineNoticeEn: "AI Chat (Past History Available - Offline)",
		render: (props) => (
			<ChatView
				settings={props.settings}
				onNavigateToSettings={() => props.handleNavigateTab("settings")}
				onSettingsSaved={props.handleSettingsSaved}
				isActive={props.activeTab === "chat"}
				isOnline={props.isOnline}
			/>
		),
	},
	{
		id: "books",
		shortcut: "3",
		icon: BookOpen,
		titleAr: "ورد القراءة وقارئ الكتب",
		titleEn: "Book Reader & Daily Ward",
		render: (props) => (
			<BookReaderView
				key="book-reader-view"
				settings={props.settings}
				onStartReading={props.handleStartReading}
				onExitReading={props.handleExitReading}
				isReaderActive={props.isReaderActive}
				setIsReaderActive={props.setIsReaderActive}
			/>
		),
	},
	{
		id: "tasbeeh",
		shortcut: "4",
		icon: TasbeehIcon,
		titleAr: "المسبحة الإلكترونية والأذكار",
		titleEn: "Electronic Tasbeeh & Dhikr",
		render: (props) => (
			<TasbeehView
				settings={props.settings}
				isActive={props.activeTab === "tasbeeh"}
			/>
		),
	},
	{
		id: "audio",
		shortcut: "5",
		icon: Headphones,
		titleAr: "مشغل الصوتيات والمكتبة",
		titleEn: "Audio Library & Player",
		render: (props) => (
			<AudioPlayerView
				settings={props.settings}
				isActive={props.activeTab === "audio"}
			/>
		),
	},
	{
		id: "settings",
		shortcut: "6",
		icon: Settings,
		titleAr: "الإعدادات العامة",
		titleEn: "Settings",
		render: (props) => (
			<SettingsView
				settings={props.settings}
				onSettingsSaved={props.handleSettingsSaved}
				isOnline={props.isOnline}
			/>
		),
	},
];

/**
 * Returns a key-to-viewId mapping for global keyboard shortcut listeners (e.g., { '1': 'tracker', '2': 'chat' }).
 */
export function getViewShortcutMap() {
	const map = {};
	APP_VIEWS.forEach((v) => {
		if (v.shortcut) {
			map[v.shortcut] = v.id;
		}
	});
	return map;
}

/**
 * Returns formatted navigation shortcut items for documentation / modal display.
 */
export function getNavigationShortcutsList(isEn = false) {
	return APP_VIEWS.map((v) => ({
		labelAr: v.titleAr,
		labelEn: v.titleEn,
		key: v.shortcut,
	}));
}

/**
 * Returns localized title of a view.
 */
export function getViewTitle(view, lang = "ar") {
	return lang === "en" ? view.titleEn : view.titleAr;
}
