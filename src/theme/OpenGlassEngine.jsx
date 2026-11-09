import React from "react";
import { Dialog, Glass } from "open-glass-ui";

/**
 * ============================================================================
 * OpenGlassEngine.jsx — Single Source of Truth (SSOT) UI & Design System Engine
 * ============================================================================
 * All visual parameters, presets, contrast beds, and glass primitives are
 * unified strictly in this single file. No component in the project should
 * invent its own look, padding, border-radius, or conflicting opacity.
 */

export const OPEN_GLASS_CONFIG = {
	// 1. Hero Card (for main reception, prayer clock, or focused widgets)
	hero: {
		preset: "liquid",
		blur: 1.4,
		opacity: 0.38,
		rim: 1.5,
		highlight: 1.6,
		lensing: 1.6,
		lightAngle: 340,
		radius: "28px",
		padding: "30px 34px",
		maxWidth: "460px",
		border: "1px solid rgba(255, 255, 255, 0.16)",
		boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
		// Optical contrast bed: guarantees white text is 100% legible against white marble/ihrams
		contrastBed:
			"linear-gradient(180deg, rgba(10, 12, 18, 0.45) 0%, rgba(10, 12, 18, 0.60) 100%)",
	},

	// 2. Standard Bento Card (for grids, tasbeeh, library, audio, and sections)
	card: {
		preset: "liquid",
		blur: 1.4,
		opacity: 0.36,
		rim: 1.4,
		highlight: 1.5,
		lensing: 1.5,
		lightAngle: 340,
		radius: "24px",
		padding: "24px 28px",
		border: "1px solid rgba(255, 255, 255, 0.14)",
		boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)",
		contrastBed:
			"linear-gradient(180deg, rgba(10, 12, 18, 0.40) 0%, rgba(10, 12, 18, 0.55) 100%)",
	},

	// 3. Modals & Dialogs (for settings, dhikr customization, schedules)
	modal: {
		preset: "liquid",
		blur: 1.6,
		opacity: 0.42,
		rim: 1.5,
		highlight: 1.6,
		lensing: 1.6,
		lightAngle: 340,
		radius: "24px",
		padding: "26px 30px",
		border: "1px solid rgba(255, 255, 255, 0.18)",
		boxShadow: "0 24px 72px rgba(0, 0, 0, 0.65)",
		contrastBed:
			"linear-gradient(180deg, rgba(14, 18, 26, 0.55) 0%, rgba(10, 12, 18, 0.72) 100%)",
	},

	// 4. Compact Controls, Rows & Capsules
	row: {
		radius: "16px",
		padding: "12px 18px",
		border: "1px solid rgba(255, 255, 255, 0.10)",
		background: "rgba(255, 255, 255, 0.05)",
		hoverBackground: "rgba(255, 255, 255, 0.09)",
	},

	// 5. Circular Touch Jewel (for Tasbeeh and circular controls)
	counter: {
		radius: "50%",
		background:
			"radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(10, 12, 18, 0.42) 100%)",
		border: "1px solid rgba(255, 255, 255, 0.18)",
		boxShadow:
			"0 12px 36px rgba(0, 0, 0, 0.40), inset 0 1px 1px rgba(255, 255, 255, 0.25)",
		backdropFilter: "blur(20px)",
	},
};

/**
 * 💎 GlassHero: Single unified hero container matching demo.html
 */
export function GlassHero({
	children,
	className = "",
	style = {},
	as = "section",
	...props
}) {
	const cfg = OPEN_GLASS_CONFIG.hero;
	return (
		<Glass
			as={as}
			material="regular"
			interactive={true}
			look={{
				preset: cfg.preset,
				blur: cfg.blur,
				opacity: cfg.opacity,
				rim: cfg.rim,
				highlight: cfg.highlight,
				lensing: cfg.lensing,
				lightAngle: cfg.lightAngle,
			}}
			className={`openglass-hero ${className}`}
			style={{
				width: "100%",
				maxWidth: cfg.maxWidth,
				margin: "0 auto",
				padding: cfg.padding,
				borderRadius: cfg.radius,
				border: cfg.border,
				boxShadow: cfg.boxShadow,
				background: cfg.contrastBed,
				position: "relative",
				boxSizing: "border-box",
				transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
				...style,
			}}
			{...props}
		>
			{children}
		</Glass>
	);
}

/**
 * 📦 GlassCard: Single unified bento container matching demo.html
 */
export function GlassCard({
	children,
	className = "",
	style = {},
	as = "div",
	interactive = true,
	...props
}) {
	const cfg = OPEN_GLASS_CONFIG.card;
	return (
		<Glass
			as={as}
			material="regular"
			interactive={interactive}
			look={{
				preset: cfg.preset,
				blur: cfg.blur,
				opacity: cfg.opacity,
				rim: cfg.rim,
				highlight: cfg.highlight,
				lensing: cfg.lensing,
				lightAngle: cfg.lightAngle,
			}}
			className={`openglass-card ${className}`}
			style={{
				width: "100%",
				padding: cfg.padding,
				borderRadius: cfg.radius,
				border: cfg.border,
				boxShadow: cfg.boxShadow,
				background: cfg.contrastBed,
				boxSizing: "border-box",
				transition: "all 0.25s ease",
				...style,
			}}
			{...props}
		>
			{children}
		</Glass>
	);
}

/**
 * 🪟 GlassModal: Single unified modal/dialog wrapper matching demo.html
 */
export function GlassModal({
	open,
	onOpenChange,
	title,
	description,
	children,
	className = "",
	...props
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			closeOnBackdrop={true}
			className={`openglass-modal ${className}`}
			{...props}
		>
			{children}
		</Dialog>
	);
}

/**
 * 📜 GlassRow: Single unified interactive row (for settings, dhikr, audio)
 */
export function GlassRow({
	title,
	subtitle,
	leading,
	trailing,
	onClick,
	className = "",
	style = {},
	children,
}) {
	const cfg = OPEN_GLASS_CONFIG.row;
	return (
		<div
			onClick={onClick}
			className={`openglass-row ${className}`}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "14px",
				padding: cfg.padding,
				borderRadius: cfg.radius,
				background: cfg.background,
				border: cfg.border,
				boxSizing: "border-box",
				transition: "background 0.18s ease, transform 0.18s ease",
				cursor: onClick ? "pointer" : "default",
				...style,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
				{leading}
				{(title || subtitle) && (
					<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
						{title && (
							<span style={{ fontSize: "0.95rem", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em" }}>
								{title}
							</span>
						)}
						{subtitle && (
							<span style={{ fontSize: "0.80rem", color: "rgba(255, 255, 255, 0.70)", marginTop: "2px" }}>
								{subtitle}
							</span>
						)}
					</div>
				)}
			</div>
			{trailing || children}
		</div>
	);
}
