import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QuickCaptureOverlay } from './components/common/QuickCaptureOverlay'
import { getCurrentWindow } from '@tauri-apps/api/window'

// The Quick Capture overlay loads the same bundle as the main window.
// Detect it by window label (robust) with the #/quick-capture hash as a fallback,
// then render the compact capture UI instead of the full app.
let isCaptureWindow = false;
try {
  isCaptureWindow = getCurrentWindow().label === 'quick-capture';
} catch {
  isCaptureWindow = typeof window !== 'undefined' && window.location.hash.includes('quick-capture');
}
if (!isCaptureWindow && typeof window !== 'undefined' && window.location.hash.includes('quick-capture')) {
  isCaptureWindow = true;
}

if (isCaptureWindow) {
  // The overlay window is frameless + transparent: drop the solid body background
  // so only the inner glass card is visible.
  document.body.classList.add('capture-window');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCaptureWindow ? <QuickCaptureOverlay /> : <App />}
  </StrictMode>,
)
