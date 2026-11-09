/**
 * Localization & Search Utilities
 * Pure algorithmic operations for transliteration, city/country localization, and search prefix matching.
 */

import {
	ALGERIAN_CITIES,
	ARABIC_CITY_MAP,
	ARABIC_COUNTRY_NAMES,
	CANONICAL_ENGLISH_COUNTRY_MAP,
	EGYPTIAN_CITIES,
	EMIRATI_CITIES,
	MOROCCAN_CITIES,
	PALESTINIAN_CITIES,
	SAUDI_CITIES,
	TUNISIAN_CITIES,
} from "./cityData.js";

/**
 * Returns localized country name according to active application language ('ar' or 'en').
 */
export function getLocalizedCountryName(englishCountryName, language = "ar") {
	if (!englishCountryName || typeof englishCountryName !== "string") return "";
	const rawLower = englishCountryName.trim().toLowerCase();
	const clean = rawLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

	if (language === "en") {
		if (CANONICAL_ENGLISH_COUNTRY_MAP[rawLower])
			return CANONICAL_ENGLISH_COUNTRY_MAP[rawLower];
		if (CANONICAL_ENGLISH_COUNTRY_MAP[clean])
			return CANONICAL_ENGLISH_COUNTRY_MAP[clean];
		if (clean === "israel") return "Palestine";
		return englishCountryName;
	}

	// Arabic localization
	if (ARABIC_COUNTRY_NAMES[rawLower]) {
		return ARABIC_COUNTRY_NAMES[rawLower];
	}
	if (ARABIC_COUNTRY_NAMES[clean]) {
		return ARABIC_COUNTRY_NAMES[clean];
	}

	// If already pure Arabic
	if (/[\u0600-\u06FF]/.test(englishCountryName)) {
		return englishCountryName;
	}

	return englishCountryName;
}

/**
 * Returns a robust list of curated official cities/governorates for any given country.
 */
export function getCuratedCitiesForCountry(countryName) {
	if (!countryName || typeof countryName !== "string") return [];
	const clean = countryName
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	if (clean === "tunisia" || clean === "tunisie" || clean === "تونس")
		return TUNISIAN_CITIES;
	if (clean === "palestine" || clean === "israel" || clean === "فلسطين")
		return PALESTINIAN_CITIES;
	if (
		clean === "saudi arabia" ||
		clean === "arabie saoudite" ||
		clean === "السعودية"
	)
		return SAUDI_CITIES;
	if (clean === "egypt" || clean === "egypte" || clean === "مصر")
		return EGYPTIAN_CITIES;
	if (clean === "algeria" || clean === "algerie" || clean === "الجزائر")
		return ALGERIAN_CITIES;
	if (clean === "morocco" || clean === "maroc" || clean === "المغرب")
		return MOROCCAN_CITIES;
	if (
		clean === "united arab emirates" ||
		clean === "emirats arabes unis" ||
		clean === "الإمارات" ||
		clean === "uae"
	)
		return EMIRATI_CITIES;

	return [];
}

/**
 * Strips French/English/Arabic administrative prefixes and extracts cardinal directions.
 */
export function cleanAdministrativePrefixesAndDirections(rawCityName) {
	if (!rawCityName || typeof rawCityName !== "string")
		return { base: "", direction: "", isDirectional: false };

	const normalized = rawCityName
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	const lower = normalized.toLowerCase();

	// 1. Detect cardinal direction
	let direction = "";
	if (/\b(ouest|west)\b/i.test(lower)) direction = "ouest";
	else if (/\b(est|east)\b/i.test(lower)) direction = "est";
	else if (/\b(nord|north)\b/i.test(lower)) direction = "nord";
	else if (/\b(sud|south)\b/i.test(lower)) direction = "sud";
	else if (/\b(ville|city|centre|center|medina|médina)\b/i.test(lower))
		direction = "ville";

	// 2. Strip administrative prefixes
	const base = lower
		.replace(
			/\b(delegation|délégation|gouvernorat|governorate|wilaya|province|district|commune|municipality|region|state)\s+(de\s+|du\s+|d'|of\s+)?/gi,
			"",
		)
		.replace(
			/\s+\b(delegation|délégation|gouvernorat|governorate|wilaya|province|district|commune|municipality|region|state)\b/gi,
			"",
		)
		.replace(
			/\b(ouest|west|est|east|nord|north|sud|south|ville|centre|center|medina|médina)\b/gi,
			"",
		)
		.replace(/^(ولاية|محافظة|منطقة|بلدية|إقليم|دائرة|معتمدية)\s+/gi, "")
		.replace(/[\s\-_/]+/g, " ")
		.trim();

	return {
		base,
		direction,
		isDirectional: Boolean(direction),
	};
}

/**
 * Phonetic transliterator from Latin to Arabic for unlisted foreign city names.
 * Ensures pure Arabic output without any residual Latin characters.
 */
export function transliterateLatinToArabic(latinStr) {
	if (!latinStr || typeof latinStr !== "string") return "";
	if (/^[\u0600-\u06FF\s\d\-.,/]+$/.test(latinStr)) return latinStr.trim();

	const map = {
		sh: "ش",
		ch: "تش",
		th: "ث",
		kh: "خ",
		gh: "غ",
		ph: "ف",
		ou: "و",
		oo: "و",
		ee: "ي",
		aa: "ا",
		ai: "اي",
		ei: "ي",
		ay: "اي",
		ey: "ي",
		a: "ا",
		b: "ب",
		c: "ك",
		d: "د",
		e: "ي",
		f: "ف",
		g: "ج",
		h: "ه",
		i: "ي",
		j: "ج",
		k: "ك",
		l: "ل",
		m: "م",
		n: "ن",
		o: "و",
		p: "ب",
		q: "ق",
		r: "ر",
		s: "س",
		t: "ت",
		u: "و",
		v: "ف",
		w: "و",
		x: "كس",
		y: "ي",
		z: "ز",
	};

	// Strip all diacritics / accents first (e.g. é -> e, à -> a)
	const str = latinStr
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/['"`-]/g, " ")
		.trim();

	const words = str.split(/\s+/);

	const arWords = words.map((w) => {
		let res = "";
		let i = 0;
		while (i < w.length) {
			if (i + 1 < w.length && map[w.substring(i, i + 2)]) {
				res += map[w.substring(i, i + 2)];
				i += 2;
			} else if (map[w[i]]) {
				res += map[w[i]];
				i += 1;
			} else if (/[a-zA-Z]/.test(w[i])) {
				// Skip unmapped Latin char to avoid hybrid words
				i += 1;
			} else {
				res += w[i];
				i += 1;
			}
		}
		return res;
	});

	return arWords.filter(Boolean).join(" ");
}

/**
 * Returns localized city name according to active application language ('ar' or 'en').
 */
export function getLocalizedCityName(rawCityName, language = "ar") {
	if (!rawCityName || typeof rawCityName !== "string") return "";

	const parsed = cleanAdministrativePrefixesAndDirections(rawCityName);
	const rawLower = rawCityName.trim().toLowerCase();
	const normalized = rawLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

	if (language === "en") {
		// English clean display
		if (parsed.isDirectional && parsed.base) {
			const capBase =
				parsed.base.charAt(0).toUpperCase() + parsed.base.slice(1);
			const dirMap = {
				ouest: "West",
				est: "East",
				nord: "North",
				sud: "South",
				ville: "Medina",
			};
			return `${capBase} ${dirMap[parsed.direction] || ""}`.trim();
		}
		return rawCityName;
	}

	// If already pure Arabic
	if (/^[\u0600-\u06FF\s\d\-.,/]+$/.test(rawCityName.trim())) {
		return rawCityName.trim();
	}

	// 1. Direct dictionary match with raw / normalized input
	if (ARABIC_CITY_MAP[rawLower]) {
		return ARABIC_CITY_MAP[rawLower];
	}
	if (ARABIC_CITY_MAP[normalized]) {
		return ARABIC_CITY_MAP[normalized];
	}

	// 2. Match with cleaned base name + direction
	if (parsed.base && ARABIC_CITY_MAP[parsed.base]) {
		const baseAr = ARABIC_CITY_MAP[parsed.base];
		if (parsed.direction === "ouest") return `${baseAr} الغربية`;
		if (parsed.direction === "est") return `${baseAr} الشرقية`;
		if (parsed.direction === "nord") return `${baseAr} الشمالية`;
		if (parsed.direction === "sud") return `${baseAr} الجنوبية`;
		if (parsed.direction === "ville") return `${baseAr} المدينة`;
		return baseAr;
	}

	// 3. Transliteration for unlisted cities
	const transliterated = transliterateLatinToArabic(parsed.base || rawCityName);
	if (transliterated && !/[a-zA-Z]/.test(transliterated)) {
		if (parsed.direction === "ouest") return `${transliterated} الغربية`;
		if (parsed.direction === "est") return `${transliterated} الشرقية`;
		if (parsed.direction === "nord") return `${transliterated} الشمالية`;
		if (parsed.direction === "sud") return `${transliterated} الجنوبية`;
		return transliterated;
	}

	return rawCityName;
}

/**
 * Normalizes Arabic and English text for accurate phonetic and prefix comparison.
 */
export function normalizeSearchText(text) {
	if (!text || typeof text !== "string") return "";
	return text
		.trim()
		.toLowerCase()
		.replace(/[أإآ]/g, "ا")
		.replace(/ة/g, "ه")
		.replace(/ى/g, "ي")
		.replace(/[\u064B-\u065F]/g, ""); // Remove tashkeel/diacritics
}

/**
 * Evaluates strict ordered prefix matching:
 * Matches ONLY when the entity or any of its words begins with the search query sequence.
 */
export function matchesStrictPrefix(opt, query) {
	if (!query || !query.trim()) return true;
	const rawQ = query.trim().toLowerCase();
	const normQ = normalizeSearchText(query);
	if (!normQ) return true;

	const label =
		typeof opt === "object" && opt !== null
			? opt.label || opt.name || ""
			: String(opt);
	const value =
		typeof opt === "object" && opt !== null
			? opt.value || opt.id || ""
			: String(opt);

	// 1. Check English value starts with query or any word starts with query
	if (value && typeof value === "string") {
		const valLower = value.toLowerCase();
		if (valLower.startsWith(rawQ)) return true;
		const valWords = valLower.split(/[\s\-_/]+/);
		if (valWords.some((w) => w.startsWith(rawQ))) return true;
	}

	// 2. Check Arabic/Localized label starts with query or any word starts with query
	if (label && typeof label === "string") {
		const normLabel = normalizeSearchText(label);
		if (normLabel.startsWith(normQ)) return true;
		if (normLabel.replace(/^ال/, "").startsWith(normQ)) return true;

		const words = normLabel.split(/[\s\-_/]+/);
		for (const word of words) {
			if (word.startsWith(normQ)) return true;
			if (word.replace(/^ال/, "").startsWith(normQ)) return true;
		}
	}

	return false;
}
