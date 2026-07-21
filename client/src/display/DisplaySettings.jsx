/*
 * Lifts theme + locale into state so the footer's ThemeLocaleSwitcher can drive
 * them. @mero-nepal/ui's ThemeProvider/LocaleProvider are controlled (they take
 * a `theme`/`locale` prop), and the switcher is a controlled widget (it takes
 * the current key + a setter), so this provider owns the state, feeds both
 * providers, and exposes the keys/setters through context for the switcher.
 *
 * Choices persist to localStorage so a citizen's preference survives reloads.
 * The option maps, context, and hook live in ./displayContext (this file only
 * exports the component, keeping react-refresh happy).
 */

import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, LocaleProvider } from '@mero-nepal/ui';
import {
  THEMES,
  LOCALES,
  THEME_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  DisplayContext,
  readStored,
  persist,
} from './displayContext';

export function DisplayProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => readStored(THEME_STORAGE_KEY, 'light', THEMES));
  const [localeKey, setLocaleKey] = useState(() => readStored(LOCALE_STORAGE_KEY, 'en', LOCALES));

  useEffect(() => persist(THEME_STORAGE_KEY, themeKey), [themeKey]);
  useEffect(() => persist(LOCALE_STORAGE_KEY, localeKey), [localeKey]);

  const value = useMemo(
    () => ({ themes: THEMES, locales: LOCALES, themeKey, setThemeKey, localeKey, setLocaleKey }),
    [themeKey, localeKey],
  );

  return (
    <ThemeProvider theme={THEMES[themeKey].theme}>
      <LocaleProvider locale={LOCALES[localeKey].locale}>
        <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
