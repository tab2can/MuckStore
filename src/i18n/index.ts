import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

export function setupI18n(language: string) {
  if (i18n.isInitialized) {
    void i18n.changeLanguage(language);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, tr: { translation: tr } },
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
