import {
	Check,
	Edit2,
	Music,
	Pause,
	Play,
	Repeat,
	Repeat1,
	RotateCcw,
	RotateCw,
	Shuffle,
	SkipBack,
	SkipForward,
	X,
} from "lucide-react";
import { Card, IconButton } from "open-glass-ui";
import React from "react";
import { formatAudioDuration } from "../../services/audioStorage.js";

export default function AudioPlayerDisk({
	activeTrack,
	activeTrackIndex,
	totalTracks,
	isPlaying,
	currentTime,
	duration,
	repeatMode,
	isShuffle,
	isEditingTitle,
	editTitleValue,
	isEn,
	onTogglePlay,
	onNextTrack,
	onPrevTrack,
	onSeekOffset,
	onSeekToRatio,
	onCycleRepeatMode,
	onToggleShuffle,
	onStartEditTitle,
	onSaveTitle,
	onCancelEditTitle,
	onEditTitleChange,
	editInputRef,
}) {
	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<Card
			style={{
				borderRadius: "var(--card-radius)",
				padding: "24px",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				alignItems: "center",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Spinning Disc / Visualizer Badge */}
			<div
				style={{
					width: "130px",
					height: "130px",
					borderRadius: "50%",
					backgroundColor: "rgba(15, 15, 18, 0.85)",
					border: "3px solid rgba(255, 255, 255, 0.15)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: isPlaying ? "0 0 40px rgba(255, 255, 255, 0.15)" : "none",
					animation: isPlaying ? "spin 10s linear infinite" : "none",
					margin: "10px 0",
					position: "relative",
				}}
			>
				{/* Inner Vinyl Ring */}
				<div
					style={{
						width: "50px",
						height: "50px",
						borderRadius: "50%",
						backgroundColor: "rgba(255, 255, 255, 0.08)",
						border: "1px solid rgba(255, 255, 255, 0.20)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Music
						size={24}
						style={{ color: isPlaying ? "#ffffff" : "var(--text-muted)" }}
					/>
				</div>
			</div>

			{/* Track Info */}
			<div
				style={{
					textAlign: "center",
					width: "100%",
					padding: "0 10px",
					minHeight: "56px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						fontSize: "0.78rem",
						fontWeight: "700",
						color: "var(--text-muted)",
						textTransform: "uppercase",
						letterSpacing: "0.5px",
						marginBottom: "4px",
					}}
				>
					{isEn
						? `Track ${activeTrackIndex + 1} of ${totalTracks}`
						: `مقطع ${activeTrackIndex + 1} من ${totalTracks}`}
				</div>

				{isEditingTitle ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "8px",
							width: "100%",
							maxWidth: "420px",
							margin: "2px 0 0 0",
						}}
					>
						<input
							ref={editInputRef}
							type="text"
							value={editTitleValue}
							onChange={(e) => onEditTitleChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") onSaveTitle();
								if (e.key === "Escape") onCancelEditTitle();
							}}
							style={{
								flex: 1,
								padding: "6px 12px",
								borderRadius: "8px",
								backgroundColor: "rgba(255, 255, 255, 0.12)",
								border: "1px solid rgba(255, 255, 255, 0.30)",
								color: "#ffffff",
								fontSize: "1rem",
								fontWeight: "700",
								textAlign: "center",
								outline: "none",
							}}
							placeholder={isEn ? "Edit title..." : "عدل عنوان المقطع..."}
						/>
						<IconButton
							onClick={onSaveTitle}
							aria-label={isEn ? "Save title" : "حفظ العنوان"}
							variant="secondary"
							size="small"
						>
							<Check size={16} />
						</IconButton>
						<IconButton
							onClick={onCancelEditTitle}
							aria-label={isEn ? "Cancel" : "إلغاء"}
							variant="quiet"
							size="small"
						>
							<X size={16} />
						</IconButton>
					</div>
				) : (
					<div
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "8px",
							maxWidth: "100%",
						}}
					>
						<h2
							onClick={onStartEditTitle}
							title={isEn ? "Click to edit title" : "انقر لتعديل العنوان"}
							style={{
								fontSize: "1.25rem",
								fontWeight: "700",
								color: "#ffffff",
								margin: 0,
								lineHeight: 1.3,
								maxHeight: "2.6em",
								overflow: "hidden",
								textOverflow: "ellipsis",
								display: "-webkit-box",
								WebkitLineClamp: 2,
								WebkitBoxOrient: "vertical",
								cursor: "pointer",
							}}
						>
							{activeTrack?.title ||
								(isEn ? "Select a track" : "اختر مقطعاً للتشغيل")}
						</h2>
						{activeTrack && (
							<IconButton
								onClick={onStartEditTitle}
								aria-label={isEn ? "Edit title" : "تعديل العنوان"}
								variant="quiet"
								size="small"
							>
								<Edit2 size={13} />
							</IconButton>
						)}
					</div>
				)}
			</div>

			{/* Interactive Progress Bar & Time */}
			<div style={{ width: "100%", margin: "14px 0 6px 0", direction: "ltr" }}>
				<div
					style={{
						position: "relative",
						width: "100%",
						height: "6px",
						backgroundColor: "rgba(255, 255, 255, 0.12)",
						borderRadius: "3px",
						cursor: "pointer",
						overflow: "hidden",
					}}
					onClick={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const clickX = e.clientX - rect.left;
						const ratio = Math.max(0, Math.min(1, clickX / rect.width));
						onSeekToRatio(ratio);
					}}
				>
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							bottom: 0,
							width: `${progressPercent}%`,
							backgroundColor: "var(--accent-primary)",
							borderRadius: "3px",
							transition: "width 0.1s linear",
						}}
					/>
				</div>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontSize: "0.78rem",
						color: "var(--text-muted)",
						marginTop: "6px",
						fontWeight: "600",
						fontVariantNumeric: "tabular-nums",
					}}
				>
					<span>{formatAudioDuration(currentTime)}</span>
					<span>{formatAudioDuration(duration)}</span>
				</div>
			</div>

			{/* Main Playback Control Bar */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "14px",
					margin: "6px 0",
				}}
			>
				{/* Repeat Mode Toggle (Rightmost in RTL) */}
				<IconButton
					onClick={onCycleRepeatMode}
					variant={repeatMode !== "off" ? "primary" : "secondary"}
					size="medium"
					aria-label={
						repeatMode === "all"
							? isEn
								? "Repeat All"
								: "تكرار الكل"
							: repeatMode === "one"
								? isEn
									? "Repeat Current"
									: "تكرار المقطع الحالي"
								: isEn
									? "Repeat Off"
									: "إيقاف التكرار"
					}
				>
					{repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
				</IconButton>

				{/* Next Track (Right in RTL) */}
				<IconButton
					onClick={onNextTrack}
					variant="secondary"
					size="medium"
					aria-label={isEn ? "Next track" : "المقطع التالي"}
				>
					<SkipForward size={20} />
				</IconButton>

				{/* Forward 10s (Right in RTL) */}
				<IconButton
					onClick={() => onSeekOffset(10)}
					variant="secondary"
					size="medium"
					aria-label={isEn ? "Forward 10s" : "تقديم 10 ثوانٍ"}
					style={{
						position: "relative",
					}}
				>
					<RotateCw size={20} />
					<span
						style={{
							position: "absolute",
							fontSize: "0.52rem",
							fontWeight: "700",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -46%)",
							lineHeight: 1,
							pointerEvents: "none",
						}}
					>
						10
					</span>
				</IconButton>

				{/* Center Play / Pause Button */}
				<IconButton
					onClick={onTogglePlay}
					variant="primary"
					size="large"
					aria-label={
						isPlaying
							? isEn
								? "Pause"
								: "إيقاف مؤقت"
							: isEn
								? "Play"
								: "تشغيل"
					}
					style={{
						width: "54px",
						height: "54px",
						borderRadius: "50%",
					}}
				>
					{isPlaying ? (
						<Pause size={24} />
					) : (
						<Play
							size={24}
							style={{ transform: "translateX(2px)" }}
						/>
					)}
				</IconButton>

				{/* Rewind 10s (Left in RTL) */}
				<IconButton
					onClick={() => onSeekOffset(-10)}
					variant="secondary"
					size="medium"
					aria-label={isEn ? "Rewind 10s" : "ترجيع 10 ثوانٍ"}
					style={{
						position: "relative",
					}}
				>
					<RotateCcw size={20} />
					<span
						style={{
							position: "absolute",
							fontSize: "0.52rem",
							fontWeight: "700",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -46%)",
							lineHeight: 1,
							pointerEvents: "none",
						}}
					>
						10
					</span>
				</IconButton>

				{/* Prev Track (Left in RTL) */}
				<IconButton
					onClick={onPrevTrack}
					variant="secondary"
					size="medium"
					aria-label={isEn ? "Previous track" : "المقطع السابق"}
				>
					<SkipBack size={20} />
				</IconButton>

				{/* Shuffle Toggle (Leftmost in RTL) */}
				<IconButton
					onClick={onToggleShuffle}
					variant={isShuffle ? "primary" : "secondary"}
					size="medium"
					aria-label={isEn ? "Shuffle" : "تشغيل عشوائي"}
				>
					<Shuffle size={18} />
				</IconButton>
			</div>
		</Card>
	);
}
