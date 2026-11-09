import { Check, ChevronDown, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	getLocalizedCityName,
	getLocalizedCountryName,
	matchesStrictPrefix,
} from "../../services/countryLocalization";

export default function SearchableSelect({
	label,
	value,
	options = [],
	onChange,
	placeholder = "اختر...",
	disabled = false,
	isEn = false,
	icon: Icon,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [openUpwards, setOpenUpwards] = useState(false);
	const containerRef = useRef(null);

	// Close on outside click
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (containerRef.current && !containerRef.current.contains(e.target)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Dynamically detect space above vs below to prevent clipping
	useEffect(() => {
		if (isOpen && containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			if (spaceBelow < 280 && rect.top > 280) {
				setOpenUpwards(true);
			} else {
				setOpenUpwards(false);
			}
		}
	}, [isOpen]);

	const currentOption = useMemo(() => {
		if (!value) return null;
		const target = String(value)
			.trim()
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");

		// 1. Direct match
		const direct = options.find((opt) => {
			const optVal =
				typeof opt === "object" ? opt.value || opt.id || opt.name : opt;
			return String(optVal).toLowerCase() === String(value).toLowerCase();
		});
		if (direct) return direct;

		// 2. Normalized match (accents / diacritics stripped)
		const normMatch = options.find((opt) => {
			const optVal =
				typeof opt === "object" ? opt.value || opt.id || opt.name : opt;
			const optValNorm = String(optVal)
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "");
			return optValNorm === target;
		});
		if (normMatch) return normMatch;

		// 3. Localized label match
		return (
			options.find((opt) => {
				const optLbl = typeof opt === "object" ? opt.label || opt.name : "";
				const optLblNorm = String(optLbl)
					.toLowerCase()
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "");
				return optLblNorm === target;
			}) || null
		);
	}, [value, options]);

	const displayLabel = useMemo(() => {
		if (currentOption) {
			return typeof currentOption === "object"
				? currentOption.label || currentOption.name || currentOption.id
				: currentOption;
		}
		if (!value) return placeholder;

		// Intelligent fallback localization
		const lang = isEn ? "en" : "ar";
		const localizedCountry = getLocalizedCountryName(value, lang);
		if (localizedCountry && localizedCountry !== value) return localizedCountry;

		const localizedCity = getLocalizedCityName(value, lang);
		if (localizedCity) return localizedCity;

		return value;
	}, [currentOption, value, placeholder, isEn]);

	const filteredOptions = useMemo(() => {
		if (!searchTerm.trim()) return options;
		return options.filter((opt) => {
			const optLbl =
				typeof opt === "object"
					? opt.label || opt.name || opt.id || opt.value
					: String(opt);
			const optVal =
				typeof opt === "object" ? opt.value || opt.id || opt.name : String(opt);
			return (
				matchesStrictPrefix(optLbl, searchTerm) ||
				matchesStrictPrefix(optVal, searchTerm) ||
				String(optLbl).toLowerCase().includes(searchTerm.toLowerCase()) ||
				String(optVal).toLowerCase().includes(searchTerm.toLowerCase())
			);
		});
	}, [options, searchTerm]);

	return (
		<div
			ref={containerRef}
			style={{
				position: "relative",
				width: "100%",
				marginBottom: "16px",
				zIndex: isOpen ? 1000 : 1,
			}}
		>
			{label && (
				<label
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						fontSize: "0.88rem",
						fontWeight: "600",
						color: "#e5e5e5",
						marginBottom: "6px",
					}}
				>
					{Icon && <Icon size={16} style={{ color: "#ffffff" }} />}
					<span>{label}</span>
				</label>
			)}

			{/* Select Box Header Button */}
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					if (!disabled) {
						setIsOpen((prev) => !prev);
						setSearchTerm("");
					}
				}}
				style={{
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "12px 16px",
					backgroundColor: "rgba(255, 255, 255, 0.05)",
					border: `var(--card-border-width) solid ${isOpen ? "var(--card-border-highlight)" : "var(--card-border-color)"}`,
					borderRadius: "var(--button-radius)",
					color: value ? "#ffffff" : "#a3a3a3",
					fontSize: "0.92rem",
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? 0.6 : 1,
					transition: "all 0.2s ease",
					boxSizing: "border-box",
				}}
			>
				<span
					style={{
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{displayLabel}
				</span>
				<ChevronDown
					size={18}
					style={{
						color: "#a3a3a3",
						transform: isOpen ? "rotate(180deg)" : "none",
						transition: "transform 0.2s ease",
					}}
				/>
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div
					className="glass-panel"
					style={{
						position: "absolute",
						...(openUpwards
							? { bottom: "calc(100% + 6px)", top: "auto" }
							: { top: "calc(100% + 6px)", bottom: "auto" }),
						left: 0,
						right: 0,
						zIndex: 10000,
						backgroundColor: "var(--glass-bg)",
						border: "var(--card-border-width) solid var(--card-border-color)",
						borderRadius: "var(--card-radius)",
						boxShadow: "var(--glass-shadow)",
						backdropFilter: "blur(var(--glass-blur))",
						WebkitBackdropFilter: "blur(var(--glass-blur))",
						padding: "8px",
						maxHeight: "260px",
						display: "flex",
						flexDirection: "column",
					}}
				>
					{/* Search Box */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							padding: "8px 12px",
							backgroundColor: "rgba(255, 255, 255, 0.06)",
							borderRadius: "var(--button-radius)",
							border: "var(--card-border-width) solid var(--card-border-color)",
							marginBottom: "6px",
						}}
					>
						<Search size={16} style={{ color: "#a3a3a3" }} />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="ابحث..."
							autoFocus
							style={{
								width: "100%",
								backgroundColor: "transparent",
								border: "none",
								color: "#ffffff",
								fontSize: "0.88rem",
								outline: "none",
								fontFamily: "inherit",
							}}
						/>
						{searchTerm && (
							<button
								type="button"
								onClick={() => setSearchTerm("")}
								style={{
									background: "transparent",
									border: "none",
									color: "#a3a3a3",
									cursor: "pointer",
									padding: "2px",
								}}
							>
								<X size={14} />
							</button>
						)}
					</div>

					{/* Options List */}
					<div style={{ overflowY: "auto", flex: 1 }}>
						{filteredOptions.length === 0 ? (
							<div
								style={{
									padding: "16px",
									textAlign: "center",
									color: "#737373",
									fontSize: "0.85rem",
								}}
							>
								لا توجد نتائج مطابقة
							</div>
						) : (
							filteredOptions.map((opt, idx) => {
								const optVal =
									typeof opt === "object"
										? opt.value || opt.id || opt.name
										: opt;
								const optLbl =
									typeof opt === "object"
										? opt.label || opt.name || opt.id || opt.value
										: opt;
								const isSelected =
									String(optVal).toLowerCase() === String(value).toLowerCase();

								return (
									<button
										key={idx}
										type="button"
										onClick={() => {
											onChange(optVal);
											setIsOpen(false);
										}}
										style={{
											width: "100%",
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											padding: "10px 12px",
											borderRadius: "8px",
											backgroundColor: isSelected
												? "rgba(255, 255, 255, 0.15)"
												: "transparent",
											color: isSelected ? "#ffffff" : "#e5e5e5",
											border: "none",
											fontSize: "0.88rem",
											cursor: "pointer",
											textAlign: "right",
											transition: "all 0.1s ease",
											marginBottom: "2px",
										}}
									>
										<span>{optLbl}</span>
										{isSelected && (
											<Check size={16} style={{ color: "#ffffff" }} />
										)}
									</button>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
