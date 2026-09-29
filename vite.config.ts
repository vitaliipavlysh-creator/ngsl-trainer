import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { ngslData } from './scripts/vite-plugin-ngsl.ts';

// Тести дат детерміновані: воркери Vitest успадковують часовий пояс.
process.env.TZ ??= 'Europe/Kyiv';

export default defineConfig({
  // Відносний шлях: працює і на GitHub Pages (/ngsl-trainer/), і локально.
  base: './',
  plugins: [ngslData(), react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
