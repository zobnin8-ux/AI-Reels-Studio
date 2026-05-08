"use client";

import { useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { requestDialogueTurn } from "@/lib/dialogue-bridge";

type RefResult = { id: string; kind: "unsplash"; thumb: string; full: string; author?: string; sourceUrl?: string };

export function ReferencesPanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useStudio();
  const uploadRefsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<RefResult[]>([]);
  const [pinterestDraft, setPinterestDraft] = useState("");

  const refs = state.references;

  const selectedCount = refs.items.length + refs.pinterestUrls.length;
  const canUseRefs = selectedCount > 0;

  const selectedSummary = useMemo(() => {
    const lines: string[] = [];
    if (refs.items.length) {
      lines.push("Selected reference images (from in-app search/uploads):");
      for (const it of refs.items.slice(0, 12)) {
        const meta = [it.kind, it.author].filter(Boolean).join(" · ");
        lines.push(`- ${meta || "reference"} ${it.sourceUrl ? `(${it.sourceUrl})` : ""}`.trim());
      }
    }
    if (refs.pinterestUrls.length) {
      lines.push("Pinterest references (links):");
      for (const u of refs.pinterestUrls.slice(0, 12)) lines.push(`- ${u}`);
    }
    if (refs.items.some((x) => x.kind === "upload")) {
      lines.push(
        "Note: some refs are user-uploaded images; you can't view them directly, but treat them as style/scene guidance."
      );
    }
    return lines.join("\n");
  }, [refs.items, refs.pinterestUrls]);

  async function search() {
    const q = refs.query.trim();
    if (q.length < 2) {
      setNotice("Запрос слишком короткий (минимум 2 символа).");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const endpoint = refs.source === "pexels" ? "/api/references/pexels" : "/api/references/unsplash";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Search failed (${res.status})`);
      }
      const j = (await res.json()) as { items?: RefResult[] };
      setResults(j.items ?? []);
      if ((j.items ?? []).length === 0) {
        setNotice(
          "Ничего не найдено. Проверь ключи в .env.local (UNSPLASH_ACCESS_KEY / PEXELS_API_KEY) и перезапусти сервер."
        );
      }
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  function addResult(it: RefResult) {
    const cur = refs.items;
    if (cur.some((x) => x.id === it.id && x.kind === "unsplash")) return;
    const next = [{ ...it }, ...cur].slice(0, 24);
    dispatch({ type: "set", patch: { references: { ...refs, items: next } } });
  }

  function removeItem(id: string) {
    dispatch({ type: "set", patch: { references: { ...refs, items: refs.items.filter((x) => x.id !== id) } } });
  }

  function addPinterestUrl(raw: string) {
    const u = raw.trim();
    if (!u) return;
    const url = u.startsWith("http") ? u : `https://${u}`;
    if (refs.pinterestUrls.includes(url)) return;
    dispatch({ type: "set", patch: { references: { ...refs, pinterestUrls: [url, ...refs.pinterestUrls].slice(0, 24) } } });
  }

  function removePinterestUrl(url: string) {
    dispatch({
      type: "set",
      patch: { references: { ...refs, pinterestUrls: refs.pinterestUrls.filter((x) => x !== url) } }
    });
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const maxBytes = 3_000_000;
    const readOne = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("File read error"));
        r.onload = () => resolve(String(r.result ?? ""));
        r.readAsDataURL(f);
      });

    setBusy(true);
    setNotice(null);
    try {
      const uploads = [];
      for (const f of Array.from(files).slice(0, 12)) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > maxBytes) {
          setNotice(`Файл слишком большой: ${f.name} (лимит 3MB)`);
          continue;
        }
        const dataUrl = await readOne(f);
        const id = `upload_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        uploads.push({ id, kind: "upload" as const, thumb: dataUrl, full: dataUrl });
      }
      if (uploads.length) {
        dispatch({ type: "set", patch: { references: { ...refs, items: [...uploads, ...refs.items].slice(0, 24) } } });
      }
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (uploadRefsRef.current) uploadRefsRef.current.value = "";
    }
  }

  function askUseRefsForImagePrompts() {
    const lines = [
      "Используй выбранные референсы, чтобы переписать ВСЕ imagePrompts (по одному на каждый slideId).",
      "Не меняй тексты слайдов и сценарий.",
      "Сохрани структуру, эстетику и MODERATION HYGIENE активного профиля.",
      "",
      selectedSummary,
      "",
      'В statePatch верни только imagePrompts: [{"slideId","prompt"}, ...] для всех слайдов.'
    ].filter(Boolean);
    requestDialogueTurn(lines.join("\n"));
  }

  function askUseRefsForOneSlide() {
    if (state.slides.length === 0) {
      setNotice("Сначала нужны слайды (сценарий), затем можно переписывать промпты.");
      return;
    }
    const raw = typeof window !== "undefined" ? window.prompt("Номер слайда (1…)", "1") : "1";
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > state.slides.length) {
      setNotice(`Неверный номер. Доступно: 1–${state.slides.length}.`);
      return;
    }
    const s = state.slides[n - 1]!;
    const lines = [
      `Используй выбранные референсы, чтобы переписать ТОЛЬКО image prompt для слайда ${n} (slideId: ${s.id}, заголовок: «${s.title}»).`,
      "Не меняй тексты слайдов и сценарий.",
      "Сохрани структуру, эстетику и MODERATION HYGIENE активного профиля.",
      "",
      selectedSummary,
      "",
      'В statePatch верни только imagePrompts с ОДНИМ объектом {"slideId","prompt"} для этого slideId.'
    ].filter(Boolean);
    requestDialogueTurn(lines.join("\n"));
  }

  return (
    <div className="asset-block">
      <div className="asset-head">
        <div className="asset-h">
          Референсы <b>·</b> поиск и выбор
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="asset-badge">{selectedCount ? `${selectedCount} выбрано` : "пусто"}</span>
          <button
            type="button"
            className="asset-badge"
            disabled={!canUseRefs}
            onClick={() => askUseRefsForImagePrompts()}
            title="Попросить модель переписать imagePrompts с учётом референсов"
          >
            Использовать
          </button>
          <button
            type="button"
            className="asset-badge"
            disabled={!canUseRefs}
            onClick={() => askUseRefsForOneSlide()}
            title="Переписать imagePrompt одного слайда по референсам"
          >
            Один слайд
          </button>
        </div>
      </div>

      {notice ? (
        <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 8, whiteSpace: "pre-wrap" }}>{notice}</div>
      ) : null}

      <div className="field">
        <span className="label mono">Поиск</span>
        <div className="field-row" style={{ gap: 8 }}>
          <select
            className="select"
            value={refs.source}
            onChange={(e) => dispatch({ type: "set", patch: { references: { ...refs, source: e.target.value as "unsplash" | "pexels" } } })}
            style={{ maxWidth: 130 }}
            aria-label="Источник поиска референсов"
          >
            <option value="unsplash">Unsplash</option>
            <option value="pexels">Pexels</option>
          </select>
          <input
            className="input"
            value={refs.query}
            onChange={(e) => dispatch({ type: "set", patch: { references: { ...refs, query: e.target.value } } })}
            placeholder="italy street, women walking, cafe sunlight"
          />
          <button type="button" className="gen-btn" onClick={() => void search()} disabled={busy}>
            {busy ? "…" : "Искать"}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
          Для поиска нужны ключи в <span className="mono">.env.local</span>: <span className="mono">UNSPLASH_ACCESS_KEY</span> или{" "}
          <span className="mono">PEXELS_API_KEY</span>. После правки — перезапуск сервера.
        </div>
      </div>

      {results.length ? (
        <div className="field">
          <span className="label mono">Результаты</span>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 8 }}>
            {results.slice(0, 18).map((it) => (
              <button
                key={it.id}
                type="button"
                className="studio-btn-ghost"
                onClick={() => addResult(it)}
                style={{ padding: 0, borderRadius: 10, overflow: "hidden" }}
                title={it.author ? `Add · ${it.author}` : "Add"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <span className="label mono">Загрузить свои</span>
        <div className="field-row" style={{ gap: 8 }}>
          <button type="button" className="gen-btn" onClick={() => uploadRefsRef.current?.click()} disabled={busy}>
            Загрузить
          </button>
          <input
            ref={uploadRefsRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => void onUpload(e.target.files)}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>до 12 файлов, 3MB каждый</span>
        </div>
      </div>

      {refs.items.length ? (
        <div className="field">
          <span className="label mono">Выбрано</span>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 8 }}>
            {refs.items.slice(0, 24).map((it) => (
              <div key={it.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="asset-badge"
                  style={{ position: "absolute", right: 6, top: 6 }}
                  aria-label="Remove reference"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <span className="label mono">Pinterest (ссылки)</span>
        <div className="field-row" style={{ gap: 8 }}>
          <input className="input" value={pinterestDraft} onChange={(e) => setPinterestDraft(e.target.value)} placeholder="ссылка на Pin / Board" />
          <button
            type="button"
            className="gen-btn"
            onClick={() => {
              addPinterestUrl(pinterestDraft);
              setPinterestDraft("");
            }}
            disabled={busy}
          >
            Добавить
          </button>
        </div>
        {refs.pinterestUrls.length ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {refs.pinterestUrls.slice(0, 10).map((u) => (
              <div
                key={u}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  background: "rgba(8,16,20,0.35)"
                }}
              >
                <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--text)" }}>
                  {u.length > 58 ? `${u.slice(0, 58)}…` : u}
                </a>
                <div style={{ flex: 1 }} />
                <button type="button" className="asset-badge" onClick={() => removePinterestUrl(u)} title="Remove">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
            Pinterest выдачу “как в Pinterest” внутри приложения не даёт официальным API. Ссылки — чтобы держать рефы рядом; нужные картинки загружай через “Загрузить свои”.
          </div>
        )}
      </div>
    </div>
  );
}

