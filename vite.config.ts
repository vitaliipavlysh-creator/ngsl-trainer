import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { ngslData } from './scripts/vite-plugin-ngsl.ts';

// Тести дат детерміновані: воркери Vitest успадковують часовий пояс.
process.env.TZ ??= 'Europe/Kyiv';

export default defineConfig({
  // Відносний шлях: працює і на GitHub Pages (/ngsl-trainer/), і локально.
  base: './',
  plugins: [
    ngslData(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NGSL Trainer — 2801 слово',
        short_name: 'NGSL',
        description: 'Тренажер 2801 найуживанішого англійського слова',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f5f1',
        theme_color: '#2f5bd3',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Шрифти для англійських слів — лише латиниця; решта підмножин не потрібна офлайн.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-wght-normal-*.woff2'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
