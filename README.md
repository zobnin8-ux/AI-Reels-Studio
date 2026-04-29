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

**Mock (no API keys):**

```env
AI_MOCK_MODE=1
NEXT_PUBLIC_AI_MOCK_MODE=1
```

**Real APIs:**

```env
AI_MOCK_MODE=0
NEXT_PUBLIC_AI_MOCK_MODE=0
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

Optional:

- `OPENAI_CHAT_MODEL` — default `gpt-4o-mini`. Для стабильнее русского сценария/промптов часто лучше `gpt-4o` или `gpt-4.1`.
- `OPENAI_IMAGE_MODEL` — default **`gpt-image-2`** (лучше текст на картинке и следование промпту). Если аккаунт/API ещё без этой модели — поставьте `gpt-image-1` или `dall-e-3`.
- `OPENAI_IMAGE_QUALITY` — для семейства `gpt-image-*`: `low` | `medium` | **`high`** (по умолчанию `high`). Если API вернёт ошибку по параметру `quality`, задайте `skip` — запрос уйдёт без `quality`.
- `ANTHROPIC_MODEL` — default per SDK

**Кириллица на слайдах:** у всех генераторов изображений слабое место — буквы в кадре. Мы усиливаем промпт для русского текста и перешли на более новую модель изображений по умолчанию. Если буквы всё равно «плывут», попробуйте короче фразы на кадр или режим «текст отдельно от картинки», а финальный текст набрать в монтаже.

Uncomment and set variables in `.env.local`; lines starting with `#` are ignored.

## Behavior

- **Left:** Project (После него / Zobnin AI / Custom system prompt), format (Reels 9:16 / Post 1:1), slide count, mood, visual style, CTA mode, output mode — **every block is serialized and sent on each dialogue request** together with the profile system prompt.
- **Center:** Stateful chat. The model returns JSON `{ reply, statePatch? }`; the UI shows only `reply`, merges `statePatch` into session state (topic, angles, slides, prompts, caption, music, approval).
- **Shortcut buttons** insert canned **user** messages (they do not bypass the dialogue engine).
- **Right:** Scenario preview (when slides exist), editable per-frame prompts, **Generate images** (calls `/api/image` only here), caption and structured music fields, **Download ZIP**.

## API routes

- `POST /api/chat` — body: `{ provider, messages, selectors, session }`. Response: `{ reply, statePatch? }` (JSON object from the model, validated with Zod).
- `POST /api/image` — single image, base64 response.

## ZIP export

- `scenario.txt` — slide titles and bodies  
- `prompts.txt` — one block per slide  
- `caption.txt`  
- `images/01.png`, … — generated frames  

## Project structure (main files)

| Path | Role |
|------|------|
| `src/lib/state.ts` | Session shape |
| `src/lib/profiles.ts` | Project system prompts + CTA hints |
| `src/lib/dialogue-context.ts` | Full system prompt + selector injection + JSON contract |
| `src/lib/chat-response.ts` | Zod schemas for API JSON |
| `src/lib/actions.ts` | `sendDialogueTurn`, `mergeStatePatch`, `generateImagesFromState`, `downloadZip` |
| `src/app/api/chat/route.ts` | Chat proxy + mock mode |
| `src/app/api/image/route.ts` | Image generation |
| `src/components/ControlPanel.tsx` | Selectors |
| `src/components/DialoguePanel.tsx` | Dialogue + shortcuts |
| `src/components/OutputPanel.tsx` | Outputs + image gen + ZIP |
