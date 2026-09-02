import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveLanguage } from "../lib/systemAppearance";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

export { SUPPORTED_LOCALES, isSupportedLocale, type LocaleId } from "./catalog";

const resources = {
  en: { translation: en },
  tr: { translation: tr },
};

export async function setupI18n(language: string) {
  const lng = resolveLanguage(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
  if (i18n.isInitialized) {
    await i18n.changeLanguage(lng);
    return i18n;
  }
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
