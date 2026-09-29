import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { initPersistence } from './store/persist';
import { appStore } from './store/store';
import { sync } from './sync';
import './index.css';

const loadError = initPersistence(appStore);
// Якщо локальні дані не прочитались, не синхронізуємо — щоб не змішати з порожнім станом.
if (!loadError) sync.start();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App loadError={loadError} />
  </StrictMode>,
);

registerSW({ immediate: true });
