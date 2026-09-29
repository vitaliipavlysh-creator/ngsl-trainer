# NGSL Trainer

Тренажер 2801 найуживанішого англійського слова (NGSL) для українськомовних: сортування «знаю / не знаю», вивчення пачками по 5 та інтервальні повторення 1 / 3 / 7 / 21 день. Працює в браузері на телефоні й ПК, встановлюється як PWA.

- [ТЗ](docs/SPEC.md)
- [План реалізації](docs/PLAN.md)
- Дані: [`data/ngsl-uk.tsv`](data/ngsl-uk.tsv) — `rank`, `word`, `translation`, `example`, `form`

## Розробка

Потрібен Node 22.

```sh
npm install
npm run dev        # локальний сервер
npm test           # юніт-тести логіки
npm run e2e        # e2e у Chromium (360 px і 1280 px)
npm run build      # збірка в dist/; падає, якщо TSV некоректний
```

Логіка без UI — у `src/core` (кожен модуль має тест поруч). Дані з TSV потрапляють у застосунок через модуль `virtual:ngsl-words` (див. `scripts/vite-plugin-ngsl.ts`).

## Деплой

Кожен пуш у `main` проходить перевірки й публікується на GitHub Pages (`.github/workflows/ci.yml`).
Одноразово: **Settings → Pages → Source: GitHub Actions**.
