import muneerSystemPromptRaw from '../../muneer.md?raw';
import { formatAppContextForPrompt } from './appContext';

// Directly use muneer.md content as the fixed System Prompt
const FIXED_SYSTEM_PROMPT_MUNEER = muneerSystemPromptRaw;

// Cache for dynamically discovered models via ModelService.ListModels
let cachedAvailableModels = null;
let lastModelsFetchTime = 0;

/**
 * Dynamically queries Google Gemini ModelService.ListModels
 * to find all active models supporting 'generateContent' for this specific API key.
 */
export async function fetchAvailableGeminiModels(geminiApiKey) {
  if (!geminiApiKey || !geminiApiKey.trim()) return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const now = Date.now();
  // Cache the models list for 10 minutes to avoid redundant network calls
  if (cachedAvailableModels && cachedAvailableModels.length > 0 && now - lastModelsFetchTime < 10 * 60 * 1000) {
    return cachedAvailableModels;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
    if (res.ok) {
      const data = await res.json();
      const modelsList = data.models || [];

      // Filter models that explicitly support 'generateContent' and are text/chat capable
      const validModels = modelsList
        .filter((m) => {
          const methods = m.supportedGenerationMethods || [];
          const isGenerateContent = methods.includes('generateContent');
          const name = m.name || '';
          const isExcluded =
            name.includes('embedding') ||
            name.includes('aqa') ||
            name.includes('imagen') ||
            name.includes('tts') ||
            name.includes('realtime');
          return isGenerateContent && !isExcluded;
        })
        .map((m) => m.name.replace(/^models\//, ''));

      // Sort models to prioritize modern high-speed flash models first
      validModels.sort((a, b) => {
        const getScore = (modelName) => {
          let s = 0;
          if (modelName.includes('2.5')) s += 100;
          else if (modelName.includes('2.0')) s += 80;
          else if (modelName.includes('1.5')) s += 60;
          else s += 20;

          if (modelName.includes('flash')) s += 15;
          if (modelName.includes('lite')) s += 5;
          if (modelName.includes('pro')) s -= 5;
          if (modelName.includes('exp')) s -= 10;
          return s;
        };
        return getScore(b) - getScore(a);
      });

      if (validModels.length > 0) {
        cachedAvailableModels = validModels;
        lastModelsFetchTime = now;
        return validModels;
      }
    }
  } catch (err) {
    console.warn('تنبيه: تعذر استعلام ModelService.ListModels، جاري استخدام النماذج الافتراضية:', err);
  }

  // Fallback defaults if ListModels is temporarily unreachable
  return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
}

/**
 * Intelligently evaluates whether the user's message needs a live web search.
 * This is decided dynamically by the model without hardcoded keyword rules.
 */
export async function determineSearchIntent(geminiApiKey, userText, signal) {
  if (!geminiApiKey || !userText || !userText.trim()) {
    return { needsSearch: false, searchQuery: '' };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: 'You are an intelligent search classifier for an Islamic scholar assistant and prayer tracker application. Determine if the user message strictly requires a live external web search (such as breaking news, recent events, live external data lookup, or an explicit request from the user to search the internet). Return ONLY a JSON object: {"needsSearch": boolean, "searchQuery": "optimal search keywords"}. If it is general knowledge, religious rulings, greetings, general conversation, or internal app settings/prayers, return {"needsSearch": false, "searchQuery": ""}.',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 80,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          needsSearch: Boolean(parsed.needsSearch),
          searchQuery: parsed.searchQuery || userText,
        };
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('Search intent classification error:', err);
  }

  return { needsSearch: false, searchQuery: '' };
}

export async function sendGeminiChatMessage(
  geminiApiKey,
  historyMessages,
  userText,
  tavilyApiKey = '',
  attachedFiles = [],
  signal = null,
  segments = []
) {
  if (!geminiApiKey || !geminiApiKey.trim()) {
    return {
      success: false,
      error: 'مفتاح Gemini API غير مضاف في صفحة الإعدادات.',
    };
  }

  const startTime = performance.now();

  // 1. Perform Web Search via Tavily API ONLY when dynamically decided by the model
  let searchContext = '';
  let usedSearch = false;

  if (tavilyApiKey && tavilyApiKey.trim() !== '') {
    try {
      const { needsSearch, searchQuery } = await determineSearchIntent(geminiApiKey, userText, signal);
      if (needsSearch && searchQuery) {
        const searchRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal,
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: searchQuery,
            search_depth: 'basic',
            max_results: 3,
          }),
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          if (results.length > 0) {
            usedSearch = true;
            searchContext =
              '\n\n[معلومات محدثة وحقيقية من الويب جُلبت عبر Tavily API]:\n' +
              results
                .map(
                  (r, idx) =>
                    `نتيجة (${idx + 1}): ${r.title}\nالرابط: ${r.url}\nالمحتوى: ${r.content}`
                )
                .join('\n---\n');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('تنبيه: تعذر إتمام بحث Tavily في المحادثة:', err);
    }
  }

  // 2. Format multimodal contents and attached files
  const helperFormatParts = (text, files, segments) => {
    const parts = [];

    if (Array.isArray(segments) && segments.length > 0) {
      segments.forEach((seg) => {
        if (seg.type === 'text' && seg.value && seg.value.trim()) {
          parts.push({ text: seg.value.trim() });
        } else if (seg.type === 'file' && seg.file) {
          const f = seg.file;
          const isImage =
            (f.type && f.type.startsWith('image/')) ||
            (typeof f.content === 'string' && f.content.startsWith('data:image/'));

          if (isImage && typeof f.content === 'string' && f.content.includes(',')) {
            const [header, base64Data] = f.content.split(',');
            const mimeMatch = header.match(/data:([^;]+);base64/);
            const mimeType = mimeMatch ? mimeMatch[1] : f.type || 'image/png';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            });
          } else {
            parts.push({
              text: `[مستند مرفق: ${f.name} (${f.size})]:\n${f.content}`,
            });
          }
        }
      });
    } else {
      if (text && text.trim()) {
        parts.push({ text: text.trim() });
      }
      if (Array.isArray(files) && files.length > 0) {
        files.forEach((f) => {
          const isImage =
            (f.type && f.type.startsWith('image/')) ||
            (typeof f.content === 'string' && f.content.startsWith('data:image/'));

          if (isImage && typeof f.content === 'string' && f.content.includes(',')) {
            const [header, base64Data] = f.content.split(',');
            const mimeMatch = header.match(/data:([^;]+);base64/);
            const mimeType = mimeMatch ? mimeMatch[1] : f.type || 'image/png';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            });
          } else {
            parts.push({
              text: `[مستند مرفق: ${f.name} (${f.size})]:\n${f.content}`,
            });
          }
        });
      }
    }

    if (parts.length === 0) {
      parts.push({ text: 'تحليل المحتوى' });
    }
    return parts;
  };

  const contents = [];

  // Prevent duplicating the current user message if the caller already included it in historyMessages
  const priorHistory = Array.isArray(historyMessages) ? [...historyMessages] : [];
  const lastMsg = priorHistory[priorHistory.length - 1];
  if (lastMsg && lastMsg.sender === 'user' && (lastMsg.text === userText || (!userText && lastMsg.segments))) {
    priorHistory.pop();
  }

  // Add prior history
  priorHistory.forEach((msg) => {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: helperFormatParts(msg.text, msg.attachedFiles, msg.segments),
    });
  });

  // Current user prompt parts + search context
  const currentPromptParts = helperFormatParts(userText, attachedFiles, segments);
  if (searchContext) {
    currentPromptParts.push({ text: searchContext });
  }

  contents.push({
    role: 'user',
    parts: currentPromptParts,
  });

  // 3. Dynamically discover all supported models for this API key via ModelService.ListModels
  const activeModelsList = await fetchAvailableGeminiModels(geminiApiKey);

  let lastErrorMsg = '';

  // 4. Multi-Model Cascade: Try each model dynamically fetched from ListModels
  for (let i = 0; i < activeModelsList.length; i++) {
    const currentModel = activeModelsList[i];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: `${FIXED_SYSTEM_PROMPT_MUNEER}\n\n${formatAppContextForPrompt()}`,
                },
              ],
            },
            contents: contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1200,
            },
          }),
        }
      );

      const endTime = performance.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

      if (response.ok) {
        const data = await response.json();
        
        // Extract and combine all text parts from response content (handling multi-part and thought-part responses)
        const parts = data.candidates?.[0]?.content?.parts || [];
        const combinedText = parts
          .filter((p) => typeof p.text === 'string')
          .map((p) => p.text)
          .join('')
          .trim();

        if (combinedText) {
          return {
            success: true,
            text: combinedText,
            usedSearch: usedSearch,
            durationSeconds: durationSeconds,
            modelUsed: currentModel,
          };
        }

        // If candidates array is empty or parts had no text, check the exact API finish / block reason
        const finishReason = data.candidates?.[0]?.finishReason;
        const blockReason = data.promptFeedback?.blockReason;
        const reasonMsg = blockReason
          ? `تم حجب الطلب من قبل سياسات Google AI (${blockReason})`
          : finishReason
          ? `انتهى التوليد دون نص (${finishReason})`
          : 'استجابة فارغة من النموذج';

        if (i < activeModelsList.length - 1) {
          console.warn(`النموذج (${currentModel}) أعاد استجابة فارغة (${reasonMsg})، جاري تجربة النموذج التالي...`);
          continue;
        }

        return {
          success: false,
          error: `تعذر الحصول على نص من النموذج: ${reasonMsg}`,
          durationSeconds,
        };
      }

      // Read error details
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      lastErrorMsg = msg;

      const isQuotaOrUnavailable =
        response.status === 429 ||
        response.status === 404 ||
        response.status === 503 ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('resource_exhausted') ||
        msg.toLowerCase().includes('rate');

      if (isQuotaOrUnavailable && i < activeModelsList.length - 1) {
        const nextModel = activeModelsList[i + 1];
        console.warn(
          `النموذج (${currentModel}) غير متاح أو وصل لحد الكوتا (${response.status}). جاري التحويل التلقائي للنموذج التالي (${nextModel})...`
        );
        continue; // Try next model in dynamic cascade
      }

      if (i < activeModelsList.length - 1) {
        continue;
      }

      return {
        success: false,
        error: `خطأ في استدعاء Gemini API (${response.status}): ${msg}`,
        durationSeconds,
      };
    } catch (err) {
      if (err.name === 'AbortError') throw err;

      if (i < activeModelsList.length - 1) {
        const nextModel = activeModelsList[i + 1];
        console.warn(`تعذر الاتصال بالنموذج (${currentModel})، جاري تجربة (${nextModel}):`, err);
        continue;
      }

      const endTime = performance.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
      return {
        success: false,
        error: `فشل الاتصال بـ Gemini API: ${err.message}`,
        durationSeconds,
      };
    }
  }

  const endTime = performance.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
  return {
    success: false,
    error: `تم استنفاذ كوتا جميع النماذج المدعومة في هذا المفتاح (${activeModelsList.join(', ')}). التفاصيل: ${lastErrorMsg}`,
    durationSeconds,
  };
}

// AI Web Search & Scraped Content Parsing via Gemini AI Model with Fallback Cascade
export async function parsePrayerTimesWithGeminiAI(geminiApiKey, rawText, city, country, targetDateStr = '') {
  if (!geminiApiKey || !geminiApiKey.trim() || !rawText || !rawText.trim()) return null;

  const datePromptText = targetDateStr ? `specifically for target date ${targetDateStr}` : 'for today';

  const systemInstruction = `You are a precise AI prayer times JSON parser. Extract exact prayer times for ${city}, ${country} ${datePromptText} from the provided raw web content or table. Return ONLY a valid, raw JSON object (no markdown formatting, no backticks, no extra text) in 24-hour HH:MM format:
{
  "Fajr": "HH:MM",
  "Sunrise": "HH:MM",
  "Dhuhr": "HH:MM",
  "Asr": "HH:MM",
  "Maghrib": "HH:MM",
  "Isha": "HH:MM"
}`;

  const dynamicModels = await fetchAvailableGeminiModels(geminiApiKey);

  for (const model of dynamicModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: rawText.slice(0, 4500) }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 200,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawReply) {
          const cleanJsonStr = rawReply.replace(/```json/g, '').replace(/```/g, '').trim();
          const jsonTimes = JSON.parse(cleanJsonStr);
          return jsonTimes;
        }
      }
    } catch (err) {
      console.warn(`Gemini AI parsing with model ${model} failed, trying fallback:`, err);
    }
  }
  return null;
}

/**
 * Uses Gemini AI to dynamically determine a concise and accurate Arabic title for the conversation (2 to 5 words).
 */
export async function generateSessionTitle(geminiApiKey, userQuery, assistantResponse = '') {
  if (!geminiApiKey || !geminiApiKey.trim() || !userQuery || !userQuery.trim()) return null;

  try {
    const prompt = `أنت مساعد ذكي لتوليد عناوين للمحادثات.
المطلوب: توليد عنوان عربي بليغ وموجز جداً (من كلمتين إلى 4 كلمات كحد أقصى) يعبر بدقة واحترافية عن موضوع المحادثة.
ممنوع كتابة أي مقدمات أو علامات تنصيص أو شروحات. أخرج العنوان فقط.

رسالة المستخدم: "${userQuery.slice(0, 350)}"
${assistantResponse ? `مقتطف من الإجابة: "${assistantResponse.slice(0, 250)}"` : ''}

العنوان:`;

    const dynamicModels = await fetchAvailableGeminiModels(geminiApiKey);

    for (const model of dynamicModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 30,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawTitle) {
            let cleanTitle = rawTitle
              .replace(/^["'«“`*#]+|["'»”`*#]+$/g, '')
              .replace(/^(العنوان|عنوان المحادثة|الموضوع):\s*/i, '')
              .replace(/[\r\n]+/g, ' ')
              .trim();

            if (cleanTitle.length >= 2 && cleanTitle.length <= 40) {
              return cleanTitle;
            }
          }
        }
      } catch (e) {
        console.warn(`Model ${model} title generation failed, trying next:`, e);
      }
    }
  } catch (err) {
    console.warn('تنبيه: فشل توليد عنوان المحادثة بواسطة النموذج:', err);
  }
  return null;
}

/**
 * Uses Gemini to correct spelling and typographical errors without altering words, semantics, or adding prefixes.
 */
export async function correctSpellingText(geminiApiKey, text) {
  const key = (geminiApiKey || '').trim();
  if (!key || !text || !text.trim()) return text;

  try {
    const prompt = `أنت خبير تدقيق لغوي ونحوي وإملائي وبلاغي للغة العربية الفصحى.
المهمة الإلزامية:
1. تصحيح كامل الرسالة والنص كاملاً من أوله إلى آخره، وتدقيق كافة الفقرات والجمل دون أي اقتطاع أو اختصار، ومعالجة كافة الأخطاء الإملائية، النحوية، والطباعية وضبط الهمزات والترقيم.
2. صياغة كامل الرسالة لتكون متناسقة ومتناغمة لغوياً وفصيحة مع الحفاظ التام على المقصد والمعنى الأصلي.
3. إرجاع كامل النص المصحح بالكامل فقط، دون أي مقدمات أو شروحات أو علامات تنصيص زائدة.

النص الكامل:
"""${text}"""

النص المصحح بالكامل:`;

    const dynamicModels = await fetchAvailableGeminiModels(key);

    for (const model of dynamicModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: Math.max(2048, text.length * 5),
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawResult) {
            let clean = rawResult
              .replace(/^"""|"""$/g, '')
              .replace(/^["'«“`]+|["'»”`]+$/g, '')
              .replace(/^(النص المصحح بالكامل|النص المصحح|التصحيح):\s*/i, '')
              .trim();
            if (clean.length > 0) {
              return clean;
            }
          }
        }
      } catch (e) {
        console.warn(`Model ${model} spellcheck failed, trying next:`, e);
      }
    }
  } catch (err) {
    console.warn('تنبيه: فشل التدقيق الإملائي بواسطة النموذج:', err);
  }
  return text;
}
