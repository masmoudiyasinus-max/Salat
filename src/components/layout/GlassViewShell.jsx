import React from "react";

/**
 * GlassViewShell: The unified, gold-standard layout container for all views
 * Shares the exact same liquid glass optical invariants as demo.html
 */
export default function GlassViewShell({
	children,
	width = "wide", // 'hero' (max 480px), 'medium' (max 720px), 'wide' (max 1140px)
	className = "",
	style = {},
	animate = true,
}) {
	const maxWidthMap = {
		hero: "480px",
		medium: "720px",
		wide: "1140px",
		full: "100%",
	};

	const resolvedMaxWidth = maxWidthMap[width] || maxWidthMap.wide;

	return (
		<div
			className={`glass-view-shell ${animate ? "fade-in" : ""} ${className}`}
			style={{
				width: "100%",
				maxWidth: resolvedMaxWidth,
				margin: "0 auto",
				padding: "16px 20px 48px",
				display: "flex",
				flexDirection: "column",
				gap: "24px",
				alignItems: "center",
				...style,
			}}
		>
			{children}
		</div>
	);
}
