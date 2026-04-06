import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enJSON from './locales/en.json';
import bnJSON from './locales/bn.json';
import jaJSON from './locales/ja.json';
import filJSON from './locales/fil.json';
import hiJSON from './locales/hi.json';
import esJSON from './locales/es.json';
import ptJSON from './locales/pt.json';
import koJSON from './locales/ko.json';
import ruJSON from './locales/ru.json';

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
      fil: {
        translation: filJSON,
      },
      hi: {
        translation: hiJSON,
      },
      es: {
        translation: esJSON,
      },
      pt: {
        translation: ptJSON,
      },
      ko: {
        translation: koJSON,
      },
      ru: {
        translation: ruJSON,
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
