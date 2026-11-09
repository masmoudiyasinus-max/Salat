import React from "react";
import { Glass } from "open-glass-ui";

/**
 * GlassBentoCard: Unified crystal liquid glass container matching demo.html
 */
export default function GlassBentoCard({
	children,
	className = "",
	style = {},
	interactive = true,
	look = {
		blur: 1.4,
		opacity: 0.38,
		rim: 1.5,
		highlight: 1.6,
		lensing: 1.6,
		lightAngle: 340,
	},
	...props
}) {
	return (
		<Glass
			as="div"
			material="regular"
			interactive={interactive}
			look={look}
			className={`glass-bento-card ${className}`}
			style={{
				borderRadius: "28px",
				padding: "26px 30px",
				border: "1px solid rgba(255, 255, 255, 0.16)",
				boxShadow: "0 16px 48px rgba(0, 0, 0, 0.4)",
				transition: "transform 0.25s ease, box-shadow 0.25s ease",
				width: "100%",
				...style,
			}}
			{...props}
		>
			{children}
		</Glass>
	);
}
