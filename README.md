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
- `ANTHROPIC_MODEL` — default `claude-sonnet-4-6`

**Текст на кадре:** модель обязана писать image prompts с жёстким запретом на читаемый текст/логотипы; приложение дополнительно досыпает “No text …” если модель пропустила. Надписи для монтажа — вручную, по `fonts_recommendations.txt`.

Uncomment and set variables in `.env.local`; lines starting with `#` are ignored.

## Behavior

- **Left (ControlPanel):** только технические параметры: проект (**После него / Zobnin AI / OlgaTrip**), формат (Reels 9:16 или Post 4:5), целевое число слайдов (5/7/9), CTA (website / trigger word / none) + импорт/экспорт JSON.
- **Center (DialoguePanel):** диалог с **Anthropic или OpenAI** (по умолчанию Anthropic). Ответ модели: `{ reply, statePatch? }`. В statePatch модель должна возвращать **`slides[]` + `imagePrompts[]`** (готовые английские промпты под `gpt-image`), а также опционально caption/music по явному запросу.
- **Images:** только **OpenAI** `POST /api/image`. Промпт уходит «как есть» из `imagePrompts` (с учётом ручной правки), код делает только лёгкий санитарный чек (`no text` + aspect) в `src/lib/image-prompt-pipeline.ts`.
- **Right (OutputPanel):** по каждому слайду виден текст и промпт картинки (редактируется), есть генерация одного/всех кадров, ZIP экспорт.

## API routes

- `POST /api/chat` — body: `{ provider, messages, selectors, session }`. Response: `{ reply, statePatch? }` (JSON object from the model, validated with Zod).
- `POST /api/image` — single image, base64 response.

## ZIP export

- `scenario.txt` — заголовки и тексты слайдов  
- `image_prompts_openai.txt` — полный prompt на кадр, как ушёл в Image API (детерминированно из состояния)  
- `caption.txt`  
- `music_notes.txt` — queries / recommendations / avoid  
- `fonts_recommendations.txt` — типографика под Canva по проекту  
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
| `src/lib/image-prompt-pipeline.ts` | `resolveImagePrompt` + `sanitizeForOpenAIImage` (тонкая досыпка) |
| `src/lib/typography-export.ts` | Текст `fonts_recommendations.txt` для ZIP |
| `src/app/api/chat/route.ts` | Chat proxy + mock mode |
| `src/app/api/image/route.ts` | Image generation |
| `src/components/ControlPanel.tsx` | Selectors |
| `src/components/DialoguePanel.tsx` | Dialogue + shortcuts |
| `src/components/OutputPanel.tsx` | Outputs + image gen + ZIP |
