import {
	Check,
	Image as ImageIcon,
	Trash2,
	Upload,
	Video,
} from "lucide-react";
import { Alert, Badge, Button, Card, IconButton, SegmentedControl } from "open-glass-ui";
import React from "react";

export default function AppearanceSettingsSection({
	settings,
	isOnline,
	isEn,
	onInputChange,
	onImageUpload,
	onDeleteImage,
	onAddNatureWallpaper,
	fileInputRef,
}) {
	return (
		<Card
			eyebrow={isEn ? "Interface & Aesthetics" : "المظهر والجماليات"}
			title={
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<Video size={22} style={{ color: "#ffffff" }} />
					<span>
						{isEn ? "Appearance & Live Background" : "المظهر وخلفية الموقع الحية"}
					</span>
				</div>
			}
		>
			{!isOnline && (
				<div style={{ marginBottom: "16px" }}>
					<Alert tone="warning" title={isEn ? "Offline Mode" : "وضع عدم الاتصال"}>
						{isEn
							? "Image wallpapers are automatically used because live video streams require an internet connection."
							: "تم تفعيل خلفية الصور تلقائياً نظراً لأن البث المباشر يتطلب اتصالاً بالإنترنت."}
					</Alert>
				</div>
			)}

			{/* Background Mode Selector Grid */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
					gap: "12px",
					marginBottom: "20px",
				}}
			>
				{/* Makkah Stream Card */}
				<div
					onClick={isOnline ? () => onInputChange("bgMode", "makkah") : undefined}
					style={{
						padding: "16px",
						borderRadius: "14px",
						cursor: isOnline ? "pointer" : "not-allowed",
						display: "flex",
						alignItems: "center",
						gap: "12px",
						backgroundColor:
							settings.bgMode === "makkah" && isOnline
								? "rgba(56, 189, 248, 0.18)"
								: "rgba(255, 255, 255, 0.04)",
						border:
							settings.bgMode === "makkah" && isOnline
								? "1px solid var(--ogui-color-accent, #38bdf8)"
								: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
						opacity: isOnline ? 1 : 0.5,
						transition: "all 0.15s ease",
					}}
				>
					<Video
						size={20}
						style={{
							color: settings.bgMode === "makkah" && isOnline ? "var(--ogui-color-accent, #38bdf8)" : "#a3a3a3",
						}}
					/>
					<div>
						<div style={{ fontWeight: "700", color: "#ffffff", fontSize: "0.95rem" }}>
							{isEn ? "Makkah Live Stream" : "بث الحرم المكي"}
						</div>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255,255,255,0.7))" }}>
							{isOnline
								? isEn ? "High definition live stream" : "بث مباشر للحرم المكي الشريف"
								: isEn ? "Requires Internet" : "يتطلب اتصالاً بالإنترنت"}
						</div>
					</div>
				</div>

				{/* Madinah Stream Card */}
				<div
					onClick={isOnline ? () => onInputChange("bgMode", "madinah") : undefined}
					style={{
						padding: "16px",
						borderRadius: "14px",
						cursor: isOnline ? "pointer" : "not-allowed",
						display: "flex",
						alignItems: "center",
						gap: "12px",
						backgroundColor:
							settings.bgMode === "madinah" && isOnline
								? "rgba(56, 189, 248, 0.18)"
								: "rgba(255, 255, 255, 0.04)",
						border:
							settings.bgMode === "madinah" && isOnline
								? "1px solid var(--ogui-color-accent, #38bdf8)"
								: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
						opacity: isOnline ? 1 : 0.5,
						transition: "all 0.15s ease",
					}}
				>
					<Video
						size={20}
						style={{
							color: settings.bgMode === "madinah" && isOnline ? "var(--ogui-color-accent, #38bdf8)" : "#a3a3a3",
						}}
					/>
					<div>
						<div style={{ fontWeight: "700", color: "#ffffff", fontSize: "0.95rem" }}>
							{isEn ? "Madinah Live Stream" : "بث المسجد النبوي"}
						</div>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255,255,255,0.7))" }}>
							{isOnline
								? isEn ? "High definition live stream" : "بث مباشر للمسجد النبوي"
								: isEn ? "Requires Internet" : "يتطلب اتصالاً بالإنترنت"}
						</div>
					</div>
				</div>

				{/* Custom Image Card */}
				<div
					onClick={() => onInputChange("bgMode", "custom_image")}
					style={{
						padding: "16px",
						borderRadius: "14px",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						gap: "12px",
						backgroundColor:
							settings.bgMode === "custom_image"
								? "rgba(56, 189, 248, 0.18)"
								: "rgba(255, 255, 255, 0.04)",
						border:
							settings.bgMode === "custom_image"
								? "1px solid var(--ogui-color-accent, #38bdf8)"
								: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
						transition: "all 0.15s ease",
					}}
				>
					<ImageIcon
						size={20}
						style={{
							color: settings.bgMode === "custom_image" ? "var(--ogui-color-accent, #38bdf8)" : "#a3a3a3",
						}}
					/>
					<div>
						<div style={{ fontWeight: "700", color: "#ffffff", fontSize: "0.95rem" }}>
							{isEn ? "Nature & Custom Wallpaper" : "خلفية الطبيعة والصور"}
						</div>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255,255,255,0.7))" }}>
							{isEn ? "Built-in nature and uploaded photos" : "صورة طبيعية وصور من جهازك"}
						</div>
					</div>
				</div>
			</div>

			{/* Custom Image Uploader & Gallery */}
			{settings.bgMode === "custom_image" && (
				<div
					style={{
						padding: "18px",
						borderRadius: "14px",
						backgroundColor: "rgba(255, 255, 255, 0.03)",
						border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
						marginBottom: "20px",
					}}
				>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(e) => {
							if (e.target.files?.[0]) onImageUpload(e.target.files[0]);
							e.target.value = "";
						}}
					/>

					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: "14px",
							flexWrap: "wrap",
							gap: "8px",
						}}
					>
						<span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#ffffff" }}>
							{isEn ? "Saved Wallpapers" : "الصور المحفوظة"}
						</span>
						<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
							{!(settings.customBgImages || []).includes("/nature-meadow.jpg") && (
								<Button
									variant="secondary"
									size="small"
									onClick={onAddNatureWallpaper}
								>
									{isEn ? "Add Nature Wallpaper" : "إضافة صورة الطبيعة"}
								</Button>
							)}
							<Button
								variant="primary"
								size="small"
								leadingIcon={<Upload size={14} />}
								onClick={() => fileInputRef.current?.click()}
							>
								{isEn ? "Upload New Image" : "رفع صورة جديدة"}
							</Button>
						</div>
					</div>

					{/* Gallery Grid */}
					<div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
						{(settings.customBgImages || []).length === 0 ? (
							<div
								style={{
									width: "100%",
									textAlign: "center",
									padding: "24px",
									color: "var(--ogui-color-muted)",
									fontSize: "0.88rem",
								}}
							>
								{isEn
									? "No images uploaded yet."
									: 'لم ترفع أي صور بعد. اضغط على "رفع صورة جديدة" لاختيار صورة من جهازك.'}
							</div>
						) : (
							settings.customBgImages.map((img, i) => {
								const isSelected = settings.activeCustomBgImage === img;
								return (
									<div
										key={i}
										onClick={() => onInputChange("activeCustomBgImage", img)}
										style={{
											position: "relative",
											width: "110px",
											height: "74px",
											borderRadius: "10px",
											overflow: "hidden",
											cursor: "pointer",
											border: isSelected
												? "2px solid var(--ogui-color-accent, #38bdf8)"
												: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
											transform: isSelected ? "scale(1.03)" : "scale(1)",
											transition: "all 0.2s ease",
										}}
									>
										<img
											src={img}
											alt="Bg option"
											style={{
												width: "100%",
												height: "100%",
												objectFit: "cover",
											}}
										/>

										{isSelected && (
											<div
												style={{
													position: "absolute",
													top: "5px",
													left: "5px",
													backgroundColor: "var(--ogui-color-accent, #38bdf8)",
													color: "#000000",
													borderRadius: "50%",
													width: "20px",
													height: "20px",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													zIndex: 3,
												}}
											>
												<Check size={12} strokeWidth={3} />
											</div>
										)}

										{img === "/nature-meadow.jpg" && (
											<div
												style={{
													position: "absolute",
													bottom: "3px",
													left: "3px",
													right: "3px",
													backgroundColor: "rgba(0, 0, 0, 0.75)",
													color: "#ffffff",
													fontSize: "0.66rem",
													fontWeight: "700",
													textAlign: "center",
													borderRadius: "4px",
													padding: "2px",
												}}
											>
												{isEn ? "Nature" : "طبيعة"}
											</div>
										)}

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onDeleteImage(img, e);
											}}
											style={{
												position: "absolute",
												top: "4px",
												right: "4px",
												backgroundColor: "rgba(239, 68, 68, 0.85)",
												color: "#ffffff",
												border: "none",
												borderRadius: "50%",
												width: "20px",
												height: "20px",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												cursor: "pointer",
											}}
											title={isEn ? "Delete image" : "حذف الصورة"}
										>
											<Trash2 size={12} />
										</button>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* Time Format & Language via SegmentedControl */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
					gap: "16px",
				}}
			>
				<div>
					<label
						style={{
							display: "block",
							fontSize: "0.88rem",
							fontWeight: "600",
							color: "#ffffff",
							marginBottom: "8px",
						}}
					>
						{isEn ? "Time Display Format" : "نظام عرض الوقت"}
					</label>
					<SegmentedControl
						aria-label={isEn ? "Time Display Format" : "نظام عرض الوقت"}
						value={settings.timeFormat || "12"}
						onValueChange={(val) => onInputChange("timeFormat", val)}
						items={[
							{ value: "12", label: isEn ? "12 Hours (AM / PM)" : "12 ساعة (ص / م)" },
							{ value: "24", label: isEn ? "24 Hours" : "24 ساعة" },
						]}
					/>
				</div>

				<div>
					<label
						style={{
							display: "block",
							fontSize: "0.88rem",
							fontWeight: "600",
							color: "#ffffff",
							marginBottom: "8px",
						}}
					>
						{isEn ? "Interface Language" : "لغة الواجهة"}
					</label>
					<SegmentedControl
						aria-label={isEn ? "Interface Language" : "لغة الواجهة"}
						value={settings.language || "ar"}
						onValueChange={(val) => onInputChange("language", val)}
						items={[
							{ value: "ar", label: "العربية" },
							{ value: "en", label: "English" },
						]}
					/>
				</div>
			</div>
		</Card>
	);
}
