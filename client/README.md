# Gunaso client

React + Vite frontend for the Gunaso civic feedback platform.

## UI: `@mero-nepal/ui`

The client is built on [`@mero-nepal/ui`](https://www.npmjs.com/package/@mero-nepal/ui),
the shared Mero Digital Nepal design system. All apps in the suite use the same
component library and tokens so they look and behave consistently.

- **Theme** — `src/main.jsx` wraps the app in `<ThemeProvider>` with
  `createTheme({ extends: 'mdn-light' })`, plus `<LocaleProvider>`. The provider
  exposes design tokens as `--mero-*` CSS variables on its wrapper element.
  > Use `createTheme(...)`, not the raw `mdnLight` export — only the
  > `createTheme` result carries the `cssVars` the provider injects.
- **Components** — pages compose library primitives (`Button`, `Input`,
  `Select`, `Textarea`, `Card`, `Badge`, `Heading`, `Text`, `Stack`,
  `Skeleton`, …) instead of hand-rolled markup.
- **`src/components/Alert.jsx`** — small local banner built from `--mero-*`
  tokens, since the library has no Alert primitive.
- **`src/index.css`** — limited to app-shell concerns the library doesn't own
  (resets, page layout, nav, table), themed via `--mero-*` tokens. It also
  defines the `mero-spin` / `mero-shimmer` keyframes the library references for
  its spinner and skeleton but does not ship.

### React 19 peer dependency

`@mero-nepal/ui` declares a React 18 peer while this app runs on React 19. The
components only use stable React APIs, so `.npmrc` sets `legacy-peer-deps=true`
to accept the version skew during install.

## Scripts

```bash
npm run dev       # start the Vite dev server (proxies /api -> localhost:3001)
npm run build     # production build
npm run preview   # serve the production build locally
npm run lint      # ESLint
```
