"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { mergeStatePatch, sendDialogueTurn } from "@/lib/actions";
import type { ChatMessage } from "@/lib/state";

function uid(p: string) {
  return `${p}_${Math.random().toString(16).slice(2)}`;
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
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length]);

  async function runTurn(userText: string) {
    const text = userText.trim();
    if (!text || busy) return;

    setBusy(true);
    const history = state.messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      const { reply, statePatch } = await sendDialogueTurn(state, text, history);

      const userMsg: ChatMessage = { id: uid("u"), role: "user", content: text };
      const assistantMsg: ChatMessage = { id: uid("a"), role: "assistant", content: reply };
      const patch = mergeStatePatch(state, statePatch);

      dispatch({
        type: "set",
        patch: {
          messages: [...state.messages, userMsg, assistantMsg],
          ...patch
        }
      });
      setInput("");
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
            className="rounded-lg border border-border bg-black/25 px-2 py-1 text-[11px] text-muted hover:bg-black/35 hover:text-text disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-black/15 p-3">
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
                  "max-w-[95%] rounded-xl border px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto border-accent/25 bg-accent/5 text-text"
                    : "mr-auto border-border bg-black/25 text-text"
                ].join(" ")}
              >
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {m.role === "user" ? "Вы" : "Ассистент"}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-black/20 p-3">
        <textarea
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
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={busy || !input.trim()}
            className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-text hover:bg-accent/15 disabled:opacity-50"
          >
            {busy ? "Отправка…" : "Отправить"}
          </button>
        </div>
        <div className="mt-2 text-xs text-muted">Enter — отправить, Shift+Enter — новая строка.</div>
      </div>
    </div>
  );
}
