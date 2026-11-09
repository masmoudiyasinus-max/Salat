import { Globe, Lock, MapPin, Navigation } from "lucide-react";
import { Button, Card } from "open-glass-ui";
import React from "react";
import SearchableSelect from "./SearchableSelect";

export default function LocationSettingsSection({
	country,
	city,
	countryOptions,
	cityOptions,
	isDetectingLocation,
	isOnline,
	isEn,
	onAutoDetectLocation,
	onCountryChange,
	onCityChange,
}) {
	return (
		<Card
			eyebrow={isEn ? "Prayer Timings Location" : "موقع مواقيت الصلاة"}
			title={
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						width: "100%",
						flexWrap: "wrap",
						gap: "12px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<MapPin size={22} style={{ color: "var(--ogui-color-accent, #38bdf8)" }} />
						<span>
							{isEn
								? "Location & Aladhan Timings"
								: "الموقع ومواقيت الصلاة الرسمية"}
						</span>
					</div>

					<Button
						variant="secondary"
						size="small"
						onClick={isOnline ? onAutoDetectLocation : undefined}
						disabled={isDetectingLocation || !isOnline}
						leadingIcon={
							!isOnline ? (
								<Lock size={14} />
							) : (
								<Navigation
									size={14}
									className={isDetectingLocation ? "spin-icon" : ""}
								/>
							)
						}
					>
						{isDetectingLocation
							? isEn ? "Detecting..." : "جاري التحديد..."
							: !isOnline
								? isEn ? "GPS (Requires Internet)" : "تحديد الموقع (يتطلب إنترنت)"
								: isEn ? "Auto Detect (GPS)" : "تحديد الموقع تلقائياً (GPS)"}
					</Button>
				</div>
			}
		>
			<p
				style={{
					margin: "0 0 16px 0",
					fontSize: "0.82rem",
					color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
				}}
			>
				{isEn
					? "Official prayer times powered directly by Aladhan API with offline astronomical calculation"
					: "مواقيت صلاة رسمية دقيقة 100% مع حساب فلكي محلي يعمل دون إنترنت"}
			</p>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "16px",
				}}
			>
				<SearchableSelect
					label="الدولة"
					value={country}
					options={countryOptions}
					onChange={onCountryChange}
					placeholder="اختر الدولة..."
					isEn={isEn}
					icon={Globe}
				/>

				<SearchableSelect
					label="المدينة"
					value={city}
					options={cityOptions}
					onChange={onCityChange}
					placeholder={country ? "اختر المدينة..." : "يرجى اختيار الدولة أولاً"}
					disabled={!country}
					isEn={isEn}
					icon={MapPin}
				/>
			</div>
		</Card>
	);
}
