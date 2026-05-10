# Arrange — Project Context

> Этот файл — контекст проекта для Claude Code. Лежит в корне репозитория и подгружается автоматически в каждой сессии.

---

## Что это

Персональное веб-приложение (PWA) для **басиста** — организовать аранжировки песен, собирать сетлисты на концерты, использовать как «партитуру» во время игры.

Single-user, не SaaS, не публичный продукт. Может расшириться позже.

**Ключевые сценарии:**
- Дома на MacBook — массовое наполнение базы песен
- На репетициях/концертах на iPad (PWA, установка через "Добавить на главный экран")
- iPhone — быстро глянуть/проверить
- Должно работать **offline** — на сцене часто нет интернета

---

## Владелец

**Кирилл Гончар** — креативный директор видеопродакшена в Харькове, Украина. Также военный журналист, музыкант (бас, многолетний опыт в группах). Не разработчик.

**Стиль работы:**
- Язык общения: **русский**
- Сжато, по теме, без лишних любезностей
- Если есть неоднозначность — задавать вопросы сразу
- Перед крупными изменениями (миграции БД, удаление файлов, рефакторинг) — спрашивать подтверждение
- Объяснять что делаешь и почему — он системный мыслитель, любит понимать происходящее
- Работает как с этим чатом, так и с Claude Code в зависимости от задачи

---

## Текущий статус

**Фаза 5 завершена.** Что готово:
- [x] Vite + React + TypeScript scaffold
- [x] GitHub repo: `goncharkirill/arrange`
- [x] Vercel auto-deploy from `main` (live at `arrange-amber.vercel.app`)
- [x] Supabase project (region: Frankfurt)
- [x] Database schema applied (5 tables, indexes, triggers, permissive RLS)
- [x] 3 seed bands inserted

**Сразу следующее (Фаза 6):**
- [ ] Установить Tailwind CSS v4
- [ ] Установить shadcn/ui
- [ ] Создать `.env.local` с Supabase ключами
- [ ] Установить `@supabase/supabase-js`, создать клиент в `src/lib/supabase.ts`
- [ ] Собрать первый экран — **список песен** (`src/screens/SongsList.tsx`)
- [ ] Подтвердить, что страница реально читает данные из Supabase
- [ ] Закоммитить, запушить, проверить на vercel.app

**Дальше (по убыванию приоритета):**
- [ ] Редактор песни (с блоками, аккорд-селектором, транспонированием)
- [ ] Концертный режим (fullscreen, large mono, autoscroll)
- [ ] Сетлисты (CRUD + концертный режим сетлиста)
- [ ] PDF-экспорт песни и сетлиста
- [ ] PWA-манифест + offline через service worker
- [ ] Полнотекстовый поиск, фильтры
- [ ] Auth (когда расширим за пределы single-user)

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` плагин, не PostCSS-вариант)
- **UI components:** shadcn/ui (копировать в `src/components/ui/`)
- **State:** React state + URL params; для серверного состояния — TanStack Query когда понадобится
- **Backend:** Supabase (Postgres + auth когда понадобится + storage)
- **Hosting:** Vercel (auto-deploy from `main` branch)
- **PWA:** `vite-plugin-pwa` + Workbox (Phase 7)
- **PDF:** `react-pdf` или `pdf-lib` (Phase 6/7)

---

## Структура файлов (целевая)

```
arrange/
├─ CLAUDE.md                     ← этот файл
├─ README.md
├─ public/
│  └─ icons/                     ← PWA-иконки
├─ src/
│  ├─ main.tsx                   ← точка входа
│  ├─ App.tsx                    ← роутер + layout
│  ├─ lib/
│  │  ├─ supabase.ts             ← клиент Supabase
│  │  ├─ chord.ts                ← parse/format/transpose аккордов
│  │  └─ utils.ts                ← мелкие хелперы (cn, formatDuration)
│  ├─ types/
│  │  └─ db.ts                   ← TS-типы из Supabase schema
│  ├─ components/
│  │  ├─ ui/                     ← shadcn/ui компоненты
│  │  ├─ ChordChip.tsx
│  │  ├─ KeyChip.tsx
│  │  ├─ StatusChip.tsx
│  │  ├─ TypeBadge.tsx
│  │  ├─ ProgressionLine.tsx
│  │  └─ BandDot.tsx
│  ├─ screens/
│  │  ├─ SongsList.tsx
│  │  ├─ SongEditor.tsx
│  │  ├─ Concert.tsx
│  │  ├─ SetlistsList.tsx
│  │  └─ SetlistEditor.tsx
│  └─ hooks/
│     ├─ useSongs.ts
│     ├─ useSong.ts
│     └─ useSetlists.ts
├─ .env.local                    ← НЕ КОММИТИТЬ (в .gitignore по умолчанию)
├─ .env.example                  ← шаблон без реальных значений
└─ ...
```

---

## Environment variables

В `.env.local` (локально, не в git):
```
VITE_SUPABASE_URL=https://ukbputheeipkmjyobmky.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-qyxCjZgB__gwYIyJ7W4kA_9CI_-Inc
```

Те же переменные настроены в Vercel → Settings → Environment Variables (для всех трёх окружений: Production / Preview / Development).

Префикс `VITE_` обязателен — Vite пропускает в клиент только переменные с этим префиксом.

`.env.example` (этот файл коммитим, чтобы документировать какие переменные нужны):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Database schema

Уже применена в Supabase. Полный SQL см. в первой миграции. Краткое описание:

### `bands`
- `id` uuid PK
- `name` text, `color` text (OKLCH-строка)

### `songs`
- `id` uuid PK
- `name` text, `original_artist` text, `band_id` → bands
- `key_root` text (C, C#, ...), `key_quality` text (`maj`, `m`, `7` и т.д.)
- `bpm` int, `time_signature` text (`4/4`), `duration_seconds` int, `tuning` text
- `status` text (`idea` / `learning` / `polishing` / `setlist` / `archive`)
- `youtube_url` text, `notes` text
- `created_at`, `updated_at` (триггер обновляет `updated_at` на UPDATE)

### `blocks` — секции песни (intro/verse/chorus/...)
- `id` uuid PK, `song_id` → songs (cascade delete)
- `position` int (порядок в песне)
- `type` text, `custom_label` text
- `bars` int, `repeat_count` int
- `progression` jsonb — массив объектов `{ root, quality, bass }`
- `lyrics` text, `bass_notes` text, `note` text

### `setlists`
- `id` uuid PK
- `name` text, `date` date, `venue` text, `band_id` → bands, `notes` text

### `setlist_songs` — связь many-to-many с порядком и переопределениями
- `id` uuid PK
- `setlist_id` → setlists, `song_id` → songs
- `position` int
- `custom_key_root` text, `custom_key_quality` text — если играем не в оригинальной тональности
- `transition_notes` text — заметки про переход к следующей

### RLS
Включён на всех таблицах. Сейчас политика **`MVP allow all`** (разрешает всё). Когда добавим auth — заменим на `using (auth.uid() = user_id)` после добавления `user_id` колонки.

---

## Дизайн-направление

**Что нравится:**
- Минимализм, много воздуха, плотная но не перегруженная информация
- Моноширинный шрифт для chord progressions (читается отлично)
- Чёткая визуальная иерархия
- Современный, чистый, инструментальный — как Linear, Things 3, Notion, Arc

**Цветовая логика (OKLCH):**
- Тональности: minor → красный, major → синий
- Статусы: gray (idea) → amber (learning) → blue (polishing) → green (setlist) → brown (archive)
- Типы блоков: каждому свой пастель-tone (verse, chorus, bridge, solo)

**Темы:** обязательны light + dark. Dark критичен для концертного режима (плохой свет на сцене).

**Mobile-first**, но не упрощённый — пользователь продвинутый.

**Чего избегать:**
- «Музыкальная» эстетика: гитарные шрифты, древесина, ноты в орнаментах
- Скевоморфизм
- Лишние иконки, градиенты, тени
- Игрушечный стиль — это профессиональный инструмент

---

## Шорткоды для записи аранжировок

```
(N)         — N тактов
×N          — повтор N раз
||:  :||    — повторяющийся блок
→           — переход в следующую секцию
N.C.        — no chord (тишина / только вокал)
tacet       — баса нет в этой секции
hits        — ритмические акценты со всей группой (стопы)
break       — все стопаются, кроме одного
tag         — повтор последней фразы
rit.        — ritardando (замедление)
a tempo     — возврат к темпу
fermata     — длительная остановка на ноте
```

---

## Reference: legacy прототип

В Claude Design сделан HTML-прототип. Лежит в `/uploads/Arrange.zip` если нужен. Что в нём ценного:
- Логика транспонирования (`transposeChord`, `transposeNote` в screen-editor.jsx)
- Concert mode со скроллом и keyboard nav (screen-concert.jsx)
- Chord selector bottom sheet — root grid + quality grid + slash bass
- Дизайн-токены (OKLCH) в styles.css

**Не копируй напрямую** — это React-через-CDN, JSX без TypeScript, in-memory без БД. Используй как референс для визуальной логики и архитектурных решений, но переписывай чисто в новой типизированной кодовой базе.

---

## Conventions

- TypeScript strict mode
- Все UI-примитивы — из shadcn/ui где возможно
- Цвета — через CSS-переменные / Tailwind theme tokens, не хардкод
- Mobile-first responsive
- Async data — через TanStack Query когда задача потребует (для MVP можно `useEffect` + `useState`)
- Названия компонентов — PascalCase, файлы тоже PascalCase
- Утилиты и хуки — camelCase
- В коммитах — короткие осмысленные сообщения, можно по-русски
- Не пушить `.env.local`, секреты, ключи

---

## Развилки и решения

- **Auth отложили до Phase 7** — single-user MVP, RLS пока permissive
- **Транспонирование — клиентская функция**, не сохраняется в БД (computed view)
- **chord progression в `jsonb`**, не отдельной таблицей — для гибкости и простоты запросов
- **PWA добавляем после MVP** (Phase 7) — сначала рабочий веб
- **Drag-and-drop порядка блоков и песен в сетлисте** — через `@dnd-kit`, когда дойдём

---

## Karpathy Skills — Принципы написания кода

> Behavioral guidelines to reduce common LLM coding mistakes.
> **Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
