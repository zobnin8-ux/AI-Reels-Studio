"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioActivity } from "@/lib/studio-activity";
import { useStudio } from "@/lib/studio-store";
import { getSoundEnabled, playSendClick, setSoundEnabled } from "@/lib/ui-sound";
import { generateImagesFromState, mergeStatePatch, sendDialogueTurn } from "@/lib/actions";
import { canRunImageGeneration, userWantsImageGeneration } from "@/lib/auto-image-intent";
import type { ChatMessage, StudioState } from "@/lib/state";
import { mergePromptForSlide } from "@/lib/prompt-sync";
import {
  extractMusicFromReply,
  isMusicBlockEmpty,
  looksLikeMusicReply,
  wantsMusicKeyword,
  wantsMusicRefinement
} from "@/lib/music-reply-sync";
import {
  extractSlideIndexFromAssistantReply,
  extractSlideIndexFromUserMessage,
  normalizeImagePromptFromReply,
  userWantsPromptImprovement
} from "@/lib/prompt-reply-sync";

function uid(p: string) {
  return `${p}_${Math.random().toString(16).slice(2)}`;
}

function tryExtractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanTextValue(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  const fenced = s.match(/```(?:[\w-]*)?\s*\n([\s\S]*?)```/);
  if (fenced?.[1]) s = fenced[1].trim();
  s = s.replace(/^\s*(caption|подпись)\s*[:\-]\s*/i, "");
  s = s.replace(/^[`"'«»\s]+|[`"'«»\s]+$/g, "");
  s = s.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  const jsonLike = s.match(/^\{\s*"?\w+"?\s*:\s*([\s\S]*?)\}$/);
  if (jsonLike?.[1]) s = jsonLike[1].trim();
  return s.trim();
}

function wantsCaption(text: string): boolean {
  return /\b(caption|капшн|подпись)\b/i.test(text);
}

function extractCaptionFromReply(reply: string): string {
  const json = tryExtractJson(reply);
  const c = json?.caption;
  if (typeof c === "string" && c.trim()) return cleanTextValue(c);
  const m = reply.match(/(?:caption|подпись)\s*[:\-]\s*([\s\S]*)/i);
  if (m?.[1]) return cleanTextValue(m[1]);
  return cleanTextValue(reply);
}

const SHORTCUTS: { label: string; message: string }[] = [
  { label: "Жёстче", message: "Сделай текущий сценарий жёстче, сохрани структуру и CTA." },
  { label: "Через цифру", message: "Перепиши сценарий через числовой хук, сохрани идею." },
  {
    label: "Проверить логику",
    message: "Проверь логику сценария, особенно финальные слайды."
  },
  {
    label: "Дай промпты",
    message: "Создай промпты по каждому слайду с учётом выбранного стиля и формата."
  },
  {
    label: "Caption",
    message: "Напиши caption, не повторяя текст слайдов, с учётом CTA."
  },
  {
    label: "Музыка",
    message: "Подбери музыку (поисковые запросы и направления) под текущий ролик."
  },
  {
    label: "Утверждаю",
    message: "Этот вариант утверждаю."
  }
];

export function DialoguePanel() {
  const { state, dispatch } = useStudio();
  const { setChatBusy } = useStudioActivity();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const followNextRef = useRef(true);

  useEffect(() => {
    setSoundOn(getSoundEnabled());
  }, []);

  useEffect(() => {
    setChatBusy(busy);
  }, [busy, setChatBusy]);

  useEffect(() => {
    // отмечаем отрендеренные сообщения как «виденные», чтобы анимировать только новые
    const set = seenMessageIdsRef.current;
    state.messages.forEach((m) => set.add(m.id));
  }, [state.messages]);

  useEffect(() => {
    // Держим фокус в поле диалога после отправки/ответа, чтобы не кликать мышкой каждый раз.
    if (!busy) inputRef.current?.focus();
  }, [busy, state.messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 120;
    const d = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (followNextRef.current || d < threshold) {
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
      setShowJumpLatest(false);
    } else {
      setShowJumpLatest(true);
    }
    followNextRef.current = false;
  }, [state.messages.length]);

  function onScrollArea() {
    const el = scrollRef.current;
    if (!el) return;
    const d = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (d < 80) setShowJumpLatest(false);
  }

  async function runTurn(userText: string) {
    const text = userText.trim();
    if (!text || busy) return;

    followNextRef.current = true;
    playSendClick();
    setBusy(true);
    const history = state.messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      const { reply, statePatch } = await sendDialogueTurn(state, text, history);

      const userMsg: ChatMessage = { id: uid("u"), role: "user", content: text };
      const assistantMsg: ChatMessage = { id: uid("a"), role: "assistant", content: reply };
      const patch = mergeStatePatch(state, statePatch);

      // Если модель не положила промпт в statePatch — пробуем вытащить из reply:
      // явный номер слайда в сообщении, режим «улучши промпт», номер кадра из текста ответа.
      if (!patch.prompts && state.slides.length > 0) {
        let slideIdx = extractSlideIndexFromUserMessage(text, state.slides.length);
        if (!slideIdx && userWantsPromptImprovement(text)) {
          slideIdx = extractSlideIndexFromAssistantReply(reply);
        }
        if (!slideIdx && userWantsPromptImprovement(text) && state.slides.length === 1) {
          slideIdx = 1;
        }
        if (slideIdx && slideIdx >= 1 && slideIdx <= state.slides.length) {
          const targetSlideId = state.slides[slideIdx - 1]!.id;
          const promptCandidate = normalizeImagePromptFromReply(reply);
          if (targetSlideId && promptCandidate.length >= 15) {
            patch.prompts = mergePromptForSlide(state, targetSlideId, promptCandidate);
          }
        }
      }

      // Fallback для caption/music: модель иногда пишет их в reply, но забывает statePatch.
      if (!patch.caption && wantsCaption(text)) {
        const c = extractCaptionFromReply(reply);
        if (c) patch.caption = c;
      }
      const musicIntent =
        wantsMusicKeyword(text) || wantsMusicRefinement(text) || looksLikeMusicReply(reply);
      if (musicIntent && isMusicBlockEmpty(patch.music)) {
        const m = extractMusicFromReply(reply);
        if (!isMusicBlockEmpty(m)) patch.music = m;
      }

      const merged: StudioState = {
        ...state,
        ...patch,
        messages: [...state.messages, userMsg, assistantMsg]
      };

      dispatch({
        type: "set",
        patch: {
          messages: merged.messages,
          ...patch
        }
      });
      setInput("");

      if (userWantsImageGeneration(text) && canRunImageGeneration(merged)) {
        try {
          const images = await generateImagesFromState(merged, {
            onProgress: ({ images: next }) => {
              dispatch({ type: "set", patch: { images: next } });
            }
          });
          dispatch({ type: "set", patch: { images } });
        } catch (imgErr: unknown) {
          const m = imgErr instanceof Error ? imgErr.message : "Image gen error";
          const errMsg: ChatMessage = {
            id: uid("a"),
            role: "assistant",
            content: `Не удалось сгенерировать кадры: ${m}`
          };
          dispatch({ type: "set", patch: { messages: [...merged.messages, errMsg] } });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка сети";
      const assistantMsg: ChatMessage = {
        id: uid("a"),
        role: "assistant",
        content: `Ошибка: ${msg}`
      };
      dispatch({
        type: "set",
        patch: {
          messages: [
            ...state.messages,
            { id: uid("u"), role: "user", content: text },
            assistantMsg
          ]
        }
      });
      setInputShake(true);
      window.setTimeout(() => setInputShake(false), 500);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    await runTurn(input);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <div className="text-sm font-medium text-muted">Диалог</div>
        <div className="text-xl font-semibold tracking-tight">Творческая сессия</div>
        <p className="mt-1 text-xs text-muted">
          Центр — источник правды по сценарию. Справа — промпты, картинки и экспорт только после явных шагов.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={busy}
            onClick={() => void runTurn(s.message)}
            className="studio-btn-ghost rounded-lg border border-border bg-black/25 px-2 py-1 text-[11px] text-muted hover:bg-black/35 hover:text-text disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScrollArea}
        className="h-full min-h-0 overflow-y-auto rounded-xl border border-border bg-black/15 p-3"
      >
        {state.messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-muted">
            Напиши первое сообщение — тему, настроение или вопрос по сценарию.
          </div>
        ) : (
          <div className="space-y-4">
            {state.messages.map((m) => (
              <div
                key={m.id}
                className={[
                  !seenMessageIdsRef.current.has(m.id) ? "studio-enter" : "",
                  "max-w-[95%] rounded-xl border px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto border-accent/25 bg-accent/5 text-text"
                    : "mr-auto border-border bg-black/25 text-text"
                ].join(" ")}
              >
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {m.role === "user" ? "Вы" : "Ассистент"}
                </div>
                <div className="max-w-full min-w-0 break-words whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {showJumpLatest && state.messages.length > 0 ? (
        <button
          type="button"
          className="studio-btn-ghost absolute bottom-3 right-4 rounded-full border border-accent/35 bg-black/70 px-3 py-1.5 text-[11px] text-text shadow-lg backdrop-blur hover:bg-black/85"
          onClick={() => {
            followNextRef.current = true;
            endRef.current?.scrollIntoView({ behavior: "smooth" });
            setShowJumpLatest(false);
          }}
        >
          Новые ниже ↓
        </button>
      ) : null}
      </div>

      <div
        className={[
          "rounded-xl border border-border bg-black/20 p-3",
          inputShake ? "studio-shake border-red-400/40" : ""
        ].join(" ")}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Сообщение…"
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => {
                const on = e.target.checked;
                setSoundEnabled(on);
                setSoundOn(on);
              }}
              className="rounded border-border bg-black/40"
            />
            Тихий звук при отправке
          </label>
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={busy || !input.trim()}
            className="studio-btn-primary rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-text hover:bg-accent/15 disabled:opacity-50"
          >
            {busy ? "Отправка…" : "Отправить"}
          </button>
        </div>
        <div className="mt-2 text-xs text-muted">Enter — отправить, Shift+Enter — новая строка.</div>
      </div>
    </div>
  );
}
