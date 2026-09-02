/** Add a language: JSON in `locales/`, import it in `index.ts`, and a row here. */
export const SUPPORTED_LOCALES = [
  { id: "en", native: "English" },
  { id: "tr", native: "Türkçe" },
] as const;

export type LocaleId = (typeof SUPPORTED_LOCALES)[number]["id"];

export function isSupportedLocale(id: string): id is LocaleId {
  return SUPPORTED_LOCALES.some((locale) => locale.id === id);
}

export function matchSupportedLocale(tag: string): LocaleId | null {
  const low = tag.toLowerCase();
  const exact = SUPPORTED_LOCALES.find((locale) => locale.id === low);
  if (exact) return exact.id;
  const prefix = low.split("-")[0] ?? "";
  const byPrefix = SUPPORTED_LOCALES.find(
    (locale) => locale.id === prefix || low.startsWith(`${locale.id}-`),
  );
  return byPrefix?.id ?? null;
}
