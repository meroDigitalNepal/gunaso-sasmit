/*
 * Non-component half of the display settings: the theme/locale option maps, the
 * React context, and the consumer hook. Kept out of the .jsx (which only exports
 * the DisplayProvider component) so react-refresh stays happy — the same split
 * used for chartTokens.js.
 *
 * Themes stay within the `safa` family (Apple-inspired light + its dark
 * companion) per the project's cross-suite visual guidance — no mdn-light.
 */

import { createContext, useContext } from 'react';
import { createTheme } from '@mero-nepal/ui';
import { LOCALES } from '../i18n';

export const THEMES = {
  light: { label: 'Light', theme: createTheme({ extends: 'safa' }) },
  dark: { label: 'Dark', theme: createTheme({ extends: 'safa-dark' }) },
};

// English, Nepali, Newari (Nepal Bhasa), and Maithili. The locale objects (base
// ui.* tokens + our app strings) are built in ../i18n.
export { LOCALES };

export const THEME_STORAGE_KEY = 'gunaso.theme';
export const LOCALE_STORAGE_KEY = 'gunaso.locale';

// Read a persisted key, falling back if storage is unavailable or the stored
// value is no longer a valid option.
export function readStored(storageKey, fallback, options) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && options[stored]) return stored;
  } catch {
    // localStorage can throw (private mode, disabled) — fall through.
  }
  return fallback;
}

export function persist(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Best-effort; a failed write just means the choice isn't remembered.
  }
}

export const DisplayContext = createContext(null);

export function useDisplaySettings() {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error('useDisplaySettings must be used within a DisplayProvider');
  return ctx;
}
