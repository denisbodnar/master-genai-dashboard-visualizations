# genai-viz — Етап 1

Прототип GenAI-системи автоматичної генерації D3.js-візуалізацій.
Цей архів містить реалізацію Етапу 1: детерміновану частину pipeline
(Schema Inference + Chart Selector) без LLM.

## Структура

```
genai-viz/
├── package.json              npm workspaces, ESM
├── .env.example              шаблон конфігурації
├── server/                   Node.js + Express
│   ├── src/
│   │   ├── index.js          точка входу, ендпоінти
│   │   ├── config.js         dotenv
│   │   └── modules/
│   │       ├── schemaInference/   алгоритм 3.1
│   │       └── chartSelector/     алгоритм 3.2 + Таблиця 3.1
│   └── test/                 node:test unit-тести
├── datasets/                 тестові CSV
├── client/                   (порожньо — наступний етап)
├── experiments/              (порожньо — наступний етап)
└── results/                  (порожньо)
```

## Запуск

```bash
# 1. Встановити залежності (потрібен Node.js 20+)
npm install

# 2. Скопіювати .env.example → .env і заповнити ключі
cp .env.example .env

# 3. Запустити тести
npm run test:server

# 4. Запустити сервер (порт 3001)
npm run dev:server
```

## Ендпоінти

- `GET  /api/health` — перевірка стану
- `POST /api/analyze` — CSV → Schema JSON
- `POST /api/select-chart` — CSV → Schema + рекомендація типу графіка

Приклад:
```bash
curl -X POST -F "file=@datasets/sales_monthly.csv" \
     http://localhost:3001/api/select-chart
```

## Покриття тестами

- 8 тестів Schema Inference (типізація, статистики, edge cases)
- 13 тестів Chart Selector (усі 7 правил + LLM-fallback + маппінг осей)
- Разом: 21 тест, всі проходять

## Наступні етапи

1. LLM-провайдери (OpenAI + Ollama)
2. Prompt Builder (5 блоків, 3 режими)
3. Validator + Sandbox (vm + MockD3)
4. Orchestrator (Self-Refine цикл)
5. Vue 3 UI + D3.js рендеринг
6. Експериментальний runner для Розділу 5
