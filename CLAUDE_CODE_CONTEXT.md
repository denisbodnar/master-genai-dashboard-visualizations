# Контекст Проєкту `genai-viz` для Claude Code (та інших AI-агентів)

Цей файл створено для швидкого онбордингу нових LLM-агентів. Тут міститься **вичерпний технічний опис** поточного стану, архітектури та реалізованих рішень магістерського проєкту `genai-viz`.

## 1. Загальний опис та мета проєкту
**GenAI-Viz** — це система для автоматичної генерації інтерактивних D3.js (v7) візуалізацій на основі сирих CSV-файлів, розроблена в рамках магістерської роботи. Система поєднує детерміновані алгоритми аналізу даних (Schema Inference, Rule-based Chart Selection) із потужністю великих мовних моделей (LLM: OpenAI, Ollama) для динамічної генерації коду. 

Особливістю проєкту є архітектура **Self-Refine** у поєднанні з **дворівневою безпечною валідацією** (AST аналіз + ізольоване виконання пісочниці), що дозволяє ітеративно виправляти згенерований D3.js код без втручання користувача.

## 2. Технічний стек команди
- **Repository type:** Monorepo (npm workspaces: `server`, `client`, `experiments`)
- **Backend:** Node.js 20+, Express 4, ESM (`"type": "module"`)
- **Frontend:** Vue 3 (Composition API) + Vite + D3.js v7, Vanilla CSS (Glassmorphism), `lucide-vue-next` (іконки)
- **Validation (Backend):** `acorn` (AST parsing), `node:vm` (ізольований контекст)
- **Testing:** Native `node:test` (123 юніт-тести з повним покриттям усіх модулів)

## 3. Статус проєкту: 100% Завершено (Всі 8 етапів)
Система повністю розроблена від бекенд конвеєра до CLI-експериментів. Не пропонуйте створювати нові core-модулі без запиту, оскільки поточний пайплайн стабілізовано.

## 4. Фізична та Архітектурна структура

### `server/` (Core Orchestration)
Сервер реалізує 5-модульний пайплайн:
1. **`schemaInference`** (Алгоритм 3.1): Парсить CSV за допомогою `papaparse`. Класифікує стовпці (`Numeric`, `Temporal`, `Categorical`) використовуючи жорсткі *евристичні правила* (не LLM). Збирає статистики та робить випадкову вибірку N=3 рядків (Sample).
2. **`chartSelector`** (Алгоритм 3.2): 7 жорстких правил для вибору типу графіка (напр. 2 Numeric → `scatter`). Якщо правила не покривають випадок (fallback) — звертається до LLM у JSON mode (`?provider=openai|ollama`). Завжди повертає `chartType` і `encoding`.
3. **`promptBuilder`**: Генерує 5-блоковий системний промпт (Role + Schema + Chart + Constraints + Shots). Підтримує 3 режими: `zero-shot`, `few-shot` (інжектує реальні приклади D3.js з папки `examples/`), `cot` (Chain of Thought міркування). Додатково генерує `feedbackPrompt` для Self-Refine [24].
4. **`validator`**:
   - *Static Analysis*: Перевіряє AST (через `acorn`) на заборонені API (`eval`, `fetch`, `d3.csv`), перевіряє сигнатуру `function renderChart(data, containerSelector)`.
   - *Sandbox*: Використовує `node:vm` з підміненим контекстом `MockD3` (через JS-Proxy) для виконання коду. Timeout 2000ms. Мета: зловити execution errors.
5. **`orchestrator`**: Головний фасад. Викликає модулі послідовно. Якщо валідатор повертає помилку — формує execution feedback і запитує виправлення у LLM (до `MAX_REFINE_ITERATIONS=3`). Якщо ліміт вичерпано — повертає `fallback`.
6. **`logger` (`JSONLLogger`)**: Синхронно (appendFileSync) та атомарно пише логи пайплайну на диск у форматі JSONL для подальшого аналізу.

### `client/` (Vue 3 UI)
Преміальний клієнт (Dark Mode, Glassmorphism).
- Взаємодіє з бекендом виключно через `/api/generate`. Сервіс API використовує `axios`.
- Глобальний стейт живе в `App.vue`.
- Компонент **`ChartRenderer.vue`** отримує текстовий код, і викликає його через `new Function('d3', 'data', 'container', code)`, безпечно рендерячи графік поверх Vue DOM-дерева через `d3.select(...)`. Наявний tab (Show Code/Hide Code).
- Компонент **`GenerationLogs.vue`** відображає `validationLog` масив, отриманий з сервера (візуалізуючи ітерації Self-Refine: Success / ErrorTrace / Tokens / Latency).

### `experiments/` (Experiment Runner)
- **`runner.js`**: CLI для прогону 18 тестових датасетів (з матриці `configs/matrix.json`). Підтримує прапорці `--dataset`, `--provider`, `--mode`, `--dry-run` (імітує mock-агента з 40% fall rate для швидкого тестування пайплайну Self-Refine без API key).
- **`summarize.js`**: Аналізує JSONL файли з папки `results/` та обчислює: Success Rate, Fallback Rate, Chart Match Rate, Avg Iterations, Avg Total Latency.

## 5. Довідник з команд (`/package.json` root)
- `npm run dev:server` — старт Express (port 3001)
- `npm run dev:client` — старт Vite Vue (port 5173)
- `npm run test:server` — 123 юніт тесту `node:test`
- `npm run exp:run` — прогін експериментів (усієї матриці)
- `npm run exp:run:dry` — dry-run експериментів (local mock)
- `npm run exp:summarize` — генерує ASCII таблицю підсумкових метрик

## 6. Важлива політика
1. **Не модифікуй `MockD3` (`validator/mockD3.js`) без узгодження.** Це найчутливіший елемент системи. Він побудований на `Proxy(d3)` перехопленнях і дуже специфічно обробляє виклики чейнінгу.
2. **Зберігай детермінізм.** Будь-які модифікації у `chartSelector` або `schemaInference` мають уникати LLM-дзвінків, якщо це можна вирішити звичайним JS (чистими правилами).
3. **Безпека D3.** Усі генеровані графіки повинні залежати виключно від аргументу `data`, що передається у `function renderChart(data, selector)`. Зовнішнє завантаження через `d3.csv` суворо заблоковане на рівні AST-валідації.
4. **Контекстні зміни**. Коли додаєш фічі форматування, не використовуй TailwindCSS (проєкт спирається на Vanilla CSS with CSS Vars). 
