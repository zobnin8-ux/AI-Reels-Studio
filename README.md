# AI Reels Studio

Desktop-first **dialogue-first content studio** for Instagram Reels/posts: **control selectors on the left**, **creative dialogue in the center** (source of truth), **outputs on the right** (manual generation steps).

**No server-side persistence** — session state lives in the browser only.

## Setup

```bash
cd AI-Reels-Studio
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Keep secrets in **`.env.local`** only (gitignored). Use **`.env.example`** as a template. Do not commit API keys to GitHub.

**Chat mock (optional local test without keys):** set `AI_MOCK_MODE=1` in `.env.local` — `/api/chat` returns a stub JSON.

**Production:**

```env
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

Optional:

- `OPENAI_CHAT_MODEL` — default `gpt-4o-mini`. Для стабильнее русского сценария/промптов часто лучше `gpt-4o` или `gpt-4.1`.
- `OPENAI_IMAGE_MODEL` — default **`gpt-image-2`** (лучше текст на картинке и следование промпту). Если аккаунт/API ещё без этой модели — поставьте `gpt-image-1` или `dall-e-3`.
- `OPENAI_IMAGE_QUALITY` — для семейства `gpt-image-*`: `low` | `medium` | **`high`** (по умолчанию `high`). Если API вернёт ошибку по параметру `quality`, задайте `skip` — запрос уйдёт без `quality`.
- `ANTHROPIC_MODEL` — default per SDK

**Текст на кадре:** фоны собираются без букв в кадре (шаблон OpenAI Image). Надписи для монтажа — через режим текста и типографику в ZIP.

Uncomment and set variables in `.env.local`; lines starting with `#` are ignored.

## Behavior

- **Left:** Проект (**После него / Zobnin AI / OlgaTrip**), формат (Reels 9:16 или Post 4:5), число кадров, тон, визуальный стиль, CTA, режим текста — всё уходит в каждый запрос чата вместе с профильным system prompt.
- **Center:** Диалог с **Anthropic или OpenAI** (переключатель только для чата). Ответ `{ reply, statePatch? }`; в сессию попадают слайды, caption, музыка, опциональные **короткие уточнения** на кадр (`prompts[]`).
- **Картинки:** только **OpenAI** `/api/image`. Финальная строка промпта собирается в приложении из **аккаунта + тона + стиля + текста слайда** (`src/lib/build-image-prompt.ts`), без отдельных «визуальных промптов» от Anthropic.
- **Right:** Сценарий, опциональные уточнения по строкам, **Generate images**, caption, музыка, **Download ZIP**.

## API routes

- `POST /api/chat` — body: `{ provider, messages, selectors, session }`. Response: `{ reply, statePatch? }` (JSON object from the model, validated with Zod).
- `POST /api/image` — single image, base64 response.

## ZIP export

- `scenario.txt` — заголовки и тексты слайдов  
- `image_prompts_openai.txt` — полный prompt на кадр, как ушёл в Image API (детерминированно из состояния)  
- `cosmetic_hints.txt` — опциональные пользовательские уточнения по кадрам  
- `caption.txt`  
- `music_notes.txt` — queries / recommendations / avoid  
- `fonts_recommendations.txt` — типографика под Canva по селекторам  
- `images/01.png`, … — кадры  
- Имя `.zip`: тема (Topic) + `_reels` / `_post`.  

## Project structure (main files)

| Path | Role |
|------|------|
| `src/lib/state.ts` | Session shape |
| `src/lib/profiles.ts` | Project system prompts + CTA hints |
| `src/lib/dialogue-context.ts` | Full system prompt + selector injection + JSON contract |
| `src/lib/chat-response.ts` | Zod schemas for API JSON |
| `src/lib/actions.ts` | `sendDialogueTurn`, `mergeStatePatch`, `generateImagesFromState`, `downloadZip` |
| `src/lib/build-image-prompt.ts` | Сборка строки для OpenAI Image (ТЗ: MASTER + maps + slide) |
| `src/lib/typography-export.ts` | Текст `fonts_recommendations.txt` для ZIP |
| `src/app/api/chat/route.ts` | Chat proxy + mock mode |
| `src/app/api/image/route.ts` | Image generation |
| `src/components/ControlPanel.tsx` | Selectors |
| `src/components/DialoguePanel.tsx` | Dialogue + shortcuts |
| `src/components/OutputPanel.tsx` | Outputs + image gen + ZIP |
