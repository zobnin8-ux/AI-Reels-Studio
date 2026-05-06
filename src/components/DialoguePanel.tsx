"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudioActivity } from "@/lib/studio-activity";
import { useStudio } from "@/lib/studio-store";
import { getSoundEnabled, playSendClick, setSoundEnabled } from "@/lib/ui-sound";
import { generateImagesFromState, mergeStatePatch, sendDialogueTurn } from "@/lib/actions";
import { canRunImageGeneration, userWantsImageGeneration } from "@/lib/auto-image-intent";
import type { ChatMessage, StudioState } from "@/lib/state";
import { mergePromptForSlide } from "@/lib/prompt-sync";
import { ImageStripPanel } from "@/components/ImageStripPanel";
import {
  extractMusicFromReply,
  isMusicBlockEmpty,
  looksLikeMusicReply,
  userExplicitMusicIntent,
  wantsMusicFollowUp,
  wantsMusicKeyword,
  wantsMusicRefinement
} from "@/lib/music-reply-sync";
import {
  extractSlideIndexFromAssistantReply,
  extractSlideIndexFromUserMessage,
  normalizeImagePromptFromReply,
  userWantsPromptImprovement
} from "@/lib/prompt-reply-sync";
import {
  extractCaptionFromJsonBlob,
  sanitizeModelReplyForDisplay,
  unwrapCaptionValue
} from "@/lib/chat-reply-format";

function uid(p: string) {
  return `${p}_${Math.random().toString(16).slice(2)}`;
}

const MAX_SESSION_UNDO = 8;

function cloneSessionState(s: StudioState): StudioState {
  if (typeof structuredClone === "function") {
    return structuredClone(s);
  }
  return JSON.parse(JSON.stringify(s)) as StudioState;
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
  return /\b(caption|капшн|подпись|подпись\s+к\s+посту|текст\s+поста|описание\s+поста)\b/i.test(
    text
  );
}

function extractCaptionFromReply(reply: string): string {
  const fromBlob = extractCaptionFromJsonBlob(reply);
  if (fromBlob?.trim()) return unwrapCaptionValue(fromBlob);
  const json = tryExtractJson(reply);
  const c = json?.caption;
  if (typeof c === "string" && c.trim()) return unwrapCaptionValue(cleanTextValue(c));
  const sp = json?.statePatch as Record<string, unknown> | undefined;
  const nested = sp?.caption;
  if (typeof nested === "string" && nested.trim()) return unwrapCaptionValue(cleanTextValue(nested));
  const m = reply.match(/(?:caption|подпись)\s*[:\-]\s*([\s\S]*)/i);
  if (m?.[1]) return unwrapCaptionValue(cleanTextValue(m[1]));
  return unwrapCaptionValue(cleanTextValue(reply));
}

const SHORTCUTS: { label: string; message: string }[] = [
  { label: "Жёстче", message: "Сделай текущий сценарий жёстче, сохрани структуру и CTA." },
  { label: "Через цифру", message: "Перепиши сценарий через числовой хук, сохрани идею." },
  {
    label: "Проверить логику",
    message: "Проверь логику сценария, особенно финальные слайды."
  },
  {
    label: "Уточни кадры",
    message:
      "Дай короткие опциональные уточнения для перегенерации кадров (свет, настроение), если нужно — по одному на слайд."
  },
  {
    label: "Подпись",
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
  const { state, dispatch, sessionUndoResetEpoch } = useStudio();
  const { setChatBusy } = useStudioActivity();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnResults, setTurnResults] = useState<
    | null
    | {
        id: string;
        items: { key: string; label: string }[];
        undoState: StudioState;
      }
  >(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const followNextRef = useRef(true);
  /** Полные снимки сессии до каждого успешного хода (откат ⌘/Ctrl+Shift+Z). */
  const sessionUndoStackRef = useRef<StudioState[]>([]);
  const [sessionUndoDepth, setSessionUndoDepth] = useState(0);
  const prevSessionUndoEpochRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevSessionUndoEpochRef.current === null) {
      prevSessionUndoEpochRef.current = sessionUndoResetEpoch;
      return;
    }
    if (sessionUndoResetEpoch === prevSessionUndoEpochRef.current) return;
    prevSessionUndoEpochRef.current = sessionUndoResetEpoch;
    sessionUndoStackRef.current = [];
    setSessionUndoDepth(0);
    setTurnResults(null);
  }, [sessionUndoResetEpoch]);

  useEffect(() => {
    setSoundOn(getSoundEnabled());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
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

  function pushSessionUndoSnapshot(snapshot: StudioState) {
    sessionUndoStackRef.current = [
      ...sessionUndoStackRef.current.slice(-(MAX_SESSION_UNDO - 1)),
      cloneSessionState(snapshot)
    ];
    setSessionUndoDepth(sessionUndoStackRef.current.length);
  }

  const applySessionHistoryUndo = useCallback(() => {
    if (busy) return;
    const prev = sessionUndoStackRef.current.pop();
    if (!prev) return;
    setSessionUndoDepth(sessionUndoStackRef.current.length);
    setTurnResults(null);
    dispatch({ type: "replace", state: prev });
  }, [busy, dispatch]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !e.shiftKey) return;
      if (e.code !== "KeyZ") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("textarea, input, select, [contenteditable='true']")) return;
      if (sessionUndoStackRef.current.length === 0) return;
      e.preventDefault();
      applySessionHistoryUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applySessionHistoryUndo]);

  async function runTurn(userText: string) {
    const text = userText.trim();
    if (!text || busy) return;

    followNextRef.current = true;
    playSendClick();
    setBusy(true);
    setTurnResults(null);
    const history = state.messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      const { reply, statePatch } = await sendDialogueTurn(state, text, history);

      // Снимок полной сессии до применения ответа этого хода (включая откат автогенерации кадров в этом ходу).
      pushSessionUndoSnapshot(state);

      const userMsg: ChatMessage = { id: uid("u"), role: "user", content: text };
      const cleanedReply = sanitizeModelReplyForDisplay(reply);
      const assistantContent =
        cleanedReply.trim().length > 0 ? cleanedReply : "Ответ получен, но текст пустой. Проверь /api/chat и ключи.";
      const assistantMsg: ChatMessage = {
        id: uid("a"),
        role: "assistant",
        content: assistantContent
      };
      const patch = mergeStatePatch(state, statePatch);

      const allowMusicFill =
        userExplicitMusicIntent(text) || wantsMusicFollowUp(text) || wantsMusicRefinement(text);
      if (patch.music !== undefined && !allowMusicFill) {
        delete patch.music;
      }

      const allowCaptionFill = wantsCaption(text);
      if (patch.caption !== undefined && !allowCaptionFill) {
        delete patch.caption;
      }
      if (patch.caption !== undefined) {
        patch.caption = unwrapCaptionValue(patch.caption);
      }

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
          if (targetSlideId && promptCandidate.length >= 3) {
            patch.prompts = mergePromptForSlide(state, targetSlideId, promptCandidate);
          }
        }
      }

      // Fallback для caption/music: модель иногда пишет их в reply, но забывает statePatch.
      if (!patch.caption && wantsCaption(text)) {
        const c = extractCaptionFromReply(reply);
        if (c) patch.caption = c;
      }
      const musicParsed = extractMusicFromReply(reply);
      if (isMusicBlockEmpty(patch.music) && !isMusicBlockEmpty(musicParsed)) {
        if (
          allowMusicFill ||
          (wantsMusicKeyword(text) && looksLikeMusicReply(reply))
        ) {
          patch.music = musicParsed;
        }
      }

      const merged: StudioState = {
        ...state,
        ...patch,
        messages: [...state.messages, userMsg, assistantMsg]
      };

      const results: { key: string; label: string }[] = [];
      if (patch.topic !== undefined) results.push({ key: "topic", label: "Тема" });
      if (patch.angles !== undefined || patch.selectedAngleId !== undefined) results.push({ key: "angles", label: "Углы" });
      if (patch.slides !== undefined) results.push({ key: "slides", label: "Слайды" });
      if (patch.prompts !== undefined) results.push({ key: "prompts", label: "Уточнения" });
      if (patch.sceneMeta !== undefined) results.push({ key: "sceneMeta", label: "Якоря" });
      if (patch.caption !== undefined) results.push({ key: "caption", label: "Подпись" });
      if (patch.music !== undefined) results.push({ key: "music", label: "Музыка" });
      if (results.length > 0) {
        const undoState: StudioState = {
          ...state,
          // сохраняем текущий диалог (чтобы undo откатывал артефакты, но не удалял переписку)
          messages: merged.messages
        };
        setTurnResults({ id: uid("r"), items: results, undoState });
      }

      dispatch({
        type: "set",
        patch: {
          messages: merged.messages,
          ...patch
        }
      });
      setInput("");

      if (merged.autoGenerateImages && userWantsImageGeneration(text) && canRunImageGeneration(merged)) {
        try {
          const images = await generateImagesFromState(merged, {
            onProgress: ({ images: next }) => {
              dispatch({ type: "set", patch: { images: next } });
            }
          });
          dispatch({ type: "set", patch: { images } });
          setTurnResults((r) => {
            if (!r) return r;
            if (r.items.some((x) => x.key === "images")) return r;
            return { ...r, items: [...r.items, { key: "images", label: "Кадры" }] };
          });
        } catch (imgErr: unknown) {
          const m = imgErr instanceof Error ? imgErr.message : "ошибка генерации";
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

  const clockStr = clock.toLocaleTimeString("ru-RU", { hour12: false });

  const topicOk = state.topic.trim().length > 0;
  const slidesOk = state.slides.length > 0;
  const imgTotal = state.images.length;
  const imgDone = state.images.filter((x) => x.status === "done" || x.status === "error").length;
  const imagesPackaged =
    imgTotal > 0 && imgDone === imgTotal && state.images.some((x) => x.status === "done");

  return (
    <div className="stage-inner">
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Эфир</span>
          <span className="stage-status">
            <span className="indicator" aria-hidden />
            <span className="key">{clockStr}</span>
          </span>
        </div>
        <h1 className="stage-h1">
          Сценарий собирается <b>здесь</b>
        </h1>
        <p className="stage-lead">
          Опиши идею — тему, цифру, диалог или настроение. Студия разложит её на{" "}
          <span>{state.slideCount} кадров</span>; картинки собираются отдельно из текста слайдов и селекторов.
          Подпись и музыку — по запросу.
        </p>
      </div>

      <nav className="flow-hint" aria-label="Шаги работы">
        <ol className="flow-hint-list">
          <li className={["flow-hint-step", topicOk ? "done" : !topicOk ? "active" : ""].filter(Boolean).join(" ")}>
            <span className="flow-hint-n" aria-hidden>
              1
            </span>
            Тема слева
          </li>
          <li
            className={["flow-hint-step", slidesOk ? "done" : topicOk ? "active" : ""].filter(Boolean).join(" ")}
          >
            <span className="flow-hint-n" aria-hidden>
              2
            </span>
            Диалог — сценарий
          </li>
          <li
            className={["flow-hint-step", imagesPackaged ? "done" : slidesOk ? "active" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="flow-hint-n" aria-hidden>
              3
            </span>
            Сборка: кадры и ZIP
          </li>
        </ol>
        <div className="flow-hint-actions">
          <button
            type="button"
            className="asset-badge"
            disabled={busy || sessionUndoDepth === 0}
            onClick={() => applySessionHistoryUndo()}
            title="Откатить последний успешный ход диалога (сообщения и состояние сессии). Горячие клавиши: Ctrl+Shift+Z или ⌘+Shift+Z"
            aria-label="Откатить последний ход диалога"
          >
            Шаг назад · {sessionUndoDepth}
          </button>
          <span className="flow-hint-kbd">Ctrl+Shift+Z</span>
        </div>
      </nav>

      <div className="prompts">
        {SHORTCUTS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            disabled={busy}
            onClick={() => void runTurn(s.message)}
            className={i === 0 ? "chip primary" : "chip"}
          >
            {s.label}
          </button>
        ))}
      </div>

      {busy ? (
        <div className="busy-ribbon" role="status" aria-live="polite">
          <span className="dot-pulse" aria-hidden />
          Запрос к модели… ответ появится в ленте ниже.
        </div>
      ) : null}

      {turnResults ? (
        <div className="busy-ribbon" role="status" aria-live="polite" style={{ borderColor: "var(--border-soft)" }}>
          <span className="studio-dot-soft" aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} />
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--text)" }}>Обновлено:</span>
            {turnResults.items.map((it) => (
              <span
                key={it.key}
                className="asset-badge"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px" }}
              >
                {it.label}
              </span>
            ))}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="asset-badge"
            onClick={() => {
              sessionUndoStackRef.current = [];
              setSessionUndoDepth(0);
              dispatch({ type: "replace", state: turnResults.undoState });
              setTurnResults(null);
            }}
          >
            Отменить ход
          </button>
          <button type="button" className="asset-badge" onClick={() => setTurnResults(null)}>
            Готово
          </button>
        </div>
      ) : null}

      <ImageStripPanel variant="rail" />

      <div className="dialog-middle">
        <div
          ref={scrollRef}
          onScroll={onScrollArea}
          className={[
            "dialog-scroll",
            state.messages.length === 0 ? "is-empty" : ""
          ].join(" ")}
        >
          {state.messages.length === 0 ? (
            <div className="empty">
              <div className="holo-core">
                <div className="crosshair-h" />
                <div className="crosshair-v" />
                <div className="core-glow" />
                <svg className="ring1" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.7">
                  <circle cx="60" cy="60" r="58" strokeDasharray="3 5" />
                  <circle cx="60" cy="2" r="1.6" fill="currentColor" />
                </svg>
                <svg className="ring2" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.7">
                  <circle cx="60" cy="60" r="46" strokeDasharray="2 7" />
                </svg>
                <svg className="ring3" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.5">
                  <circle cx="60" cy="60" r="34" />
                  <circle cx="94" cy="60" r="1.2" fill="currentColor" />
                </svg>
                <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.9">
                  <circle cx="60" cy="60" r="18" />
                  <circle cx="60" cy="60" r="5" fill="currentColor" />
                </svg>
              </div>
              <h3 className="empty-h">
                Готов принять <b>направление</b>
              </h3>
              <p className="empty-p">
                Опиши тему, настроение или одну фразу — и я разложу её на сценарий.
                <br />
                <kbd>Enter</kbd> — отправить · <kbd>Shift</kbd> + <kbd>Enter</kbd> — новая строка
              </p>
            </div>
          ) : (
            <>
              {state.messages.map((m) => (
                <div
                  key={m.id}
                  className={["bubble-row", m.role === "user" ? "user" : "assistant"].join(" ")}
                >
                  <div
                    className={[
                      "bubble",
                      m.role === "user" ? "bubble-user" : "bubble-assistant",
                      !seenMessageIdsRef.current.has(m.id) ? "studio-enter" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="bubble-role">{m.role === "user" ? "Вы" : "Ассистент"}</div>
                    <div>{m.content?.trim?.() ? m.content : "…"}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>

        {showJumpLatest && state.messages.length > 0 ? (
          <button
            type="button"
            className="jump-latest"
            aria-label="Прокрутить к последним сообщениям"
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

      <div className="composer stage-composer">
        <div className="composer-prefix">
          <span>▸ ввод направления</span>
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {busy ? "думаю" : "готов"}
            <span className="blink" aria-hidden />
          </span>
        </div>
        <div className="composer-body">
          <div className={["composer-input-wrap", inputShake ? "composer-input-shake" : ""].filter(Boolean).join(" ")}>
            <textarea
              ref={inputRef}
              id="studio-dialogue-input"
              className="composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Расскажи, о чём думаешь сегодня…"
              rows={2}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
          </div>
        </div>
        <div className="composer-foot">
          <div className="tools">
            <button type="button" className="tool" disabled title="Скоро" aria-label="Прикрепить файл (скоро)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15M7 10L12 15L17 10M12 15V3" />
              </svg>
              Прикрепить
            </button>
            <label className="tool" style={{ cursor: "pointer" }} aria-label={`Звук при отправке: ${soundOn ? "включён" : "выключен"}`}>
              <input
                type="checkbox"
                checked={soundOn}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSoundEnabled(on);
                  setSoundOn(on);
                }}
                className="sr-only"
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M12 2A3 3 0 009 5V12A3 3 0 0015 12V5A3 3 0 0012 2ZM19 10V12A7 7 0 015 12V10M12 19V22" />
              </svg>
              Звук {soundOn ? "вкл" : "выкл"}
            </label>
          </div>
          <button
            type="button"
            className="send"
            onClick={() => void onSend()}
            disabled={busy || !input.trim()}
            aria-label={busy ? "Отправка сообщения" : "Отправить сообщение"}
          >
            {busy ? "Отправка…" : "Отправить"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M5 12H19M13 6L19 12L13 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
