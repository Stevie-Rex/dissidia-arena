import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './theme/css/fonts.css'
import './theme/css/dissidia-theme.css'
import './index.css'
import App from './App.tsx'

const start = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )

// Lab, round 3 (#70): dev-only, never merges. With a lab scenario on (?lab=, kept for the tab), /api is served from sample data.
if (import.meta.env.DEV && (new URLSearchParams(window.location.search).has('lab') || sessionStorage.getItem('da-lab')))
  void import('./lab/fakeApi').then((lab) => {
    const session = lab.readSession()
    if (session) lab.install(session)
    start()
  })
else start()
