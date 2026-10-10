import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

export const defaultNS = 'translation';
export const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
} as const;

export const LANGUAGE_STORAGE_KEY = 'lightdrop_language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: false,
    interpolation: {
      escapeValue: false, // React already safeguards against XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export const changeAppLanguage = (lang: string) => {
  if (lang === 'auto') {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch (_) {}
    const navLang = navigator.language || '';
    const target = navLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
    return i18n.changeLanguage(target);
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (_) {}
  return i18n.changeLanguage(lang);
};

export const getCurrentLanguageSetting = (): 'zh-CN' | 'en-US' | 'auto' => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en-US') {
      return saved;
    }
  } catch (_) {}
  return 'auto';
};

export default i18n;
