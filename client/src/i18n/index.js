/*
 * Builds the app's locale objects by layering our app strings (en.js, ne.js,
 * newari.js, mai.js) on top of @mero-nepal/ui's base locales — the base ones
 * carry the design-system's own `ui.*` tokens (Loading…, Close, Required, …),
 * so merging keeps those working while adding our page strings. Components read
 * everything through the single `useLocale().t(key)` the library provides.
 *
 * `LOCALES` is shaped for displayContext / the footer's ThemeLocaleSwitcher:
 * { key: { label, locale } }. `label` is each language's own endonym.
 */

import { createLocale, en as enBase, ne as neBase, newari as newariBase, mai as maiBase } from '@mero-nepal/ui';
import enTokens from './en';
import neTokens from './ne';
import newariTokens from './newari';
import maiTokens from './mai';

// Merge our tokens over the library's base tokens, preserving the base's
// code/script/dir so LocaleProvider keeps picking the right font + lang/dir.
function extend(base, tokens) {
  return createLocale({
    code: base.code,
    script: base.script,
    dir: base.dir,
    tokens: { ...base.tokens, ...tokens },
  });
}

export const LOCALES = {
  en: { label: 'English', locale: extend(enBase, enTokens) },
  ne: { label: 'नेपाली', locale: extend(neBase, neTokens) },
  newari: { label: 'नेपाल भाषा', locale: extend(newariBase, newariTokens) },
  mai: { label: 'मैथिली', locale: extend(maiBase, maiTokens) },
};
