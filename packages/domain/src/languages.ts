/**
 * Languages offered first when typing a book by hand, as ISO 639-1 codes. Their names
 * come from `Intl.DisplayNames` in the user's language, never from a hand-written list.
 */
export const commonLanguages = ['it', 'en', 'fr', 'de', 'es', 'pt', 'ru', 'ja', 'zh', 'el', 'la', 'ar'] as const;

/** The language proposed for a book typed by hand, when no source says otherwise. */
export const defaultBookLanguage = 'it';
