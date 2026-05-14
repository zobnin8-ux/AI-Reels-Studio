# AI Reels Studio

**Dialogue-first studio** for Instagram **Reels** (9:16) and **feed posts** (4:5). You steer the work in natural language; the model returns structured updates (slides, English image prompts, optional caption/music). Images are generated through **OpenAI** and normalized to **1080×1920** or **1080×1350** for export.

```
┌─────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Control     │    │  Dialogue (source     │    │  Output             │
│  selectors   │───▶│  of truth)           │───▶│  prompts · images   │
│  import/export│   │  Anthropic / OpenAI  │    │  ZIP · checklist    │
└─────────────┘    └──────────────────────┘    └─────────────────────┘
```

---

## Table of contents

1. [What you get](#what-you-get)  
2. [Stack](#stack)  
3. [Quick start](#quick-start)  
4. [Environment variables](#environment-variables)  
5. [Typical workflow](#typical-workflow)  
6. [Projects (brand profiles)](#projects-brand-profiles)  
7. [How the chat contract works](#how-the-chat-contract-works)  
8. [Images & references](#images--references)  
9. [Session, undo, backup](#session-undo-backup)  
10. [Keyboard & UI notes](#keyboard--ui-notes)  
11. [API reference](#api-reference)  
12. [ZIP export](#zip-export)  
13. [Repository map](#repository-map)  
14. [Troubleshooting](#troubleshooting)  
15. [Pushing to GitHub](#pushing-to-github)  

---

## What you get

| Capability | Detail |
|------------|--------|
| **Multi-brand** | Built-in profiles: *После него*, *Zobnin AI*, *OlgaTrip* — each with its own system prompt, CTA rules, and **IMAGE PROMPT SPEC** (English prompts for OpenAI). |
| **Chat → state** | Model replies with JSON: `reply` (markdown-friendly prose) + optional `statePatch` (topic, angles, slides, `imagePrompts`, caption, music). |
| **Resilient parsing** | If the model returns slightly invalid JSON (e.g. one bad image row), the server applies a **partial** patch and returns `chatParse` with warnings; the UI can **retry** the same turn without duplicating the user message in API history. |
| **Images** | `POST /api/image` — OpenAI image generation, optional **reference images** (style transfer via edit path), **sharp** resize to Instagram pixel sizes. |
| **Stock refs** | Unsplash / Pexels proxy routes for picking reference stills (optional API keys). |
| **Export** | One-click **ZIP**: scenario, prompts as sent to OpenAI, caption, music notes, typography hints, PNG/JPEG frames. |
| **Import / export JSON** | Versioned session envelope (`session-import.ts`) for backup or moving between machines. |

**Not included:** server-side user accounts, cloud sync, or built-in video render — the app is a **pre-production** desk for copy + stills + handoff notes.

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router), **React 19** |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS 3** |
| Validation | **Zod** |
| Images | **OpenAI** Images API + **sharp** (resize / ref normalize) |
| Chat | **OpenAI** Chat Completions (JSON mode) or **Anthropic** Messages |
| ZIP (client) | **JSZip** |

`next.config.ts` marks `sharp` as a server external package so the image route runs reliably on the server.

---

## Quick start

**Requirements:** Node.js **20+** recommended (LTS), npm 10+.

```bash
git clone https://github.com/zobnin8-ux/AI-Reels-Studio.git
cd AI-Reels-Studio
npm install
cp .env.example .env.local
# Edit .env.local — at minimum set keys (see below). For dry runs: AI_MOCK_MODE=1
npm run dev
```

Open **http://localhost:3000**.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

---

## Environment variables

Copy **`.env.example`** → **`.env.local`**. Never commit `.env.local` (it is gitignored).

### Required for real chat + images

| Variable | When |
|----------|------|
| `OPENAI_API_KEY` | **Always** for `/api/image`. Also for `/api/chat` if `provider` is OpenAI. |
| `ANTHROPIC_API_KEY` | For `/api/chat` if `provider` is Anthropic (default in UI). |

### Mock mode (no keys)

| Variable | Effect |
|----------|--------|
| `AI_MOCK_MODE=1` | `/api/chat` returns a stub `{ reply, statePatch: {}, chatParse }` — useful for UI wiring without spend. |

> **Note:** `.env.example` may list `NEXT_PUBLIC_AI_MOCK_MODE`; the codebase currently reads **only** `AI_MOCK_MODE` on the server for chat mock. Ignore or remove the public variable until client-side mock is wired.

### Optional — models & image quality

| Variable | Default | Notes |
|----------|---------|-------|
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` (or `OPENAI_MODEL`) | Chat when using OpenAI. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | Falls back to `gpt-image-1` / `dall-e-3` if your org does not have `gpt-image-2`. |
| `OPENAI_IMAGE_QUALITY` | `high` | For `gpt-image-*`: `low` \| `medium` \| `high`. Set to `skip` if the API rejects `quality`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Override Claude model id. |
| `OPENAI_STOCK_QUERY_MODEL` | same as chat model | Used to translate RU reference search queries to EN keywords for stock APIs. |

### Optional — reference stock APIs

| Variable | Purpose |
|----------|---------|
| `UNSPLASH_ACCESS_KEY` | `POST /api/references/unsplash` |
| `PEXELS_API_KEY` | `POST /api/references/pexels` |

### Chat route timeout

`src/app/api/chat/route.ts` sets `maxDuration = 300` (seconds) for long generations on compatible hosts (e.g. Vercel). If you self-host behind a reverse proxy, align **proxy read timeout** with that value to avoid **502** on slow turns.

---

## Typical workflow

1. **Left column — Control:** pick **project**, **Reels vs Post**, **slide count** (5 / 7 / 9), **CTA** (website / direct trigger / none / custom). Set **provider** (Anthropic vs OpenAI) if needed.  
2. **Center — Dialogue:** describe the idea, ask for angles, then a full scenario. The model should return `slides` + `imagePrompts` (English, per profile spec). Use shortcuts (*Жёстче*, *Уточни кадры*, *Подпись*, *Музыка*, …) as needed.  
3. **Right — Output:** review each slide’s prompt, edit **manual override** if required, **generate one** or **all** images. Toggle **auto-generate from chat** only if you want images to fire from certain chat phrases.  
4. **References (optional):** search stock or upload; enable **apply on generate** so refs are sent with batch image generation (strong style influence).  
5. **Export:** download **ZIP** when frames are `done`.

---

## Projects (brand profiles)

All copy rules and **IMAGE PROMPT SPEC** live in **`src/lib/profiles.ts`** (large file — single source of truth for each `ProjectId`).

| `project` | Label | Role |
|-----------|-------|------|
| `poslenego` | После него | Breakup / attachment loop — sharp Russian copy; image spec is intimate documentary morning palette. |
| `zobnin` | Zobnin AI | Systems / automation brand — structured copy; image spec targets **bright modern tech** editorial (high-key, glass, campus mood). |
| `olgatrip` | OlgaTrip / Cashmere Coast | Travel-in-company — Russian copy + bright group travel image prompts. |

**CTA hinting** is injected from selectors via `getCtaHint()` in `dialogue-context.ts`.

---

## How the chat contract works

1. **`buildDialogueSystemPrompt()`** (`src/lib/dialogue-context.ts`) concatenates: profile system text + UI selectors + **current session JSON** + mandatory **response format** (JSON only).  
2. Client sends `POST /api/chat` with `{ provider, messages, selectors, session }`.  
3. Server calls OpenAI or Anthropic, then **`parseModelChatOutput()`** (`src/lib/chat-response-parse.ts`):  
   - **Strict** pass: full `chatApiResponseSchema`.  
   - Else **coerce**: keep valid `statePatch` fields; drop invalid `imagePrompt` rows with warnings; still surface `reply` text when possible.  
4. Response shape:

```json
{
  "reply": "…markdown-friendly user-facing text…",
  "statePatch": { },
  "chatParse": {
    "mode": "ok | partial | reply_only",
    "warnings": ["…"]
  }
}
```

5. Client **`mergeStatePatch()`** (`actions.ts`) merges into React state; **`alignImagesToSlides`** keeps `images[]` aligned when slides change.

---

## Images & references

- **Route:** `POST /api/image` — body includes `prompt`, `aspect` (`9:16` \| `4:5`), optional `useReferences` + `references[]` (URLs or data URLs).  
- **Pipeline:** `resolveImagePrompt` → `softenImagePromptForModeration` → `sanitizeForOpenAIImage` (`image-prompt-pipeline.ts`) — strips risky tokens, ensures “no text” / aspect hints.  
- **OpenAI failures:** `moderation_blocked` returns a Russian explanation + heuristic **trigger hints** (`sniffModerationTriggers`).  
- **References:** normalized with **sharp** (strip EXIF, resize long edge, JPEG) before multipart edit call — keeps payload stable.

---

## Session, undo, backup

| Topic | Behavior |
|-------|----------|
| **Main session** | Held in **React memory** (client). On each full load, legacy `localStorage` key `ai-reels-studio:v2026:session` is **cleared** intentionally — no silent restore of the full deck. |
| **UI prefs** | Some toggles (e.g. scenario panel open, output mode) use **other** `localStorage` keys — see `OutputPanel` / related components. |
| **Undo** | **Ctrl+Shift+Z** / **⌘+Shift+Z** (when not typing in an input): restores session snapshot **before** the last successful chat turn (see `DialoguePanel` + `sessionUndoStackRef`). |
| **Backup** | Use **Export JSON** in the control column and store the file wherever you want. **Import** validates `SESSION_EXPORT_VERSION` (`session-import.ts`). |

---

## Keyboard & UI notes

| Shortcut | Action |
|----------|--------|
| **Enter** | Send message (in dialogue textarea) |
| **Shift+Enter** | New line |
| **Ctrl+Shift+Z** / **⌘+Shift+Z** | Undo last successful dialogue turn (global handler when focus not in a field) |

When the server returns `chatParse.mode !== "ok"` or non-empty `warnings`, the UI appends a short **technical** footer to the assistant message and may show **“Повторить запрос к модели”** — same user text, replaces the last assistant bubble, **no duplicate user message** in the API payload.

---

## API reference

### `POST /api/chat`

| Body field | Type | Notes |
|------------|------|-------|
| `provider` | `"openai"` \| `"anthropic"` | |
| `messages` | `{ role, content }[]` | `role`: `user` \| `assistant`; last user turn is appended client-side unless `historyEndsWithLastUser` is used internally for retry. |
| `selectors` | object | `project`, `contentType`, `slideCount`, `ctaMode`, `website`, `triggerWord`, `customCta` |
| `session` | object | `topic`, `angles`, `slides`, `selectedAngleId`, `approved`, `imagePrompts`, `caption`, `music` |

**Response:** `reply`, `statePatch` (may be `{}`), `chatParse: { mode, warnings }`.

### `POST /api/image`

JSON body: `prompt`, `aspect` (`"9:16"` \| `"4:5"`), optional `stylePreset`, `useReferences`, `references[]` (URLs or `data:image/...;base64,...`).

**Success response:** JSON object `{ "imageBase64": string, "mimeType": string }` — PNG at **1080×1920** (reels) or **1080×1350** (post), after **sharp** cover-crop from the OpenAI native size.

**Error response:** `{ "error": string }` with appropriate HTTP status (including localized hints for `moderation_blocked`).

### `POST /api/references/unsplash` · `POST /api/references/pexels`

JSON body: `{ "query": string, "perPage"?: number }` — `query` is user text (RU ok); server may rewrite to EN keywords via OpenAI (`keywordsForStockPhotoSearch` in `stock-photo-query.ts`). Require respective env keys when enabled.

---

## ZIP export

File name: **`<sanitized_topic>_<reels|post>.zip`**.

| File | Contents |
|------|----------|
| `scenario.txt` | Slide titles + Russian body text |
| `image_prompts_openai.txt` | Per slide: **final** prompt sent to OpenAI when available, else sanitized prompt from editor |
| `caption.txt` | Caption field |
| `music_notes.txt` | Queries / recommendations / avoid |
| `fonts_recommendations.txt` | Typography handoff from `typography-export.ts` |
| `images/01.png` … | Only slides with `status === "done"` and base64 payload |

---

## Repository map

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat proxy, parseModelChatOutput, mock
│   │   ├── image/route.ts         # OpenAI image + sharp + refs
│   │   └── references/
│   │       ├── unsplash/route.ts
│   │       └── pexels/route.ts
│   ├── layout.tsx
│   ├── page.tsx                   # Renders AppShell
│   └── globals.css · v2026*.css
├── components/
│   ├── AppShell.tsx               # 3-column layout
│   ├── ControlPanel.tsx
│   ├── DialoguePanel.tsx
│   ├── OutputPanel.tsx
│   ├── ReferencesPanel.tsx
│   ├── ImageSlideCard.tsx
│   └── …
└── lib/
    ├── state.ts                   # StudioState + createInitialState
    ├── studio-store.tsx           # Reducer + provider
    ├── profiles.ts                # Brand system prompts (large)
    ├── dialogue-context.ts        # System prompt assembly
    ├── actions.ts                 # sendDialogueTurn, mergeStatePatch, images, ZIP
    ├── chat-response.ts           # Zod schemas
    ├── chat-response-parse.ts     # Strict + partial JSON recovery
    ├── chat-model-json.ts         # JSON extraction helpers
    ├── image-prompt-pipeline.ts   # Moderation soften + sanitize
    ├── image-prompt-sync.ts       # alignImagesToSlides, manual merge
    ├── session-import.ts          # Versioned JSON import
    ├── typography-export.ts
    └── …
```

---

## Troubleshooting

| Symptom | Likely cause | What to try |
|---------|--------------|--------------|
| Chat 502 / gateway timeout | Proxy or host timeout < model latency | Increase server / proxy read timeout; shorten request; use faster model. |
| `moderation_blocked` on images | English prompt triggers | Follow hints in API error; avoid scrutiny words near “laptop”; use age phrases (“in her thirties”) not `42-year-old`; see `image-prompt-pipeline.ts` replacements. |
| Slides update but not images | `imagePrompts` invalid / too short | Check `chatParse.warnings`; ask model to regenerate prompts (shortcut *Уточни кадры*). |
| Anthropic works, images fail | Missing OpenAI key | `OPENAI_API_KEY` required for `/api/image`. |
| Stock search empty | Missing keys | Set `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY`. |

---

## Pushing to GitHub

1. **Confirm secrets are not tracked:** `git status` must not list `.env.local`. `.gitignore` already excludes `.env*` variants.  
2. **Optional:** add a **`LICENSE`** file if the repo is public (none ships with this template).  
3. **Initialize remote (if not yet):**

```bash
git remote add origin https://github.com/zobnin8-ux/AI-Reels-Studio.git
git branch -M main
git add .
git commit -m "Describe your change in a full sentence."
git push -u origin main
```

4. **README for collaborators:** they only need: clone → `npm install` → `.env.local` from `.env.example` → `npm run dev`.

---

## License

No default license file is bundled. If you open-source this repo, add an explicit **LICENSE** (e.g. MIT, Apache-2.0, or “all rights reserved”) so others know what they can do with the code and the embedded brand prompts in `profiles.ts`.
