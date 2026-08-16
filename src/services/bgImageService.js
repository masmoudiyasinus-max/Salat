// Service for 5-slot daily location & weather background image fetching & caching with Rejection & Replacement support

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

export function getWeatherCommentary(city, slotId, lang = 'ar') {
  const isEn = lang === 'en';
  const cName = city || (isEn ? 'your city' : 'مدينتك');
  if (isEn) {
    switch (slotId) {
      case 'slot_1_dawn':
        return `Serene dawn and refreshing breeze in ${cName}`;
      case 'slot_2_midday':
        return `Sunny and vibrant atmosphere in ${cName}`;
      case 'slot_3_afternoon':
        return `Peaceful afternoon as the sun descends in ${cName}`;
      case 'slot_4_evening':
        return `Pleasant evening ambiance in ${cName}`;
      case 'slot_5_night':
      default:
        return `Calm night and clear skies in ${cName}`;
    }
  }

  switch (slotId) {
    case 'slot_1_dawn':
      return `أجواء فجرية خاشعة ولطيفة في ${cName}`;
    case 'slot_2_midday':
      return `طقس مشمس وأجواء مفعمة بالحيوية في ${cName}`;
    case 'slot_3_afternoon':
      return `أجواء هادئة مع ميلان الشمس للغروب في ${cName}`;
    case 'slot_4_evening':
      return `أجواء مسائية عطرة ومستقرة في ${cName}`;
    case 'slot_5_night':
    default:
      return `أجواء ليلية ساكنة وصفاء في السماء في ${cName}`;
  }
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
  const city = settings?.city || 'Makkah';
  const country = settings?.country || '';
  const apiKey = settings?.tavilyApiKey || '';
  const slot = getCurrentTimeSlot(cityDate, lang);
  const commentary = getWeatherCommentary(city, slot.id, lang);

  // Retrieve rejected image URLs from localStorage
  const rejectedKey = `bg_rejected_imgs_${city.toLowerCase().replace(/\s+/g, '_')}`;
  let rejectedList = [];
  try {
    rejectedList = JSON.parse(localStorage.getItem(rejectedKey) || '[]');
  } catch (e) {
    rejectedList = [];
  }

  // If user clicks "Reject Image", append active image to rejected list
  const activeKey = `active_bg_${city.toLowerCase().replace(/\s+/g, '_')}`;
  const cachedUrl = localStorage.getItem(activeKey);
  if (cachedUrl && !forceNext && !rejectedList.includes(cachedUrl)) {
    return {
      imageUrl: cachedUrl,
      slotName: slot.nameAr,
      weatherCommentary: commentary,
      source: apiKey
        ? (isEn ? `Live Web Search - ${city}` : `بحث الويب الحقيقي - ${city}`)
        : (isEn ? `Nature Gallery - ${city}` : `معرض المشاهد الطبيعية - ${city}`),
      isCached: true,
    };
  }

  const currentActive = localStorage.getItem(activeKey);
  if (forceNext && currentActive && !rejectedList.includes(currentActive)) {
    rejectedList.push(currentActive);
    localStorage.setItem(rejectedKey, JSON.stringify(rejectedList));
  }

  // 1. Tavily Web Image Search if Key provided
  if (apiKey && apiKey.trim() !== '') {
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
                  source: isEn ? `Live Web Search - ${city}` : `بحث الويب الحقيقي - ${city}`,
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

  // Fallback candidate photos (filtering out rejected images)
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
    source: isEn ? 'Nature Gallery Unsplash HD' : 'معرض المشاهد الطبيعية عالية الدقة Unsplash HD',
    isCached: false,
  };
}
