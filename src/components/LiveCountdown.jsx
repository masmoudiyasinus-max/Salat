import React, { useEffect, useState } from "react";
import { getCityNowDate, toWesternDigits } from "../services/storage";

export default function LiveCountdown({
	nextDateObj,
	timezone,
	language = "ar",
}) {
	const [countdownStr, setCountdownStr] = useState("");

	useEffect(() => {
		if (
			!nextDateObj ||
			!(nextDateObj instanceof Date) ||
			isNaN(nextDateObj.getTime())
		) {
			setCountdownStr("");
			return;
		}

		const update = () => {
			if (document.hidden) return;
			const cityNow = getCityNowDate(timezone);
			const safeNow = isNaN(cityNow.getTime()) ? new Date() : cityNow;
			const remainingMs = Math.max(
				0,
				nextDateObj.getTime() - safeNow.getTime(),
			);
			const remainingSecs = Math.floor(remainingMs / 1000);
			const remH = Math.floor(remainingSecs / 3600);
			const remM = Math.floor((remainingSecs % 3600) / 60);
			const remS = remainingSecs % 60;
			const str =
				remH > 0
					? `${String(remH).padStart(2, "0")}:${String(remM).padStart(2, "0")}:${String(remS).padStart(2, "0")}`
					: `${String(remM).padStart(2, "0")}:${String(remS).padStart(2, "0")}`;
			setCountdownStr(toWesternDigits(str));
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
	}, [nextDateObj, timezone]);

	if (
		!nextDateObj ||
		!(nextDateObj instanceof Date) ||
		isNaN(nextDateObj.getTime()) ||
		!countdownStr
	) {
		return null;
	}

	return (
		<span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
			{language === "en"
				? `• ${countdownStr} remaining`
				: `• المتبقي ${countdownStr}`}
		</span>
	);
}
