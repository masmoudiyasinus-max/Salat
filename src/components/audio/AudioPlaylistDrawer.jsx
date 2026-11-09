import {
	ListMusic,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	Play,
	Trash2,
	Upload,
} from "lucide-react";
import { Badge, Button, Glass, IconButton, SearchField } from "open-glass-ui";
import React from "react";
import { formatFileSize } from "../../services/audioStorage.js";

export default function AudioPlaylistDrawer({
	tracks,
	filteredTracks,
	activeTrackId,
	isPlaying,
	isPlaylistExpanded,
	searchQuery,
	isEn,
	onTogglePlaylist,
	onSearchChange,
	onSelectTrack,
	onDeleteTrack,
	onAddFilesClick,
	onClearLibraryClick,
}) {
	return (
		<Glass
			as="div"
			material="regular"
			look="liquid"
			style={{
				borderRadius: "20px",
				padding: isPlaylistExpanded ? "16px" : "14px 8px",
				display: "flex",
				flexDirection: "column",
				gap: isPlaylistExpanded ? "12px" : "8px",
				minHeight: 0,
				overflow: "hidden",
				transition: "padding 0.2s ease",
			}}
		>
			{isPlaylistExpanded ? (
				<>
					{/* Playlist Header & Search */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "10px",
							flexShrink: 0,
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
								<IconButton
									aria-label={isEn ? "Collapse playlist" : "طي قائمة المقاطع"}
									variant="quiet"
									size="small"
									onClick={onTogglePlaylist}
								>
									{isEn ? <PanelLeftClose size={18} /> : <PanelRightClose size={18} />}
								</IconButton>
								<ListMusic size={18} style={{ color: "var(--ogui-color-accent, #38bdf8)" }} />
								<span style={{ fontSize: "0.92rem", fontWeight: "700", color: "#ffffff" }}>
									{isEn ? "Playlist" : "قائمة المقاطع"}
								</span>
								<Badge tone="accent">
									{filteredTracks.length}
								</Badge>
							</div>

							<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
								<IconButton
									aria-label={isEn ? "Add audio files" : "إضافة ملفات صوتية"}
									variant="quiet"
									size="small"
									onClick={onAddFilesClick}
								>
									<Upload size={15} />
								</IconButton>
								{tracks.length > 0 && (
									<IconButton
										aria-label={isEn ? "Clear library" : "تفريغ المكتبة"}
										variant="danger"
										size="small"
										onClick={onClearLibraryClick}
									>
										<Trash2 size={14} />
									</IconButton>
								)}
							</div>
						</div>

						{/* Search Bar */}
						<SearchField
							label={isEn ? "Search tracks..." : "بحث في المقاطع..."}
							value={searchQuery}
							onValueChange={onSearchChange}
						/>
					</div>

					{/* Scrollable Track List */}
					<div
						style={{
							flex: 1,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							gap: "6px",
							paddingRight: "4px",
						}}
					>
						{filteredTracks.length === 0 ? (
							<div
								style={{
									textAlign: "center",
									padding: "30px 10px",
									color: "var(--ogui-color-muted, rgba(255,255,255,0.6))",
									fontSize: "0.85rem",
								}}
							>
								{searchQuery
									? isEn ? "No tracks matching search" : "لا توجد مقاطع مطابقة للبحث"
									: isEn ? "Playlist is empty" : "القائمة فارغة"}
							</div>
						) : (
							filteredTracks.map((track, idx) => {
								const isCurrent = track.id === activeTrackId;
								return (
									<div
										key={track.id}
										onClick={() => onSelectTrack(track.id)}
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "10px",
											padding: "8px 12px",
											borderRadius: "10px",
											backgroundColor: isCurrent
												? "rgba(56, 189, 248, 0.16)"
												: "rgba(255, 255, 255, 0.04)",
											border: isCurrent
												? "1px solid var(--ogui-color-accent, #38bdf8)"
												: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.1))",
											cursor: "pointer",
											transition: "all 0.15s ease",
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "10px",
												flex: 1,
												minWidth: 0,
											}}
										>
											<span
												style={{
													fontSize: "0.78rem",
													fontWeight: "700",
													color: isCurrent
														? "var(--ogui-color-accent, #38bdf8)"
														: "var(--ogui-color-muted)",
													width: "18px",
													textAlign: "center",
												}}
											>
												{idx + 1}
											</span>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div
													style={{
														fontSize: "0.85rem",
														fontWeight: isCurrent ? "700" : "500",
														color: "#ffffff",
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{track.title || track.name}
												</div>
												{track.size && (
													<div
														style={{
															fontSize: "0.72rem",
															color: "var(--ogui-color-muted)",
															marginTop: "2px",
														}}
													>
														{formatFileSize(track.size)}
													</div>
												)}
											</div>
										</div>

										<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
											{isCurrent && isPlaying && (
												<Badge tone="positive">
													<Play size={10} fill="currentColor" />
												</Badge>
											)}
											<IconButton
												aria-label={isEn ? "Delete track" : "حذف المقطع"}
												variant="danger"
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													onDeleteTrack(track.id);
												}}
											>
												<Trash2 size={13} />
											</IconButton>
										</div>
									</div>
								);
							})
						)}
					</div>
				</>
			) : (
				/* Mini Rail */
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "10px",
						height: "100%",
					}}
				>
					<IconButton
						aria-label={isEn ? "Expand playlist" : "توسيع قائمة المقاطع"}
						variant="quiet"
						size="small"
						onClick={onTogglePlaylist}
					>
						{isEn ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}
					</IconButton>

					<IconButton
						aria-label={isEn ? "Add audio files" : "إضافة ملفات صوتية"}
						variant="quiet"
						size="small"
						onClick={onAddFilesClick}
					>
						<Upload size={16} />
					</IconButton>

					<Badge tone="neutral">
						{tracks.length}
					</Badge>

					<div
						style={{
							flex: 1,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							gap: "6px",
							width: "100%",
							alignItems: "center",
							padding: "4px 0",
						}}
					>
						{tracks.map((track, idx) => {
							const isCurrent = track.id === activeTrackId;
							return (
								<button
									key={track.id}
									onClick={() => onSelectTrack(track.id)}
									style={{
										width: "32px",
										height: "32px",
										borderRadius: "50%",
										backgroundColor: isCurrent
											? "var(--ogui-color-accent, #38bdf8)"
											: "rgba(255, 255, 255, 0.06)",
										color: isCurrent ? "#000000" : "#ffffff",
										border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.2))",
										fontSize: "0.72rem",
										fontWeight: "700",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										cursor: "pointer",
										flexShrink: 0,
										transition: "all 0.15s ease",
									}}
									title={track.title || track.name}
								>
									{isCurrent && isPlaying ? <Play size={10} fill="#000000" /> : idx + 1}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</Glass>
	);
}
