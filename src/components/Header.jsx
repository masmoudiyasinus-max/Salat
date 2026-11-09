import { Eye } from "lucide-react";
import { Dock, IconButton, Tooltip } from "open-glass-ui";
import React from "react";
import { APP_VIEWS, getViewTitle } from "../config/viewsConfig.jsx";
import { getTranslation } from "../services/i18n";

export default function Header({
	activeTab,
	setActiveTab,
	settings,
	onToggleFocusMode,
	isLiveVideo,
	isWallpaperFocusMode,
	isOnline = true,
}) {
	const lang = settings?.language || "ar";
	const isEn = lang === "en";
	const t = (k, fb) => getTranslation(lang, k, fb);

	const handleTabClick = (tab) => {
		if (isWallpaperFocusMode) return;
		setActiveTab(tab);
	};

	return (
		<Dock
			label={t("navTitle", "التنقل الرئيسي")}
			material="regular"
			className="floating-vertical-dock"
		>
			{APP_VIEWS.map((view) => {
				const Icon = view.icon;
				const title = getViewTitle(view, lang);
				const tooltipText = isWallpaperFocusMode
					? t("navFocusModeDisabled", "التنقل معطل أثناء وضع التركيز")
					: !isOnline && view.offlineNoticeAr
						? isEn ? view.offlineNoticeEn : view.offlineNoticeAr
						: `${title} (${view.shortcut})`;

				return (
					<Tooltip key={view.id} label={tooltipText} placement="bottom">
						<IconButton
							id={`nav-${view.id}-btn`}
							aria-label={title}
							variant={activeTab === view.id ? "primary" : "quiet"}
							disabled={isWallpaperFocusMode}
							onClick={() => handleTabClick(view.id)}
						>
							<Icon size={20} />
						</IconButton>
					</Tooltip>
				);
			})}

			{isLiveVideo && (
				<>
					<div
						style={{
							width: "1px",
							height: "20px",
							backgroundColor: "var(--ogui-hairline, rgba(255,255,255,0.2))",
							margin: "0 4px",
						}}
					/>

					<Tooltip
						label={t(
							"navFocusMode",
							"مشاهدة البث المباشر المكرّم بدون عناصر الموقع وبدون تعتيم",
						)}
						placement="bottom"
					>
						<IconButton
							id="nav-focus-mode-btn"
							aria-label={t(
								"navFocusMode",
								"مشاهدة البث المباشر المكرّم بدون عناصر الموقع وبدون تعتيم",
							)}
							variant="quiet"
							onClick={onToggleFocusMode}
						>
							<Eye size={20} />
						</IconButton>
					</Tooltip>
				</>
			)}
		</Dock>
	);
}
