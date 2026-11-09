import React, { useEffect, useState } from "react";
import { resolveTimezoneForLocation } from "../services/adhanCalculator";
import { toWesternDigits } from "../services/storage";

export default function LiveClock({
	timezone,
	city,
	country,
	timeFormat = "12",
	language = "ar",
}) {
	const [now, setNow] = useState(() => new Date());

	const effectiveTz =
		timezone && typeof timezone === "string" && timezone.includes("/")
			? timezone.trim()
			: resolveTimezoneForLocation(city, country);

	useEffect(() => {
		const update = () => {
			if (!document.hidden) {
				setNow(new Date());
			}
		};
		update();
		const timer = setInterval(update, 1000);
		const handleVis = () => {
			if (!document.hidden) update();
		};
		document.addEventListener("visibilitychange", handleVis);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", handleVis);
		};
	}, [effectiveTz]);

	const isEn = language === "en";
	const is12Hour = (timeFormat || "12") === "12";
	const tzOpt =
		effectiveTz && typeof effectiveTz === "string" && effectiveTz.includes("/")
			? { timeZone: effectiveTz }
			: {};

	let liveClockTime = "";
	try {
		liveClockTime = isEn
			? now.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: is12Hour,
					...tzOpt,
				})
			: toWesternDigits(
					now.toLocaleTimeString("ar-EG-u-nu-latn", {
						hour: "2-digit",
						minute: "2-digit",
						hour12: is12Hour,
						...tzOpt,
					}),
				);
	} catch {
		liveClockTime = now.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: is12Hour,
		});
	}

	let gregorianDateFormatted = "";
	try {
		gregorianDateFormatted = isEn
			? now.toLocaleDateString("en-US", {
					weekday: "long",
					day: "numeric",
					month: "long",
					year: "numeric",
					...tzOpt,
				})
			: toWesternDigits(
					now.toLocaleDateString("ar-EG-u-nu-latn", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
						...tzOpt,
					}),
				);
	} catch {
		gregorianDateFormatted = now.toLocaleDateString("en-US", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}

	let hijriDateFormatted = "";
	try {
		if (isEn) {
			const rawEn = now
				.toLocaleDateString("en-US-u-ca-islamic-umalqura", {
					day: "numeric",
					month: "long",
					year: "numeric",
					...tzOpt,
				})
				.trim();
			hijriDateFormatted = rawEn.endsWith("AH") ? rawEn : `${rawEn} AH`;
		} else {
			const rawAr = toWesternDigits(
				now.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", {
					day: "numeric",
					month: "long",
					year: "numeric",
					...tzOpt,
				}),
			).trim();
			hijriDateFormatted = rawAr.endsWith("هـ") ? rawAr : `${rawAr} هـ`;
		}
	} catch {
		try {
			if (isEn) {
				const rawEn = now
					.toLocaleDateString("en-US-u-ca-islamic", {
						day: "numeric",
						month: "long",
						year: "numeric",
						...tzOpt,
					})
					.trim();
				hijriDateFormatted = rawEn.endsWith("AH") ? rawEn : `${rawEn} AH`;
			} else {
				const rawAr = toWesternDigits(
					now.toLocaleDateString("ar-SA", {
						day: "numeric",
						month: "long",
						year: "numeric",
						...tzOpt,
					}),
				).trim();
				hijriDateFormatted = rawAr.endsWith("هـ") ? rawAr : `${rawAr} هـ`;
			}
		} catch {
			hijriDateFormatted = "";
		}
	}

	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "16px",
				flexWrap: "nowrap",
				whiteSpace: "nowrap",
			}}
		>
			{/* Compact Live Clock */}
			<div
				style={{
					fontSize: "clamp(1.7rem, 3vw, 2.5rem)",
					fontWeight: "700",
					color: "var(--text-primary)",
					lineHeight: "1",
					letterSpacing: "-0.02em",
					whiteSpace: "nowrap",
					flexShrink: 0,
				}}
			>
				{liveClockTime}
			</div>

			{/* Vertical Hairline Divider */}
			<div
				style={{
					width: "1px",
					height: "36px",
					backgroundColor: "var(--border-subtle)",
					flexShrink: 0,
				}}
			/>

			{/* Dates: Gregorian & Hijri */}
			<div
				style={{
					textAlign: isEn ? "left" : "right",
					whiteSpace: "nowrap",
					display: "flex",
					flexDirection: "column",
					gap: "2px",
					flexShrink: 0,
				}}
			>
				<div
					style={{
						fontSize: "1.05rem",
						fontWeight: "700",
						color: "var(--text-primary)",
						lineHeight: 1.2,
						whiteSpace: "nowrap",
					}}
				>
					{gregorianDateFormatted}
				</div>
				<div
					style={{
						fontSize: "0.95rem",
						fontWeight: "600",
						color: "var(--text-secondary)",
						lineHeight: 1.2,
						whiteSpace: "nowrap",
					}}
				>
					<span>{hijriDateFormatted}</span>
				</div>
			</div>
		</div>
	);
}
