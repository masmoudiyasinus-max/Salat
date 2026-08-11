import { parsePrayerTimesWithGeminiAI } from './geminiApi';

export async function fetchPrayerTimesFromTavily(
  apiKey,
  sourceUrl,
  manualCity,
  manualCountry,
  targetDateStr = '',
  geminiApiKey = ''
) {
  let city = manualCity || 'Sfax';
  let country = manualCountry || 'Tunisia';
  const dateQueryText = targetDateStr ? `tomorrow ${targetDateStr}` : 'today';

  // Helper to parse text using Gemini AI first, fallback to regex
  const parseWithAIOrRegex = async (rawText) => {
    if (geminiApiKey && geminiApiKey.trim() !== '') {
      const aiResult = await parsePrayerTimesWithGeminiAI(geminiApiKey, rawText, city, country, targetDateStr);
      if (aiResult && isValidPrayerTimes(aiResult)) {
        return { times: aiResult, isAI: true };
      }
    }
    const regexResult = parsePrayerTimesFromText(rawText, targetDateStr);
    if (regexResult && isValidPrayerTimes(regexResult)) {
      return { times: regexResult, isAI: false };
    }
    return null;
  };

  // 1. Direct Web Scraper from User-specified Source URL (If sourceUrl provided)
  if (sourceUrl && sourceUrl.trim() !== '') {
    try {
      const cleanUrl = sourceUrl.trim();
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const htmlText = await res.text();
        const parseRes = await parseWithAIOrRegex(htmlText);
        if (parseRes && parseRes.times) {
          const domain = cleanUrl.replace(/^https?:\/\//, '').split('/')[0];
          const tag = parseRes.isAI ? 'صياغة الذكاء الاصطناعي (Gemini AI)' : 'الموقع المصدر';
          return {
            success: true,
            times: parseRes.times,
            source: targetDateStr ? `مواقيت الغد عبر ${tag} (${domain})` : `${tag} (${domain})`,
          };
        }
      }
    } catch (err) {
      console.warn('Source URL scraping fallback:', err);
    }
  }

  // 2. Tavily Web Search API (If Tavily API Key provided)
  if (apiKey && apiKey.trim() !== '') {
    try {
      let queryText = `prayer times ${city} ${country} ${dateQueryText}`;
      if (sourceUrl && sourceUrl.trim() !== '') {
        try {
          const cleanUrl = sourceUrl.replace(/^https?:\/\//, '');
          queryText = `site:${cleanUrl.split('/')[0]} prayer times ${dateQueryText} ${city}`;
        } catch (e) {
          queryText = `prayer times ${city} ${country} ${dateQueryText} ${sourceUrl}`;
        }
      }

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: queryText,
          search_depth: 'basic',
          include_raw_content: true,
          max_results: 3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.stringify(data.results || []);
        const parseRes = await parseWithAIOrRegex(content);
        if (parseRes && parseRes.times) {
          const tag = parseRes.isAI ? 'بحث وتصحيح الذكاء الاصطناعي (Gemini AI)' : 'البحث العام في الويب (Tavily API)';
          return {
            success: true,
            times: parseRes.times,
            source: targetDateStr ? `مواقيت الغد عبر (${tag})` : `(${tag})`,
          };
        }
      }
    } catch (err) {
      console.warn('Tavily general web search error, falling back:', err);
    }
  }

  // 3. Official Aladhan Structured API with Date Path Endpoint (Guaranteed Fallback)
  try {
    let datePath = '';
    if (targetDateStr) {
      const parts = targetDateStr.split('-');
      if (parts.length === 3) {
        datePath = `/${parts[2]}-${parts[1]}-${parts[0]}`; // /DD-MM-YYYY in URL path!
      }
    }

    const fallbackRes = await fetch(
      `https://api.aladhan.com/v1/timingsByCity${datePath}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=3`
    );
    if (fallbackRes.ok) {
      const json = await fallbackRes.json();
      const timings = json?.data?.timings;
      if (timings) {
        const structuredTimes = {
          Fajr: cleanTime(timings.Fajr),
          Sunrise: cleanTime(timings.Sunrise),
          Dhuhr: cleanTime(timings.Dhuhr),
          Asr: cleanTime(timings.Asr),
          Maghrib: cleanTime(timings.Maghrib),
          Isha: cleanTime(timings.Isha),
        };

        if (isValidPrayerTimes(structuredTimes)) {
          return {
            success: true,
            times: structuredTimes,
            timezone: json?.data?.meta?.timezone || '',
            source: targetDateStr ? `مواقيت الغد الرسمية (${city}, ${country})` : `المواقيت الحية (${city}, ${country})`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Aladhan API error:', err);
  }

  // Default fallback times
  return {
    success: true,
    times: {
      Fajr: '04:15',
      Sunrise: '05:45',
      Dhuhr: '12:30',
      Asr: '16:00',
      Maghrib: '19:30',
      Isha: '21:00',
    },
    source: 'الذاكرة الافتراضية',
  };
}

function cleanTime(tStr) {
  if (!tStr) return '00:00';
  const clean = tStr.split(' ')[0];
  const parts = clean.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

function isValidPrayerTimes(times) {
  if (!times || !times.Fajr || !times.Dhuhr || !times.Asr || !times.Maghrib || !times.Isha) {
    return false;
  }
  const toMins = (t) => {
    if (typeof t !== 'string' || !t.includes(':')) return -1;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  };

  const f = toMins(times.Fajr);
  const d = toMins(times.Dhuhr);
  const a = toMins(times.Asr);
  const m = toMins(times.Maghrib);
  const i = toMins(times.Isha);

  if (f < 0 || d < 0 || a < 0 || m < 0 || i < 0) return false;

  // Chronological verification: Fajr < Dhuhr < Asr < Maghrib < Isha
  if (f >= d || d >= a || a >= m || m >= i) return false;

  return true;
}

function parsePrayerTimesFromText(text, targetDateStr = '') {
  if (!text) return null;
  const normalizedText = text.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  // If targetDateStr provided (e.g. 2026-08-07), attempt to match multi-column table row for that date
  if (targetDateStr) {
    const parts = targetDateStr.split('-');
    if (parts.length === 3) {
      const dayPad = parts[2];
      const monthPad = parts[1];
      const dayNum = parseInt(parts[2], 10);
      const monthNum = parseInt(parts[1], 10);

      // Match table row containing DD/MM or DD-MM or Day Number followed by 5-6 time values
      const rowRegex = new RegExp(`(?:${dayPad}[/-]${monthPad}|${dayNum}[/-]${monthNum})\\D+?(\\d{1,2}:\\d{2})\\D+?(\\d{1,2}:\\d{2})\\D+?(\\d{1,2}:\\d{2})\\D+?(\\d{1,2}:\\d{2})\\D+?(\\d{1,2}:\\d{2})\\D+?(\\d{1,2}:\\d{2})`, 'i');
      const match = normalizedText.match(rowRegex);
      if (match) {
        const times = {
          Fajr: cleanTime(match[1]),
          Sunrise: cleanTime(match[2]),
          Dhuhr: cleanTime(match[3]),
          Asr: cleanTime(match[4]),
          Maghrib: cleanTime(match[5]),
          Isha: cleanTime(match[6]),
        };
        if (isValidPrayerTimes(times)) return times;
      }
    }
  }

  // Fallback to keyword matching
  const times = {};
  const fajrMatch = normalizedText.match(/(?:fajr|الفجر)\D*?(\d{1,2}:\d{2})/i);
  const sunriseMatch = normalizedText.match(/(?:sunrise|الشروق)\D*?(\d{1,2}:\d{2})/i);
  const dhuhrMatch = normalizedText.match(/(?:dhuhr|zuhr|الظهر)\D*?(\d{1,2}:\d{2})/i);
  const asrMatch = normalizedText.match(/(?:asr|العصر)\D*?(\d{1,2}:\d{2})/i);
  const maghribMatch = normalizedText.match(/(?:maghrib|المغرب)\D*?(\d{1,2}:\d{2})/i);
  const ishaMatch = normalizedText.match(/(?:isha|العشاء)\D*?(\d{1,2}:\d{2})/i);

  if (fajrMatch) times.Fajr = cleanTime(fajrMatch[1]);
  if (sunriseMatch) times.Sunrise = cleanTime(sunriseMatch[1]);
  if (dhuhrMatch) times.Dhuhr = cleanTime(dhuhrMatch[1]);
  if (asrMatch) times.Asr = cleanTime(asrMatch[1]);
  if (maghribMatch) times.Maghrib = cleanTime(maghribMatch[1]);
  if (ishaMatch) times.Isha = cleanTime(ishaMatch[1]);

  if (Object.keys(times).length >= 5) {
    return times;
  }
  return null;
}
