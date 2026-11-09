import React, { useEffect, useState } from "react";
import { getCityNowDate } from "../services/storage";

export default function LiveProgressBar({
	currentDateObj,
	nextDateObj,
	timezone,
	isActiveCompleted,
}) {
	const [progressPct, setProgressPct] = useState(0);
	const [timeStage, setTimeStage] = useState("on_time_15"); // 'on_time_15' | 'mid_yellow' | 'ending_red'

	useEffect(() => {
		if (
			!currentDateObj ||
			!nextDateObj ||
			!(currentDateObj instanceof Date) ||
			!(nextDateObj instanceof Date) ||
			isNaN(currentDateObj.getTime()) ||
			isNaN(nextDateObj.getTime())
		) {
			setProgressPct(0);
			return;
		}

		const update = () => {
			if (document.hidden) return;
			const cityNow = getCityNowDate(timezone);
			const safeNow = isNaN(cityNow.getTime()) ? new Date() : cityNow;

			const elapsedMs = Math.max(
				0,
				safeNow.getTime() - currentDateObj.getTime(),
			);
			const remainingMs = Math.max(
				0,
				nextDateObj.getTime() - safeNow.getTime(),
			);

			const elapsedSecs = Math.floor(elapsedMs / 1000);
			const remainingSecs = Math.floor(remainingMs / 1000);
			const totalSecs = elapsedSecs + remainingSecs;

			const pct =
				totalSecs > 0
					? Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100))
					: 0;
			setProgressPct(isNaN(pct) ? 0 : pct);

			const elapsedMins = elapsedSecs / 60;
			const remainingMins = remainingSecs / 60;

			if (elapsedMins <= 15) {
				setTimeStage("on_time_15");
			} else if (remainingMins <= 15) {
				setTimeStage("ending_red");
			} else {
				setTimeStage("mid_yellow");
			}
		};

		const handleVisibilityChange = () => {
			if (!document.hidden) update();
		};

		update();
		const timer = setInterval(update, 1000);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [currentDateObj, nextDateObj, timezone]);

	let barBackground = "#ffffff";
	let barGlow = "0 0 10px rgba(255, 255, 255, 0.5)";

	if (isActiveCompleted) {
		// Completed prayer state: Pure radiant white
		barBackground = "#ffffff";
		barGlow = "0 0 10px rgba(255, 255, 255, 0.5)";
	} else if (timeStage === "on_time_15") {
		// First 15 minutes of Adhan: Pure White
		barBackground = "#ffffff";
		barGlow = "0 0 10px rgba(255, 255, 255, 0.5)";
	} else if (timeStage === "ending_red") {
		// Last 15 minutes before next Adhan: Red
		barBackground = "#ef4444";
		barGlow = "0 0 8px rgba(239, 68, 68, 0.4)";
	} else {
		// Standard progress stage: Pure White
		barBackground = "#ffffff";
		barGlow = "0 0 10px rgba(255, 255, 255, 0.5)";
	}

	if (
		!currentDateObj ||
		!nextDateObj ||
		!(currentDateObj instanceof Date) ||
		!(nextDateObj instanceof Date) ||
		isNaN(currentDateObj.getTime()) ||
		isNaN(nextDateObj.getTime())
	) {
		return null;
	}

	return (
		<div style={{ width: "100%", padding: "6px 0", margin: "4px 0" }}>
			<div
				style={{
					width: "100%",
					height: "3px",
					backgroundColor: "rgba(255, 255, 255, 0.08)",
					borderRadius: "3px",
					position: "relative",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: 0,
						insetInlineStart: 0,
						height: "100%",
						width: `${progressPct}%`,
						background: barBackground,
						boxShadow: barGlow,
						borderRadius: "3px",
						transition: "none",
					}}
				/>
			</div>
		</div>
	);
}
