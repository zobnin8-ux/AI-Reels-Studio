"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudio } from "@/lib/studio-store";
import { requestDialogueTurn } from "@/lib/dialogue-bridge";
import { generateImagesFromState } from "@/lib/actions";
import type { ReferenceImage } from "@/lib/state";

type RefResult = { id: string; kind: "unsplash"; thumb: string; full: string; author?: string; sourceUrl?: string };

type PreviewState =
  | { kind: "result"; item: RefResult }
  | { kind: "selected"; item: ReferenceImage };

export function ReferencesPanel() {
  const { state, dispatch } = useStudio();
  const uploadRefsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<RefResult[]>([]);
  const [pinterestDraft, setPinterestDraft] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const refs = state.references;

  const selectedCount = refs.items.length + refs.pinterestUrls.length;
  const canPromptFromRefs = selectedCount > 0;
  const canGenerateWithRefs = refs.items.length > 0 && state.slides.length > 0 && !genBusy;

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

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [preview]);

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
        setNotice("Ничего не найдено. Если включён поиск — проверьте ключи API и перезапуск сервера.");
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

  async function onGenerateWithRefs() {
    if (!refs.items.length || state.slides.length === 0) return;
    setNotice(null);
    setGenBusy(true);
    try {
      const images = await generateImagesFromState(state, {
        useReferences: true,
        onProgress: ({ images: next }) => {
          dispatch({ type: "set", patch: { images: next } });
        }
      });
      dispatch({ type: "set", patch: { images } });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Ошибка генерации изображений";
      setNotice(m);
    } finally {
      setGenBusy(false);
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
    setNotice("Запрос ушёл в чат: модель обновит текстовые промпты. Картинки пока не создаются — нажмите «Сгенерировать все картинки» ниже.");
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
    setNotice("Запрос ушёл в чат для одного слайда. Картинки не создаются — используйте кнопку генерации ниже.");
  }

  const gridCols = "repeat(3, 1fr)";

  const previewModal =
    preview && typeof document !== "undefined"
      ? createPortal(
          <div className="ref-preview-root" role="presentation">
            <button
              type="button"
              className="ref-preview-backdrop"
              aria-label="Закрыть просмотр"
              onClick={() => setPreview(null)}
            />
            <div className="ref-preview-dialog" role="dialog" aria-modal="true" aria-label="Просмотр референса">
              <div className="ref-preview-toolbar">
                <button type="button" className="asset-badge" onClick={() => setPreview(null)}>
                  Закрыть
                </button>
                {preview.kind === "result" ? (
                  <button
                    type="button"
                    className="gen-btn"
                    onClick={() => {
                      addResult(preview.item);
                      setPreview(null);
                    }}
                  >
                    Добавить к выбранным
                  </button>
                ) : (
                  <button
                    type="button"
                    className="studio-btn-ghost rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
                    onClick={() => {
                      removeItem(preview.item.id);
                      setPreview(null);
                    }}
                  >
                    Убрать из выбранных
                  </button>
                )}
              </div>
              <div className="ref-preview-img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.item.full} alt="" className="ref-preview-img" />
              </div>
              {preview.kind === "result" && preview.item.author ? (
                <div className="ref-preview-caption">{preview.item.author}</div>
              ) : null}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="asset-block references-panel">
      <div className="asset-head references-panel-head">
        <div className="asset-h">Референсы</div>
        <span className="asset-badge">{selectedCount ? `${selectedCount} в подборке` : "подборка пуста"}</span>
      </div>

      {notice ? (
        <div className="references-notice" role="status">
          {notice}
        </div>
      ) : null}

      <div className="field">
        <span className="label">Поиск фото</span>
        <div className="field-row references-search-row">
          <select
            className="select"
            value={refs.source}
            onChange={(e) =>
              dispatch({
                type: "set",
                patch: { references: { ...refs, source: e.target.value as "unsplash" | "pexels" } }
              })
            }
            aria-label="Источник"
          >
            <option value="unsplash">Unsplash</option>
            <option value="pexels">Pexels</option>
          </select>
          <input
            className="input references-search-input"
            value={refs.query}
            onChange={(e) => dispatch({ type: "set", patch: { references: { ...refs, query: e.target.value } } })}
            placeholder=""
            aria-label="Запрос для поиска"
          />
          <button type="button" className="gen-btn references-search-btn" onClick={() => void search()} disabled={busy}>
            {busy ? "…" : "Найти"}
          </button>
        </div>
      </div>

      {results.length ? (
        <div className="field">
          <span className="label">Найдено — нажмите для просмотра</span>
          <div className="references-thumb-grid" style={{ gridTemplateColumns: gridCols }}>
            {results.slice(0, 18).map((it) => (
              <button
                key={it.id}
                type="button"
                className="references-thumb-btn"
                onClick={() => setPreview({ kind: "result", item: it })}
                aria-label="Открыть превью"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" className="references-thumb-img" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <span className="label">Свои файлы</span>
        <div className="field-row" style={{ gap: 8, flexWrap: "wrap" }}>
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
          <span className="references-hint-inline">до 12 файлов, до 3 МБ</span>
        </div>
      </div>

      {refs.items.length ? (
        <div className="field">
          <span className="label">Выбрано — нажмите для просмотра</span>
          <div className="references-thumb-grid" style={{ gridTemplateColumns: gridCols }}>
            {refs.items.slice(0, 24).map((it) => (
              <button
                key={it.id}
                type="button"
                className="references-thumb-btn"
                onClick={() => setPreview({ kind: "selected", item: it })}
                aria-label="Открыть превью"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" className="references-thumb-img" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <span className="label">Pinterest (ссылки)</span>
        <div className="field-row" style={{ gap: 8 }}>
          <input
            className="input"
            value={pinterestDraft}
            onChange={(e) => setPinterestDraft(e.target.value)}
            placeholder=""
            aria-label="Ссылка Pinterest"
          />
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
          <div className="references-pinterest-list">
            {refs.pinterestUrls.slice(0, 10).map((u) => (
              <div key={u} className="references-pinterest-row">
                <a href={u} target="_blank" rel="noreferrer" className="references-pinterest-link">
                  {u.length > 48 ? `${u.slice(0, 48)}…` : u}
                </a>
                <button type="button" className="asset-badge" onClick={() => removePinterestUrl(u)} aria-label="Удалить">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="references-actions-block">
        <div className="references-step-title">Шаг 1 — только чат</div>
        <p className="references-step-desc">
          Кнопки ниже отправляют запрос модели в диалог: она перепишет английские промпты кадров под ваши референсы.{" "}
          <strong>Картинки при этом не создаются.</strong>
        </p>
        <button
          type="button"
          className="references-btn-secondary w-full"
          disabled={!canPromptFromRefs}
          onClick={() => askUseRefsForImagePrompts()}
        >
          Обновить промпты — все слайды
        </button>
        <button
          type="button"
          className="references-btn-secondary w-full"
          disabled={!canPromptFromRefs}
          onClick={() => askUseRefsForOneSlide()}
        >
          Обновить промпт — один слайд…
        </button>

        <div className="references-step-title references-step-title--spaced">Шаг 2 — генерация</div>
        <p className="references-step-desc">
          Отправляет выбранные изображения в OpenAI вместе с промптами и строит все кадры. Делайте это после того, как
          промпты вас устроят.
        </p>
        <button
          type="button"
          className="gen-btn references-btn-primary w-full"
          disabled={!canGenerateWithRefs}
          onClick={() => void onGenerateWithRefs()}
        >
          {genBusy ? "Генерация…" : "Сгенерировать все картинки"}
        </button>
      </div>

      {previewModal}
    </div>
  );
}
