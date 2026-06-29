import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, LocaleProvider, createTheme } from '@mero-nepal/ui'
import './index.css'
import App from './App.jsx'

// The whole Mero Digital Nepal suite shares the `mdn-light` design tokens.
const theme = createTheme({ extends: 'mdn-light' })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
