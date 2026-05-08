"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudio } from "@/lib/studio-store";
import type { ReferenceImage } from "@/lib/state";

type RefResult = { id: string; kind: "unsplash"; thumb: string; full: string; author?: string; sourceUrl?: string };

type PreviewState =
  | { kind: "result"; item: RefResult }
  | { kind: "selected"; item: ReferenceImage };

export function ReferencesPanel() {
  const { state, dispatch } = useStudio();
  const uploadRefsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<RefResult[]>([]);
  /** Какие ключевые слова реально ушли в Unsplash/Pexels (после перевода с русского). */
  const [lastCatalogQuery, setLastCatalogQuery] = useState<string | null>(null);
  const [pinterestDraft, setPinterestDraft] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const refs = state.references;

  const selectedCount = refs.items.length + refs.pinterestUrls.length;

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

  useEffect(() => {
    const r = state.references;
    if (r.items.length > 0 || !r.applyOnGenerate) return;
    dispatch({ type: "set", patch: { references: { ...r, applyOnGenerate: false } } });
  }, [state.references.items.length, state.references.applyOnGenerate, dispatch, state.references]);

  async function search() {
    const q = refs.query.trim();
    if (q.length < 2) {
      setNotice("Запрос слишком короткий (минимум 2 символа).");
      return;
    }
    setBusy(true);
    setNotice(null);
    setLastCatalogQuery(null);
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
      const j = (await res.json()) as { items?: RefResult[]; queryUsed?: string };
      setLastCatalogQuery(typeof j.queryUsed === "string" && j.queryUsed.trim() ? j.queryUsed.trim() : null);
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
    <div className="asset-block references-panel references-panel-root">
      <div className="references-panel-top">
        <div className="asset-head references-panel-head">
          <div className="asset-h">Референсы</div>
          <span className="asset-badge">{selectedCount ? `${selectedCount} в подборке` : "подборка пуста"}</span>
        </div>
      </div>

      <div className="references-panel-scroll">
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
          <p className="references-search-hint">
            Можно писать по-русски: перед запросом к фотобанку фраза превращается в короткие английские ключевые слова
            (нужен <span className="mono">OPENAI_API_KEY</span> на сервере).
          </p>
          {lastCatalogQuery ? (
            <p className="references-catalog-query" title="То, что ушло в Unsplash/Pexels">
              Запрос в каталоге: <span className="mono">{lastCatalogQuery}</span>
            </p>
          ) : null}
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
      </div>

      <div className="references-panel-footer">
        <div className="references-actions-block">
          <div className="references-step-title">При генерации кадров</div>
          <label className="references-apply-label">
            <input
              type="checkbox"
              className="references-apply-checkbox"
              checked={refs.applyOnGenerate}
              disabled={refs.items.length === 0}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  patch: { references: { ...refs, applyOnGenerate: e.target.checked } }
                })
              }
            />
            <span>Учитывать выбранные фото при генерации</span>
          </label>
          <p className="references-step-desc">
            Если включено, при нажатии <strong>«Сгенерировать все картинки»</strong> в панели <strong>«Вывод»</strong>{" "}
            справа (и при «Перегенерировать кадр») в OpenAI уйдут и эти изображения. Если выключено — только текстовый
            промпт. Нужны выбранные миниатюры в блоке «Выбрано» (ссылки Pinterest сами по себе в генерацию не попадают).
            Текст промптов меняется в чате или кнопками у слайдов справа — не здесь.
          </p>
        </div>
      </div>

      {previewModal}
    </div>
  );
}
