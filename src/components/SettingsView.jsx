import React, { useEffect, useMemo, useRef, useState } from "react";
import { syncFullMonthFromAladhanApi } from "../services/aladhanApiService";
import {
	getCuratedCitiesForCountry,
	getLocalizedCityName,
	getLocalizedCountryName,
} from "../services/countryLocalization";
import {
	getNotificationPermission,
	requestFreshLocationFromScratch,
	requestNotificationsPermission,
} from "../services/permissionService";
import {
	clearAllRecords,
	clearEntireAppData,
	compressImageFile,
	getSettings,
	saveSettings,
} from "../services/storage";
import AppearanceSettingsSection from "./settings/AppearanceSettingsSection";
import DataBackupSection from "./settings/DataBackupSection";
import KeyboardShortcutsModal, {
	KeyboardShortcutsCard,
} from "./settings/KeyboardShortcutsModal";
import LocationSettingsSection from "./settings/LocationSettingsSection";
import MuneerSettingsSection from "./settings/MuneerSettingsSection";
import NotificationSettingsSection from "./settings/NotificationSettingsSection";
import OfflineBanner from "./settings/OfflineBanner";
import ResetConfirmationModal from "./settings/ResetConfirmationModal";
import GlassViewShell from "./layout/GlassViewShell";

export default function SettingsView({
	settings: propSettings,
	onSettingsSaved,
	isOnline: propIsOnline,
}) {
	const [settings, setSettingsState] = useState(
		() => propSettings || getSettings(),
	);
	const [showGeminiKey, setShowGeminiKey] = useState(false);
	const [isDetectingLocation, setIsDetectingLocation] = useState(false);
	const [countriesList, setCountriesList] = useState([]);
	const [showResetModal, setShowResetModal] = useState(false);
	const [showShortcutsModal, setShowShortcutsModal] = useState(false);
	const [resetType, setResetType] = useState("prayers"); // 'prayers' | 'all'
	const fileInputRef = useRef(null);
	const importInputRef = useRef(null);

	// Browser Notifications Permission state
	const [notifPermission, setNotifPermission] = useState(() =>
		getNotificationPermission(),
	);

	useEffect(() => {
		if (propSettings) {
			setSettingsState(propSettings);
		}
	}, [propSettings]);

	const [isOnline, setIsOnline] = useState(() =>
		propIsOnline !== undefined
			? propIsOnline
			: typeof navigator !== "undefined"
				? navigator.onLine
				: true,
	);

	useEffect(() => {
		if (propIsOnline !== undefined) {
			setIsOnline(propIsOnline);
		}
	}, [propIsOnline]);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// Sync live browser permission updates (address bar clicks, focus, visibility, query events)
	useEffect(() => {
		let permQuery = null;
		const updatePerm = () => {
			setNotifPermission(getNotificationPermission());
		};

		if (typeof window !== "undefined") {
			window.addEventListener("focus", updatePerm);
		}
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", updatePerm);
		}

		if (
			typeof navigator !== "undefined" &&
			navigator.permissions &&
			typeof navigator.permissions.query === "function"
		) {
			navigator.permissions
				.query({ name: "notifications" })
				.then((permStatus) => {
					permQuery = permStatus;
					permStatus.onchange = updatePerm;
				})
				.catch(() => {});
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("focus", updatePerm);
			}
			if (typeof document !== "undefined") {
				document.removeEventListener("visibilitychange", updatePerm);
			}
			if (permQuery) {
				permQuery.onchange = null;
			}
		};
	}, []);

	const lang = settings.language || "ar";
	const isEn = lang === "en";

	useEffect(() => {
		let isMounted = true;
		async function fetchCountries() {
			try {
				const res = await fetch(
					"https://countriesnow.space/api/v0.1/countries",
				);
				if (res.ok) {
					const data = await res.json();
					if (data && !data.error && Array.isArray(data.data) && isMounted) {
						setCountriesList(data.data);
					}
				}
			} catch (err) {
				console.warn("Failed to fetch dynamic country list:", err);
			}
		}
		fetchCountries();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleUpdateSettings = (changes) => {
		setSettingsState((prev) => {
			const fresh = getSettings();
			const updated = {
				...fresh,
				...prev,
				...changes,
				// Strictly protect background & wallpaper settings from being unintentionally reset
				bgMode:
					changes.bgMode !== undefined
						? changes.bgMode
						: prev.bgMode || fresh.bgMode,
				activeCustomBgImage:
					changes.activeCustomBgImage !== undefined
						? changes.activeCustomBgImage
						: prev.activeCustomBgImage || fresh.activeCustomBgImage,
				customBgImages:
					changes.customBgImages !== undefined
						? changes.customBgImages
						: prev.customBgImages || fresh.customBgImages,
			};
			saveSettings(updated);
			if (onSettingsSaved) onSettingsSaved(updated);
			return updated;
		});
	};

	const handleInputChange = (field, value) => {
		handleUpdateSettings({ [field]: value });
	};

	const handleCountryChange = (newCountry) => {
		if (!newCountry) return;
		const countryObj = Array.isArray(countriesList)
			? countriesList.find(
					(c) => c.country.toLowerCase() === newCountry.toLowerCase(),
				)
			: null;
		let defaultCity =
			countryObj &&
			Array.isArray(countryObj.cities) &&
			countryObj.cities.length > 0
				? countryObj.cities[0]
				: "";

		if (!defaultCity) {
			const cLower = newCountry.toLowerCase();
			if (cLower.includes("saudi") || cLower.includes("سعودية"))
				defaultCity = "Riyadh";
			else if (cLower.includes("egypt") || cLower.includes("مصر"))
				defaultCity = "Cairo";
			else if (cLower.includes("palestin") || cLower.includes("فلسطين"))
				defaultCity = "Jerusalem";
			else if (cLower.includes("tunis") || cLower.includes("تونس"))
				defaultCity = "Tunis";
			else if (cLower.includes("alger") || cLower.includes("جزائر"))
				defaultCity = "Algiers";
			else if (cLower.includes("morocco") || cLower.includes("مغرب"))
				defaultCity = "Casablanca";
			else if (cLower.includes("emirates") || cLower.includes("إمارات"))
				defaultCity = "Dubai";
			else if (cLower.includes("france") || cLower.includes("فرنسا"))
				defaultCity = "Paris";
			else if (cLower.includes("turkey") || cLower.includes("تركيا"))
				defaultCity = "Istanbul";
			else if (cLower.includes("jordan") || cLower.includes("أردن"))
				defaultCity = "Amman";
		}

		handleUpdateSettings({ country: newCountry, city: defaultCity });
		if (defaultCity) {
			syncFullMonthFromAladhanApi(defaultCity, newCountry).catch(() => {});
		}
	};

	const handleCityChange = (newCity) => {
		handleUpdateSettings({ city: newCity });
		if (newCity && settings.country) {
			syncFullMonthFromAladhanApi(newCity, settings.country).catch(() => {});
		}
	};

	// Auto GPS Location Detection
	const handleAutoDetectLocation = async () => {
		setIsDetectingLocation(true);
		try {
			const loc = await requestFreshLocationFromScratch();
			if (loc && loc.city && loc.country) {
				handleUpdateSettings({
					city: loc.city,
					country: loc.country,
					timezone: loc.timezone,
				});
				syncFullMonthFromAladhanApi(loc.city, loc.country).catch(() => {});
			}
		} catch (err) {
			console.warn("GPS error:", err);
		} finally {
			setIsDetectingLocation(false);
		}
	};

	// Custom Image Upload Handlers
	const handleImageUpload = async (file) => {
		if (!file || !file.type.startsWith("image/")) return;
		try {
			const base64 = await compressImageFile(file);
			const existing = settings.customBgImages || [];
			const updatedList = [
				base64,
				...existing.filter((img) => img !== base64),
			].slice(0, 10);
			const fresh = getSettings();
			const updated = {
				...fresh,
				...settings,
				customBgImages: updatedList,
				activeCustomBgImage: base64,
				bgMode: "custom_image",
			};
			setSettingsState(updated);
			saveSettings(updated);
			if (onSettingsSaved) onSettingsSaved(updated);
		} catch (err) {
			console.error("Image upload error:", err);
		}
	};

	const handleDeleteImage = (imgToDelete, e) => {
		e.stopPropagation();
		const existing = settings.customBgImages || [];
		const updatedList = existing.filter((img) => img !== imgToDelete);
		const newActive = updatedList[0] || "";
		const fresh = getSettings();
		const updated = {
			...fresh,
			...settings,
			customBgImages: updatedList,
			activeCustomBgImage: newActive,
			bgMode: newActive ? settings.bgMode : "makkah",
		};
		setSettingsState(updated);
		saveSettings(updated);
		if (onSettingsSaved) onSettingsSaved(updated);
	};

	const handleAddNatureWallpaper = () => {
		const updatedList = [
			"/nature-meadow.jpg",
			...(settings.customBgImages || []),
		];
		const fresh = getSettings();
		const updated = {
			...fresh,
			...settings,
			customBgImages: updatedList,
			activeCustomBgImage: "/nature-meadow.jpg",
			bgMode: "custom_image",
		};
		setSettingsState(updated);
		saveSettings(updated);
		if (onSettingsSaved) onSettingsSaved(updated);
	};

	// Country & City Options List
	const countryOptions = useMemo(() => {
		if (!Array.isArray(countriesList) || countriesList.length === 0) {
			return [
				{
					value: "Saudi Arabia",
					label: getLocalizedCountryName("Saudi Arabia", isEn ? "en" : "ar"),
				},
				{
					value: "Egypt",
					label: getLocalizedCountryName("Egypt", isEn ? "en" : "ar"),
				},
				{
					value: "Palestine",
					label: getLocalizedCountryName("Palestine", isEn ? "en" : "ar"),
				},
				{
					value: "Morocco",
					label: getLocalizedCountryName("Morocco", isEn ? "en" : "ar"),
				},
				{
					value: "Algeria",
					label: getLocalizedCountryName("Algeria", isEn ? "en" : "ar"),
				},
				{
					value: "Tunisia",
					label: getLocalizedCountryName("Tunisia", isEn ? "en" : "ar"),
				},
				{
					value: "United Arab Emirates",
					label: getLocalizedCountryName(
						"United Arab Emirates",
						isEn ? "en" : "ar",
					),
				},
			];
		}
		return countriesList
			.map((c) => ({
				value: c.country,
				label: getLocalizedCountryName(c.country, isEn ? "en" : "ar"),
			}))
			.sort((a, b) => a.label.localeCompare(b.label, isEn ? "en" : "ar"));
	}, [countriesList, isEn]);

	const selectedCountryObj = useMemo(() => {
		if (!Array.isArray(countriesList) || !settings.country) return null;
		return countriesList.find(
			(c) => c.country.toLowerCase() === settings.country.toLowerCase(),
		);
	}, [countriesList, settings.country]);

	const cityOptions = useMemo(() => {
		const curated = getCuratedCitiesForCountry(settings.country);
		const apiCities = selectedCountryObj?.cities || [];
		const rawCities = Array.from(
			new Set([
				...curated,
				...apiCities,
				...(settings.city ? [settings.city] : []),
			]),
		);

		return rawCities
			.map((city) => ({
				value: city,
				label: getLocalizedCityName(city, isEn ? "en" : "ar"),
			}))
			.sort((a, b) => a.label.localeCompare(b.label, isEn ? "en" : "ar"));
	}, [settings.country, selectedCountryObj, settings.city, isEn]);

	const handleExecuteReset = () => {
		if (resetType === "prayers") {
			clearAllRecords();
		} else {
			clearEntireAppData();
		}
		setShowResetModal(false);
		window.location.reload();
	};

	const handleRequestNotificationPermission = async () => {
		if (notifPermission === "default") {
			const perm = await requestNotificationsPermission();
			setNotifPermission(perm);
		}
	};

	return (
		<GlassViewShell width="wide">
			{/* Global Offline Status Banner */}
			<OfflineBanner isOnline={isOnline} isEn={isEn} />

			{/* SECTION 1: Location & Aladhan API */}
			<LocationSettingsSection
				country={settings.country}
				city={settings.city}
				countryOptions={countryOptions}
				cityOptions={cityOptions}
				isDetectingLocation={isDetectingLocation}
				isOnline={isOnline}
				isEn={isEn}
				onAutoDetectLocation={handleAutoDetectLocation}
				onCountryChange={handleCountryChange}
				onCityChange={handleCityChange}
			/>

			{/* SECTION 2: Backgrounds & Theme */}
			<AppearanceSettingsSection
				settings={settings}
				isOnline={isOnline}
				isEn={isEn}
				onInputChange={handleInputChange}
				onImageUpload={handleImageUpload}
				onDeleteImage={handleDeleteImage}
				onAddNatureWallpaper={handleAddNatureWallpaper}
				fileInputRef={fileInputRef}
			/>

			{/* SECTION 3: Sheikh Muneer Gemini API Key */}
			<MuneerSettingsSection
				geminiApiKey={settings.geminiApiKey}
				showGeminiKey={showGeminiKey}
				setShowGeminiKey={setShowGeminiKey}
				onInputChange={handleInputChange}
				isEn={isEn}
			/>

			{/* SECTION 4: Browser Notifications & Alerts */}
			<NotificationSettingsSection
				notifPermission={notifPermission}
				onRequestPermission={handleRequestNotificationPermission}
				isEn={isEn}
			/>

			{/* SECTION 5: Data Management & Backup */}
			<DataBackupSection
				onOpenResetModal={(type) => {
					setResetType(type);
					setShowResetModal(true);
				}}
				importInputRef={importInputRef}
				isEn={isEn}
			/>

			{/* SECTION 6: Keyboard Shortcuts & Quick Controls */}
			<KeyboardShortcutsCard
				onOpen={() => setShowShortcutsModal(true)}
				isEn={isEn}
			/>

			{/* Keyboard Shortcuts Map Modal */}
			<KeyboardShortcutsModal
				isOpen={showShortcutsModal}
				onClose={() => setShowShortcutsModal(false)}
				isEn={isEn}
			/>

			{/* Reset Confirmation Modal */}
			<ResetConfirmationModal
				isOpen={showResetModal}
				resetType={resetType}
				onConfirm={handleExecuteReset}
				onCancel={() => setShowResetModal(false)}
				isEn={isEn}
			/>
		</GlassViewShell>
	);
}
