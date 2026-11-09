import { Headphones, Music, Trash2, Upload } from "lucide-react";
import { Button, IconButton } from "open-glass-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GlassCard } from "../theme/OpenGlassEngine";
import {
	AUDIO_EVENTS,
	clearAudioLibraryDB,
	getAudioPlayerState,
	getAudioTrackBlob,
	getStoredAudioTracks,
	removeAudioTrack,
	saveAudioFilesToDB,
	saveAudioPlayerState,
	updateAudioTrackTitle,
} from "../services/audioStorage.js";

import AudioDropzoneEmptyState from "./audio/AudioDropzoneEmptyState";
import AudioPlayerDisk from "./audio/AudioPlayerDisk";
import AudioPlaylistDrawer from "./audio/AudioPlaylistDrawer";
import GlassViewShell from "./layout/GlassViewShell";

export default function AudioPlayerView({ settings }) {
	const isEn = settings?.language === "en";

	const [tracks, setTracks] = useState([]);
	const [activeTrackId, setActiveTrackId] = useState(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [repeatMode, setRepeatMode] = useState("all"); // 'off' | 'all' | 'one'
	const [isShuffle, setIsShuffle] = useState(false);
	const [isPlaylistExpanded, setIsPlaylistExpanded] = useState(true);
	const [folderName, setFolderName] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoadingFiles, setIsLoadingFiles] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitleValue, setEditTitleValue] = useState("");

	const audioRef = useRef(null);
	const fileInputRef = useRef(null);
	const blobUrlRef = useRef(null);
	const editInputRef = useRef(null);

	const isPlayingRef = useRef(isPlaying);
	isPlayingRef.current = isPlaying;

	// Load stored tracks and player preferences on boot
	const loadInitialData = useCallback(async () => {
		try {
			const storedTracks = await getStoredAudioTracks();
			setTracks(storedTracks);

			const savedState = getAudioPlayerState();
			setFolderName(savedState.folderName || "");
			setRepeatMode(savedState.repeatMode || "all");
			setIsShuffle(Boolean(savedState.isShuffle));
			setIsPlaylistExpanded(
				savedState.isPlaylistExpanded !== undefined
					? Boolean(savedState.isPlaylistExpanded)
					: true,
			);

			if (
				savedState.activeTrackId &&
				storedTracks.some((t) => t.id === savedState.activeTrackId)
			) {
				setActiveTrackId(savedState.activeTrackId);
			} else if (storedTracks.length > 0) {
				setActiveTrackId(storedTracks[0].id);
			}
		} catch {
			// Graceful fallback
		}
	}, []);

	useEffect(() => {
		loadInitialData();
	}, [loadInitialData]);

	// Load and prepare active track audio blob
	useEffect(() => {
		let isCancelled = false;

		async function loadAudioSource() {
			if (!activeTrackId) {
				if (audioRef.current) {
					audioRef.current.pause();
					audioRef.current.src = "";
				}
				return;
			}

			try {
				const blob = await getAudioTrackBlob(activeTrackId);
				if (isCancelled || !blob) return;

				// Revoke previous blob URL to prevent memory leaks
				if (blobUrlRef.current) {
					URL.revokeObjectURL(blobUrlRef.current);
				}

				const newUrl = URL.createObjectURL(blob);
				blobUrlRef.current = newUrl;

				if (audioRef.current) {
					const wasPlaying = isPlayingRef.current;
					audioRef.current.src = newUrl;
					audioRef.current.load();

					if (wasPlaying) {
						audioRef.current
							.play()
							.then(() => setIsPlaying(true))
							.catch(() => setIsPlaying(false));
					}
				}
			} catch {
				// Blob load error
			}
		}

		loadAudioSource();

		return () => {
			isCancelled = true;
		};
	}, [activeTrackId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
			}
		};
	}, []);

	// Save active track selection to state
	useEffect(() => {
		if (activeTrackId) {
			saveAudioPlayerState({ activeTrackId });
		}
	}, [activeTrackId]);

	// Active track object
	const activeTrack =
		tracks.find((t) => t.id === activeTrackId) || tracks[0] || null;
	const activeTrackIndex = tracks.findIndex((t) => t.id === activeTrackId);

	// Play / Pause Toggle
	const handleTogglePlay = useCallback(() => {
		if (!audioRef.current || !activeTrackId) return;

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
			window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STOPPED));
		} else {
			audioRef.current
				.play()
				.then(() => {
					setIsPlaying(true);
					window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STARTED));
				})
				.catch(() => {
					setIsPlaying(false);
				});
		}
	}, [isPlaying, activeTrackId]);

	// Next Track Handler
	const handleNextTrack = useCallback(() => {
		if (tracks.length === 0) return;

		let nextIndex = 0;
		if (isShuffle) {
			if (tracks.length > 1) {
				do {
					nextIndex = Math.floor(Math.random() * tracks.length);
				} while (nextIndex === activeTrackIndex);
			}
		} else {
			nextIndex = (activeTrackIndex + 1) % tracks.length;
		}

		setActiveTrackId(tracks[nextIndex].id);
		setIsPlaying(true);
	}, [tracks, activeTrackIndex, isShuffle]);

	// Previous Track Handler
	const handlePrevTrack = useCallback(() => {
		if (tracks.length === 0) return;

		// If more than 3 seconds in, restart current track
		if (currentTime > 3 && audioRef.current) {
			audioRef.current.currentTime = 0;
			return;
		}

		let prevIndex = 0;
		if (isShuffle) {
			if (tracks.length > 1) {
				do {
					prevIndex = Math.floor(Math.random() * tracks.length);
				} while (prevIndex === activeTrackIndex);
			}
		} else {
			prevIndex = (activeTrackIndex - 1 + tracks.length) % tracks.length;
		}

		setActiveTrackId(tracks[prevIndex].id);
		setIsPlaying(true);
	}, [tracks, activeTrackIndex, isShuffle, currentTime]);

	// Seek +/- 10 Seconds
	const handleSeekOffset = (seconds) => {
		if (!audioRef.current) return;
		const newTime = Math.max(
			0,
			Math.min(duration || 0, audioRef.current.currentTime + seconds),
		);
		audioRef.current.currentTime = newTime;
		setCurrentTime(newTime);
	};

	const handleSeekToRatio = (ratio) => {
		if (duration > 0 && audioRef.current) {
			const newTime = ratio * duration;
			audioRef.current.currentTime = newTime;
			setCurrentTime(newTime);
		}
	};

	// Repeat Mode Toggle
	const handleCycleRepeatMode = () => {
		const modes = ["all", "one", "off"];
		const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
		setRepeatMode(next);
		saveAudioPlayerState({ repeatMode: next });
	};

	// Shuffle Toggle
	const handleToggleShuffle = () => {
		const next = !isShuffle;
		setIsShuffle(next);
		saveAudioPlayerState({ isShuffle: next });
	};

	// Playlist Sidebar Expand/Collapse Toggle
	const handleTogglePlaylist = () => {
		const next = !isPlaylistExpanded;
		setIsPlaylistExpanded(next);
		saveAudioPlayerState({ isPlaylistExpanded: next });
	};

	// Focus and select input on editing start
	useEffect(() => {
		if (isEditingTitle && editInputRef.current) {
			editInputRef.current.focus();
			editInputRef.current.select();
		}
	}, [isEditingTitle]);

	// Handle start editing title
	const handleStartEditTitle = () => {
		if (!activeTrack) return;
		setEditTitleValue(activeTrack.title || activeTrack.name || "");
		setIsEditingTitle(true);
	};

	// Handle save title
	const handleSaveTitle = async () => {
		if (!activeTrack) return;
		const trimmed = editTitleValue.trim();
		if (!trimmed) {
			setIsEditingTitle(false);
			return;
		}

		setTracks((prev) =>
			prev.map((t) => (t.id === activeTrack.id ? { ...t, title: trimmed } : t)),
		);
		setIsEditingTitle(false);

		try {
			await updateAudioTrackTitle(activeTrack.id, trimmed);
		} catch {
			// Local state already updated
		}
	};

	// Handle cancel editing title
	const handleCancelEditTitle = () => {
		setIsEditingTitle(false);
		setEditTitleValue("");
	};

	// Track Ended Event Handler
	const handleTrackEnded = () => {
		if (repeatMode === "one") {
			if (audioRef.current) {
				audioRef.current.currentTime = 0;
				audioRef.current.play();
			}
		} else if (repeatMode === "all") {
			handleNextTrack();
		} else if (repeatMode === "off") {
			if (activeTrackIndex < tracks.length - 1) {
				handleNextTrack();
			} else {
				setIsPlaying(false);
				window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.PLAYBACK_STOPPED));
			}
		}
	};

	// Audio files selection via file picker input
	const handleFilesSelect = async (e) => {
		const fileList = e.target.files;
		if (!fileList || fileList.length === 0) return;

		setIsLoadingFiles(true);
		try {
			const filesArray = Array.from(fileList);
			const allTracks = await saveAudioFilesToDB(
				filesArray,
				isEn ? "Audio Library" : "المكتبة الصوتية",
			);
			setTracks(allTracks);
			if (allTracks.length > 0 && !activeTrackId) {
				setActiveTrackId(allTracks[0].id);
				setIsPlaying(false);
			}
		} catch {
			// Storage error
		} finally {
			setIsLoadingFiles(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	// Drag and Drop handlers
	const handleDragOver = (e) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = async (e) => {
		e.preventDefault();
		setIsDragging(false);
		const droppedFiles = e.dataTransfer?.files;
		if (!droppedFiles || droppedFiles.length === 0) return;

		setIsLoadingFiles(true);
		try {
			const filesArray = Array.from(droppedFiles);
			const allTracks = await saveAudioFilesToDB(
				filesArray,
				isEn ? "Audio Library" : "المكتبة الصوتية",
			);
			setTracks(allTracks);
			if (allTracks.length > 0 && !activeTrackId) {
				setActiveTrackId(allTracks[0].id);
			}
		} catch {
			// Storage error
		} finally {
			setIsLoadingFiles(false);
		}
	};

	// Delete track
	const handleDeleteTrack = async (e, trackId) => {
		e.stopPropagation();
		await removeAudioTrack(trackId);
		const updated = await getStoredAudioTracks();
		setTracks(updated);
		if (activeTrackId === trackId) {
			if (updated.length > 0) {
				setActiveTrackId(updated[0].id);
			} else {
				setActiveTrackId(null);
				setIsPlaying(false);
			}
		}
	};

	// Clear library
	const handleClearLibrary = async () => {
		const confirmMsg = isEn
			? "Are you sure you want to clear all audio files from the library?"
			: "هل أنت متأكد من رغبتك في تفريغ كافة الملفات الصوتية من المشغل؟";
		if (window.confirm(confirmMsg)) {
			await clearAudioLibraryDB();
			setTracks([]);
			setActiveTrackId(null);
			setFolderName("");
			setIsPlaying(false);
		}
	};

	// Filtered tracks for playlist search
	const filteredTracks = tracks.filter((t) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.trim().toLowerCase();
		return (
			(t.title && t.title.toLowerCase().includes(q)) ||
			(t.name && t.name.toLowerCase().includes(q))
		);
	});

	return (
		<GlassViewShell width="wide">
			<Glass
				as="section"
				material="regular"
				look={{
					blur: 1.4,
					opacity: 0.38,
					rim: 1.5,
					highlight: 1.6,
					lensing: 1.6,
					lightAngle: 340,
				}}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={{
					maxWidth: "1140px",
					width: "100%",
					height: "min(860px, calc(100dvh - 84px))",
					minHeight: "min(580px, calc(100dvh - 84px))",
					margin: "0 auto",
					padding: "24px 28px",
					borderRadius: "28px",
					border: "1px solid rgba(255, 255, 255, 0.16)",
					boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					boxSizing: "border-box",
					position: "relative",
				}}
			>
			{/* Hidden Native Audio Element */}
			<audio
				ref={audioRef}
				onTimeUpdate={() => {
					if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
				}}
				onLoadedMetadata={() => {
					if (audioRef.current) setDuration(audioRef.current.duration);
				}}
				onEnded={handleTrackEnded}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
			/>

			{/* Hidden Multiple Audio Files Input */}
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="audio/*,.mp3,.wav,.m4a,.flac,.aac,.ogg,.opus,.wma"
				onChange={handleFilesSelect}
				style={{ display: "none" }}
			/>

			{/* 1. Header & Actions Row */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: "14px",
					flexShrink: 0,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
					<div
						style={{
							width: "42px",
							height: "42px",
							borderRadius: "50%",
							backgroundColor: "rgba(255, 255, 255, 0.1)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							border: "1px solid rgba(255, 255, 255, 0.18)",
							color: "#ffffff",
						}}
					>
						<Headphones
							size={22}
							style={{
								filter: "drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))",
							}}
						/>
					</div>
					<div>
						<h1
							style={{
								fontSize: "1.3rem",
								fontWeight: "700",
								color: "#ffffff",
								margin: 0,
								lineHeight: 1.2,
							}}
						>
							{isEn
								? "Audio Library & Player"
								: "مشغل الصوتيات والمكتبة الصوتية"}
						</h1>
						<p
							style={{
								fontSize: "0.80rem",
								color: "var(--text-muted)",
								margin: "2px 0 0 0",
							}}
						>
							{isEn
								? "Select audio files from your device to play Quran, lectures, and lessons"
								: "حدد ملفات صوتية من جهازك واستمع للتلاوات والدروس والأذكار مباشرة"}
						</p>
					</div>
				</div>

				{/* Action Buttons */}
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					{folderName && (
						<div
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "6px",
								padding: "5px 12px",
								borderRadius: "var(--radius-pill)",
								backgroundColor: "rgba(255, 255, 255, 0.08)",
								border: "1px solid rgba(255, 255, 255, 0.14)",
								fontSize: "0.80rem",
								fontWeight: "600",
								color: "var(--text-secondary)",
							}}
						>
							<Music size={14} style={{ color: "var(--accent)" }} />
							<span
								style={{
									maxWidth: "160px",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{folderName}
							</span>
							<span style={{ color: "var(--text-muted)" }}>
								({tracks.length})
							</span>
						</div>
					)}

					<Button
						variant="primary"
						size="medium"
						onClick={() => fileInputRef.current && fileInputRef.current.click()}
						disabled={isLoadingFiles}
					>
						<Upload size={16} />
						<span>
							{isLoadingFiles
								? isEn
									? "Adding Files..."
									: "جاري إضافة الملفات..."
								: isEn
									? "Add Audio Files"
									: "إضافة ملفات صوتية"}
						</span>
					</Button>

					{tracks.length > 0 && (
						<IconButton
							variant="danger"
							size="medium"
							onClick={handleClearLibrary}
							aria-label={isEn ? "Clear Library" : "تفريغ المكتبة"}
						>
							<Trash2 size={16} />
						</IconButton>
					)}
				</div>
			</div>

			{/* Divider */}
			<div
				style={{
					width: "100%",
					height: "1px",
					backgroundColor: "var(--border-subtle)",
					flexShrink: 0,
				}}
			/>

			{/* 2. Main Audio Player Body */}
			{tracks.length === 0 ? (
				<AudioDropzoneEmptyState
					isDragging={isDragging}
					isEn={isEn}
					onSelectFilesClick={() =>
						fileInputRef.current && fileInputRef.current.click()
					}
				/>
			) : (
				<div
					style={{
						flex: 1,
						display: "grid",
						gridTemplateColumns: isPlaylistExpanded
							? "minmax(320px, 1fr) minmax(280px, 380px)"
							: "1fr 64px",
						gap: "18px",
						minHeight: 0,
						overflow: "hidden",
						transition: "grid-template-columns 0.25s ease",
					}}
				>
					{/* A. Now Playing Card */}
					<AudioPlayerDisk
						activeTrack={activeTrack}
						activeTrackIndex={activeTrackIndex}
						totalTracks={tracks.length}
						isPlaying={isPlaying}
						currentTime={currentTime}
						duration={duration}
						repeatMode={repeatMode}
						isShuffle={isShuffle}
						isEditingTitle={isEditingTitle}
						editTitleValue={editTitleValue}
						isEn={isEn}
						onTogglePlay={handleTogglePlay}
						onNextTrack={handleNextTrack}
						onPrevTrack={handlePrevTrack}
						onSeekOffset={handleSeekOffset}
						onSeekToRatio={handleSeekToRatio}
						onCycleRepeatMode={handleCycleRepeatMode}
						onToggleShuffle={handleToggleShuffle}
						onStartEditTitle={handleStartEditTitle}
						onSaveTitle={handleSaveTitle}
						onCancelEditTitle={handleCancelEditTitle}
						onEditTitleChange={setEditTitleValue}
						editInputRef={editInputRef}
					/>

					{/* B. Playlist Sidebar */}
					<AudioPlaylistDrawer
						tracks={tracks}
						filteredTracks={filteredTracks}
						activeTrackId={activeTrackId}
						isPlaying={isPlaying}
						isPlaylistExpanded={isPlaylistExpanded}
						searchQuery={searchQuery}
						isEn={isEn}
						onTogglePlaylist={handleTogglePlaylist}
						onSearchChange={setSearchQuery}
						onSelectTrack={(trackId) => {
							setActiveTrackId(trackId);
							setIsPlaying(true);
						}}
						onDeleteTrack={handleDeleteTrack}
						onAddFilesClick={() =>
							fileInputRef.current && fileInputRef.current.click()
						}
						onClearLibraryClick={handleClearLibrary}
					/>
				</div>
			)}
			</Glass>
		</GlassViewShell>
	);
}
