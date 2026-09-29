import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { initPersistence } from './store/persist';
import { appStore } from './store/store';
import './index.css';

const loadError = initPersistence(appStore);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App loadError={loadError} />
  </StrictMode>,
);

registerSW({ immediate: true });
