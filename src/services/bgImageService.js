// Real Weather & Location Scenery Service (Powered by Open-Meteo & Tavily Search)
import { toWesternDigits, KEYS } from './storage';

export function getCurrentTimeSlot(cityDate = new Date(), lang = 'ar') {
  const isEn = lang === 'en';
  const hour = cityDate.getHours();
  if (hour >= 4 && hour < 9) {
    return { id: 'slot_1_dawn', nameAr: isEn ? 'Dawn & Morning' : 'الفجر والصباح', queryTime: 'morning dawn sunrise' };
  } else if (hour >= 9 && hour < 15) {
    return { id: 'slot_2_midday', nameAr: isEn ? 'Midday & Noon' : 'الظهر والظهيرة', queryTime: 'sunny midday sky' };
  } else if (hour >= 15 && hour < 19) {
    return { id: 'slot_3_afternoon', nameAr: isEn ? 'Afternoon & Dusk' : 'العصر والغسق', queryTime: 'sunset afternoon' };
  } else if (hour >= 19 && hour < 22) {
    return { id: 'slot_4_evening', nameAr: isEn ? 'Evening & Nightfall' : 'المغرب والعشاء', queryTime: 'dusk evening' };
  } else {
    return { id: 'slot_5_night', nameAr: isEn ? 'Midnight & Late Night' : 'منتصف الليل وآخر الليل', queryTime: 'night starry sky' };
  }
}

// WMO Weather Interpretation Code Table
function getWmoWeatherDescription(wmoCode, lang = 'ar') {
  const isEn = lang === 'en';
  const code = Number(wmoCode);
  switch (code) {
    case 0:
      return isEn ? 'Clear sky' : 'سماء صحوة صافية';
    case 1:
      return isEn ? 'Mainly clear' : 'أجواء صافية غالباً';
    case 2:
      return isEn ? 'Partly cloudy' : 'أجواء غائمة جزئياً';
    case 3:
      return isEn ? 'Overcast' : 'سماء ملبدة بالغيوم';
    case 45:
    case 48:
      return isEn ? 'Foggy atmosphere' : 'أجواء ضبابية';
    case 51:
    case 53:
    case 55:
      return isEn ? 'Light drizzle' : 'رذاذ مطري خفيف';
    case 61:
    case 63:
    case 65:
      return isEn ? 'Rainy weather' : 'أجواء ماطرة مباركة';
    case 71:
    case 73:
    case 75:
      return isEn ? 'Snowfall' : 'تساقط للثلوج';
    case 80:
    case 81:
    case 82:
      return isEn ? 'Rain showers' : 'زخات مطرية منعشة';
    case 95:
    case 96:
    case 99:
      return isEn ? 'Thunderstorm' : 'أجواء رعدية ماطرة';
    default:
      return isEn ? 'Fair atmosphere' : 'أجواء مستقرة ومعتدلة';
  }
}

/**
 * Fetches real, live weather metrics (temperature, condition) from Open-Meteo Free API.
 */
export async function fetchLiveWeatherData(city, country = '', lang = 'ar') {
  if (!city || city.trim() === '') {
    return {
      available: false,
      commentary: lang === 'en' ? 'Location not specified' : 'لم يتم تحديد المدينة بعد',
    };
  }

  const isEn = lang === 'en';
  const cleanCity = city.trim();

  try {
    // 1. Geocode City to obtain accurate Coordinates via Open-Meteo
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error('Geocoding service unavailable');
    
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return {
        available: false,
        commentary: isEn ? `Atmospheric vibes in ${cleanCity}` : `أجواء طيبة ومباركة في ${cleanCity}`,
      };
    }

    const { latitude, longitude } = geoData.results[0];

    // 2. Fetch real current weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day,relative_humidity_2m`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) throw new Error('Weather API request failed');

    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    if (!current) throw new Error('Current weather payload missing');

    const temp = Math.round(current.temperature_2m);
    const wCode = current.weather_code;
    const condText = getWmoWeatherDescription(wCode, lang);

    const formattedTemp = isEn ? `${temp}°C` : `${toWesternDigits(temp)}°م`;
    const commentary = isEn
      ? `${condText} with ${formattedTemp} in ${cleanCity}`
      : `${condText} ودرجة الحرارة ${formattedTemp} في ${cleanCity}`;

    return {
      available: true,
      temperature: temp,
      conditionCode: wCode,
      conditionText: condText,
      commentary,
    };
  } catch (err) {
    console.warn('Real weather fetching fallback:', err.message);
    return {
      available: false,
      commentary: isEn ? `Atmospheric vibes in ${cleanCity}` : `أجواء طيبة ومباركة في ${cleanCity}`,
    };
  }
}

export function getWeatherCommentary(city, slotId, lang = 'ar') {
  const isEn = lang === 'en';
  if (!city) {
    return isEn ? 'Please select your city for weather updates' : 'يرجى تحديد المدينة لعرض الطقس';
  }
  return isEn ? `Atmospheric vibes in ${city}` : `أجواء طيبة ومباركة في ${city}`;
}

export async function downloadRawImage(imageUrl, filename = 'wallpaper.jpg') {
  if (!imageUrl) return;
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    window.open(imageUrl, '_blank');
  }
}

function checkImageLoadable(srcUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = srcUrl;
  });
}

export async function fetchLocationWeatherBgImage(settings, cityDate = new Date(), forceNext = false) {
  const lang = settings?.language || 'ar';
  const isEn = lang === 'en';
  const city = settings?.city || '';
  const country = settings?.country || '';
  const apiKey = settings?.tavilyApiKey || '';
  const slot = getCurrentTimeSlot(cityDate, lang);

  // Fetch real weather data dynamically
  let weatherResult = { available: false, commentary: isEn ? 'Nature Scenery' : 'مشاهد طبيعية' };
  if (city) {
    weatherResult = await fetchLiveWeatherData(city, country, lang);
  }

  const commentary = weatherResult.commentary;

  // Retrieve rejected image URLs from localStorage (namespaced under KEYS)
  const legacyRejectedKey = `bg_rejected_imgs_${(city || 'general').toLowerCase().replace(/\s+/g, '_')}`;
  const rejectedKey = `${KEYS.REJECTED_BG_PREFIX}${(city || 'general').toLowerCase().replace(/\s+/g, '_')}`;
  let rejectedList = [];
  try {
    rejectedList = JSON.parse(localStorage.getItem(rejectedKey) || localStorage.getItem(legacyRejectedKey) || '[]');
  } catch (e) {
    rejectedList = [];
  }

  const legacyActiveKey = `active_bg_${(city || 'general').toLowerCase().replace(/\s+/g, '_')}`;
  const activeKey = `${KEYS.ACTIVE_BG_PREFIX}${(city || 'general').toLowerCase().replace(/\s+/g, '_')}`;
  const cachedUrl = localStorage.getItem(activeKey) || localStorage.getItem(legacyActiveKey);
  if (cachedUrl && !forceNext && !rejectedList.includes(cachedUrl)) {
    return {
      imageUrl: cachedUrl,
      slotName: slot.nameAr,
      weatherCommentary: commentary,
      source: apiKey && city
        ? (isEn ? `Live Web Scenery - ${city}` : `صور حية عبر البحث - ${city}`)
        : (isEn ? 'Curated Nature Gallery' : 'معرض المشاهد الطبيعية'),
      isCached: true,
    };
  }

  const currentActive = localStorage.getItem(activeKey) || localStorage.getItem(legacyActiveKey);
  if (forceNext && currentActive && !rejectedList.includes(currentActive)) {
    rejectedList.push(currentActive);
    localStorage.setItem(rejectedKey, JSON.stringify(rejectedList));
  }

  // 1. Tavily Web Image Search if Key and City provided
  if (apiKey && apiKey.trim() !== '' && city) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: `scenery wallpaper photo ${city} ${country} ${slot.queryTime}`,
          search_depth: 'basic',
          include_images: true,
          max_results: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.images && Array.isArray(data.images)) {
          for (const imgUrl of data.images) {
            if (
              typeof imgUrl === 'string' &&
              (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) &&
              !rejectedList.includes(imgUrl)
            ) {
              const ok = await checkImageLoadable(imgUrl);
              if (ok) {
                localStorage.setItem(activeKey, imgUrl);
                return {
                  imageUrl: imgUrl,
                  slotName: slot.nameAr,
                  weatherCommentary: commentary,
                  source: isEn ? `Live Web Search - ${city}` : `صور حية عبر البحث - ${city}`,
                  isCached: false,
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Tavily bg image search error:', e);
    }
  }

  // Fallback candidate photos (Curated high-res nature scenery)
  const fallbacks = [
    'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80',
  ];

  const candidate = fallbacks.find((url) => !rejectedList.includes(url)) || fallbacks[0];
  localStorage.setItem(activeKey, candidate);
  return {
    imageUrl: candidate,
    slotName: slot.nameAr,
    weatherCommentary: commentary,
    source: isEn ? 'Curated Nature Gallery HD' : 'معرض المشاهد الطبيعية HD',
    isCached: false,
  };
}
