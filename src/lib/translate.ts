// Client-side translation utility + supported language registry.
//
// `translateText(text, targetLanguage)` is the simple single-string helper
// you can use anywhere in the app. Internally it batches multiple in-flight
// calls so the page-translator (which submits dozens of nodes at once) only
// makes one network round-trip.

export interface AppLanguage {
  code: string // ISO 639-1 (or BCP-47 fragment) understood by RapidAPI
  name: string // English display name
  native: string // Native script name shown in the dropdown
  flag: string // Emoji flag of a country where the language is widely used
  region: 'India' | 'Foreign'
}

// Indian languages (8 widely used) — kept first so the dropdown surfaces them
// before the foreign list. Flag uses 🇮🇳 for all (national language family).
const INDIAN_LANGUAGES: AppLanguage[] = [
  { code: 'en', name: 'English (India)', native: 'English', flag: '🇮🇳', region: 'India' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', region: 'India' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳', region: 'India' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳', region: 'India' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳', region: 'India' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳', region: 'India' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳', region: 'India' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳', region: 'India' },
]

// 44 foreign languages — picked for breadth across major study-abroad
// destinations and large diaspora communities.
const FOREIGN_LANGUAGES: AppLanguage[] = [
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸', region: 'Foreign' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷', region: 'Foreign' },
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪', region: 'Foreign' },
  { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹', region: 'Foreign' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹', region: 'Foreign' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱', region: 'Foreign' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', flag: '🇸🇪', region: 'Foreign' },
  { code: 'no', name: 'Norwegian', native: 'Norsk', flag: '🇳🇴', region: 'Foreign' },
  { code: 'da', name: 'Danish', native: 'Dansk', flag: '🇩🇰', region: 'Foreign' },
  { code: 'fi', name: 'Finnish', native: 'Suomi', flag: '🇫🇮', region: 'Foreign' },
  { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱', region: 'Foreign' },
  { code: 'cs', name: 'Czech', native: 'Čeština', flag: '🇨🇿', region: 'Foreign' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina', flag: '🇸🇰', region: 'Foreign' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar', flag: '🇭🇺', region: 'Foreign' },
  { code: 'ro', name: 'Romanian', native: 'Română', flag: '🇷🇴', region: 'Foreign' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', flag: '🇬🇷', region: 'Foreign' },
  { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺', region: 'Foreign' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦', region: 'Foreign' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', region: 'Foreign' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦', region: 'Foreign' },
  { code: 'fa', name: 'Persian', native: 'فارسی', flag: '🇮🇷', region: 'Foreign' },
  { code: 'he', name: 'Hebrew', native: 'עברית', flag: '🇮🇱', region: 'Foreign' },
  { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰', region: 'Foreign' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', flag: '🇨🇳', region: 'Foreign' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', flag: '🇹🇼', region: 'Foreign' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', region: 'Foreign' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', region: 'Foreign' },
  { code: 'th', name: 'Thai', native: 'ไทย', flag: '🇹🇭', region: 'Foreign' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳', region: 'Foreign' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Foreign' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾', region: 'Foreign' },
  { code: 'fil', name: 'Filipino', native: 'Filipino', flag: '🇵🇭', region: 'Foreign' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪', region: 'Foreign' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans', flag: '🇿🇦', region: 'Foreign' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', flag: '🇪🇹', region: 'Foreign' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', flag: '🇳🇵', region: 'Foreign' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල', flag: '🇱🇰', region: 'Foreign' },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ', flag: '🇲🇲', region: 'Foreign' },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ', flag: '🇰🇭', region: 'Foreign' },
  { code: 'lo', name: 'Lao', native: 'ລາວ', flag: '🇱🇦', region: 'Foreign' },
  { code: 'mn', name: 'Mongolian', native: 'Монгол', flag: '🇲🇳', region: 'Foreign' },
  { code: 'ka', name: 'Georgian', native: 'ქართული', flag: '🇬🇪', region: 'Foreign' },
  { code: 'hy', name: 'Armenian', native: 'Հայերեն', flag: '🇦🇲', region: 'Foreign' },
  { code: 'az', name: 'Azerbaijani', native: 'Azərbaycanca', flag: '🇦🇿', region: 'Foreign' },
]

export const SUPPORTED_LANGUAGES: AppLanguage[] = [
  ...INDIAN_LANGUAGES,
  ...FOREIGN_LANGUAGES,
]

export const DEFAULT_LANGUAGE: AppLanguage = INDIAN_LANGUAGES[0]
export const LANGUAGE_STORAGE_KEY = 'gradpilot-language'

export function lookupLanguage(code: string | null | undefined): AppLanguage {
  if (!code) return DEFAULT_LANGUAGE
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) || DEFAULT_LANGUAGE
}

// =====================================================================
// Translation API (single-string helper + batched variant)
// =====================================================================

interface TranslateResp {
  translations: string[]
  cached?: boolean[]
  error?: string
}

async function callTranslate(
  texts: string[],
  targetLanguage: string,
  sourceLanguage = 'en',
): Promise<string[]> {
  if (!texts.length || targetLanguage === sourceLanguage) return texts
  try {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLanguage, sourceLanguage }),
    })
    if (!r.ok) return texts
    const data = (await r.json()) as TranslateResp
    if (Array.isArray(data.translations) && data.translations.length === texts.length) {
      return data.translations
    }
    return texts
  } catch {
    return texts
  }
}

/**
 * Translate a single string into `targetLanguage`. Falls back to the source
 * text on any error so the UI never goes blank.
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage = 'en',
): Promise<string> {
  if (!text || targetLanguage === sourceLanguage) return text
  const [out] = await callTranslate([text], targetLanguage, sourceLanguage)
  return out ?? text
}

/**
 * Batched version — preferred when you have many strings to translate at
 * once (e.g. the page-translator walking text nodes).
 */
export async function translateTexts(
  texts: string[],
  targetLanguage: string,
  sourceLanguage = 'en',
): Promise<string[]> {
  return callTranslate(texts, targetLanguage, sourceLanguage)
}
