import { getSettings, saveSettings } from './storage.js';
import { APP_EVENTS } from './prayerConstants.js';

/**
 * Extracts embedded Muneer action JSON blocks from raw LLM text responses.
 */
export function extractMuneerAction(rawText) {
  if (!rawText || typeof rawText !== 'string') return { cleanText: rawText || '', action: null };

  const codeBlockRegex = /```(?:muneer_action|json)?\s*(\{[\s\S]*?"action"\s*:\s*"update_settings"[\s\S]*?\})\s*```/i;
  const xmlTagRegex = /<(?:muneer_action|json_template)>\s*(\{[\s\S]*?"action"\s*:\s*"update_settings"[\s\S]*?\})\s*<\/(?:muneer_action|json_template)>/i;
  const genericJsonRegex = /(\{[\s\S]*?"action"\s*:\s*"update_settings"[\s\S]*?\})/i;

  let action = null;
  let cleanText = rawText;

  const match = rawText.match(codeBlockRegex) || rawText.match(xmlTagRegex) || rawText.match(genericJsonRegex);
  if (match) {
    try {
      action = JSON.parse(match[1]);
      cleanText = rawText.replace(match[0], '').trim();
    } catch (e) {
      console.warn('Could not parse muneer action JSON:', e);
    }
  }

  return { cleanText, action };
}

/**
 * Executes a verified Muneer settings update action and broadcasts the change.
 */
export function executeSettingsActionDirectly(action, onSettingsSaved) {
  if (!action || action.action !== 'update_settings' || !action.changes) return;

  try {
    const currentSettings = getSettings();
    const normalizedChanges = {};

    Object.entries(action.changes).forEach(([key, val]) => {
      const k = String(key).toLowerCase();
      if (k.includes('city') || k.includes('مدينة')) {
        normalizedChanges.city = val;
      } else if (k.includes('country') || k.includes('دولة') || k.includes('بلد')) {
        normalizedChanges.country = val;
      } else if (k.includes('timeformat') || k.includes('format') || k.includes('تنسيق')) {
        normalizedChanges.timeFormat = String(val).includes('24') ? '24' : '12';
      } else if (k.includes('grace') || k.includes('مهلة')) {
        normalizedChanges.gracePeriodMinutes = Number(val) || 15;
      } else if (k.includes('lang') || k.includes('لغة') || k.includes('language')) {
        const v = String(val).toLowerCase();
        normalizedChanges.language = (v.includes('en') || v.includes('ingliz') || v.includes('انجليز') || v.includes('إنقليز') || v.includes('english')) ? 'en' : 'ar';
      } else if (k.includes('bg') || k.includes('background') || k.includes('خلفية')) {
        const v = String(val).toLowerCase();
        if (v.includes('makkah') || v.includes('mecca') || v.includes('مكة')) {
          normalizedChanges.bgMode = 'makkah';
        } else if (v.includes('madinah') || v.includes('medina') || v.includes('مدينة')) {
          normalizedChanges.bgMode = 'madinah';
        } else if (v.includes('image') || v.includes('صورة') || v.includes('custom')) {
          normalizedChanges.bgMode = 'custom_image';
        } else {
          normalizedChanges.bgMode = val;
        }
      } else {
        normalizedChanges[key] = val;
      }
    });

    const updated = { ...currentSettings, ...normalizedChanges };
    saveSettings(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.SETTINGS_UPDATED, { detail: updated }));
    }
    if (onSettingsSaved) onSettingsSaved(updated);
    return updated;
  } catch (err) {
    console.error('Error executing settings action directly:', err);
  }
}
