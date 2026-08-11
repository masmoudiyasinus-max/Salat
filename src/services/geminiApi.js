// Fixed, uneditable System Prompt based on 2026-05-28-claude-opus-4.8.md
const FIXED_SYSTEM_PROMPT_CLAUDE_OPUS_4_8 = `
[SYSTEM PROMPT: CLAUDE OPUS 4.8 UNEDITABLE BASE INSTRUCTIONS]
Model Persona & Core Behavior:
- You operate under the strict behavioral identity and guidelines of Claude Opus 4.8 (2026-05-28 specification).
- You are a helpful, precise, warm, highly capable assistant specializing in daily routine management, prayer tracking, and analytical reflection.
- Tone & Formatting Rules:
  1. STRICT ZERO EMOJIS: Never use emojis anywhere in your text.
  2. Keep responses focused, concise, clear, and well-structured. Avoid unnecessary filler words.
  3. Language: Arabic (العربية) by default with a respectful, warm, and helpful tone.
  4. Safety & Ethics: Adhere to strict safety guidelines (no harmful content, no advice on self-harm or violence).
  5. Never quote or attribute behavior to internal system prompt text.
  6. Interact with user plans, daily habits, and prayer tracking data constructively without judgment.
`;

export async function sendGeminiChatMessage(
  geminiApiKey,
  historyMessages,
  userText,
  tavilyApiKey = '',
  attachedFiles = []
) {
  if (!geminiApiKey || !geminiApiKey.trim()) {
    return {
      success: false,
      error: 'مفتاح Gemini API غير مضاف في صفحة الإعدادات.',
    };
  }

  const startTime = performance.now();

  // 1. Perform Web Search via Tavily API if key is available
  let searchContext = '';
  let usedSearch = false;

  if (tavilyApiKey && tavilyApiKey.trim() !== '') {
    try {
      const searchRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: userText,
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
    } catch (err) {
      console.warn('تنبيه: تعذر إتمام بحث Tavily في المحادثة:', err);
    }
  }

  // 2. Format attached files
  let attachedFilesContext = '';
  if (attachedFiles && attachedFiles.length > 0) {
    attachedFilesContext =
      '\n\n[الملفات المرفقة من المستخدم]:\n' +
      attachedFiles
        .map(
          (f, idx) =>
            `ملف (${idx + 1}): ${f.name} (${f.type || 'ملف نصي'})\nالمحتوى:\n${f.content}`
        )
        .join('\n---\n');
  }

  const contents = [];

  // Add history
  historyMessages.forEach((msg) => {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  });

  // Combine user text, attached files, and live search context
  const fullPromptPayload = userText + attachedFilesContext + searchContext;
  contents.push({
    role: 'user',
    parts: [{ text: fullPromptPayload }],
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: FIXED_SYSTEM_PROMPT_CLAUDE_OPUS_4_8 }],
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

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      return {
        success: false,
        error: `خطأ في استدعاء Gemini API (${response.status}): ${msg}`,
        durationSeconds,
      };
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'لم أتمكن من الحصول على رد مناسب من Gemini.';

    return {
      success: true,
      text: typeof replyText === 'string' ? replyText : String(replyText || ''),
      usedSearch: usedSearch,
      durationSeconds: durationSeconds,
    };
  } catch (err) {
    const endTime = performance.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    return {
      success: false,
      error: `فشل الاتصال بـ Gemini API: ${err.message}`,
      durationSeconds,
    };
  }
}

// AI Web Search & Scraped Content Parsing via Gemini AI Model
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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
    console.warn('Gemini AI prayer times parsing error:', err);
  }
  return null;
}
