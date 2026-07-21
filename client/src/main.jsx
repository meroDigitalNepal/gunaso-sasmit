import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DisplayProvider } from './display/DisplaySettings'

// DisplayProvider owns the `safa` theme (Mero's crisp, Apple-inspired tokens)
// and the locale, and lets the footer switcher change them at runtime.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DisplayProvider>
      <App />
    </DisplayProvider>
  </StrictMode>,
)
