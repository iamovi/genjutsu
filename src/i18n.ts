import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enJSON from './locales/en.json';
import bnJSON from './locales/bn.json';
import jaJSON from './locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enJSON,
      },
      bn: {
        translation: bnJSON,
      },
      ja: {
        translation: jaJSON,
      },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safe from XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
