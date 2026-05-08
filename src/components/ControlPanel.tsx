"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import type { ProjectId, StudioState } from "@/lib/state";
import { parseSessionImport, SESSION_EXPORT_VERSION } from "@/lib/session-import";

const projectOptions: { id: ProjectId; label: string }[] = [
  { id: "poslenego", label: "После него" },
  { id: "zobnin", label: "Zobnin AI" },
  { id: "olgatrip", label: "OlgaTrip" }
];

const emptyMusic = () => ({ queries: [] as string[], recommendations: [] as string[], avoid: [] as string[] });
const BG_MODE_KEY = "ai-reels-studio:v2026:bgMode";

type SessionImportNotice = { kind: "ok" | "error"; message: string };

function defaultsForProject(project: ProjectId): Partial<StudioState> {
  const base: Partial<StudioState> = {
    contentType: "reels",
    slideCount: 7
  };
  if (project === "olgatrip") {
    return {
      ...base,
      ctaMode: "direct",
      website: "olgatrip.com",
      triggerWord: "море",
      customCta: ""
    };
  }
  if (project === "poslenego") {
    return {
      ...base,
      ctaMode: "website",
      website: "poslenego.com",
      triggerWord: "",
      customCta: ""
    };
  }
  return {
    ...base,
    ctaMode: "website",
    website: "zobnin.ai",
    triggerWord: "",
    customCta: ""
  };
}

export function ControlPanel() {
  const { state, dispatch } = useStudio();
  const prevProject = useRef<ProjectId>(state.project);
  /** true = класс `showcase` на body (сетка, шум, скан); false = спокойный фон для записи экрана */
  const [richStudioBackground, setRichStudioBackground] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(BG_MODE_KEY) === "rich";
    } catch {
      return false;
    }
  });
  const importRef = useRef<HTMLInputElement>(null);
  const uploadRefsRef = useRef<HTMLInputElement>(null);
  const [importNotice, setImportNotice] = useState<SessionImportNotice | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [refNotice, setRefNotice] = useState<string | null>(null);
  const [refResults, setRefResults] = useState<
    Array<{ id: string; kind: "unsplash"; thumb: string; full: string; author?: string; sourceUrl?: string }>
  >([]);
  const [pinterestDraft, setPinterestDraft] = useState("");

  useEffect(() => {
    document.body.classList.toggle("showcase", richStudioBackground);
  }, [richStudioBackground]);

  useEffect(() => {
    if (!importNotice) return;
    const ms = importNotice.kind === "error" ? 12_000 : 7000;
    const t = window.setTimeout(() => setImportNotice(null), ms);
    return () => window.clearTimeout(t);
  }, [importNotice]);

  useEffect(() => {
    if (!refNotice) return;
    const t = window.setTimeout(() => setRefNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [refNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BG_MODE_KEY, richStudioBackground ? "rich" : "calm");
    } catch {
      // ignore
    }
  }, [richStudioBackground]);

  const hasCreativeContent = useMemo(() => {
    return (
      state.messages.length > 0 ||
      state.slides.length > 0 ||
      state.angles.length > 0 ||
      state.imagePrompts.some((p) => p.prompt.trim().length > 0 || (p.manualOverride?.trim() ?? "").length > 0) ||
      state.caption.trim().length > 0 ||
      state.music.queries.length > 0 ||
      state.music.recommendations.length > 0 ||
      state.images.length > 0
    );
  }, [
    state.messages.length,
    state.slides.length,
    state.angles.length,
    state.imagePrompts,
    state.caption,
    state.music,
    state.images.length
  ]);

  function resetContentAfterProjectSwitch(nextProject: ProjectId) {
    dispatch({
      type: "set",
      patch: {
        project: nextProject,
        messages: [],
        topic: "",
        selectedAngleId: null,
        angles: [],
        slides: [],
        approved: false,
        imagePrompts: [],
        images: [],
        caption: "",
        music: emptyMusic(),
        references: { query: "", items: [] },
        ...defaultsForProject(nextProject)
      }
    });
  }

  async function searchReferences() {
    const q = (state.references?.query ?? "").trim();
    if (q.length < 2) {
      setRefNotice("Запрос слишком короткий (минимум 2 символа).");
      return;
    }
    setRefBusy(true);
    try {
      const source = state.references?.source ?? "unsplash";
      const endpoint = source === "pexels" ? "/api/references/pexels" : "/api/references/unsplash";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Search failed (${res.status})`);
      }
      const j = (await res.json()) as { items?: typeof refResults };
      setRefResults(j.items ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search failed";
      setRefNotice(msg);
    } finally {
      setRefBusy(false);
    }
  }

  function addPinterestUrl(raw: string) {
    const u = raw.trim();
    if (!u) return;
    // minimal normalization
    const url = u.startsWith("http") ? u : `https://${u}`;
    const cur = state.references?.pinterestUrls ?? [];
    if (cur.includes(url)) return;
    const next = [url, ...cur].slice(0, 24);
    dispatch({
      type: "set",
      patch: {
        references: { ...(state.references ?? { query: "", source: "unsplash", items: [], pinterestUrls: [] }), pinterestUrls: next }
      }
    });
  }

  function removePinterestUrl(url: string) {
    const cur = state.references?.pinterestUrls ?? [];
    const next = cur.filter((x) => x !== url);
    dispatch({
      type: "set",
      patch: {
        references: { ...(state.references ?? { query: "", source: "unsplash", items: [], pinterestUrls: [] }), pinterestUrls: next }
      }
    });
  }

  function addReference(item: (typeof refResults)[number]) {
    const cur = state.references?.items ?? [];
    if (cur.some((x) => x.id === item.id && x.kind === "unsplash")) return;
    const next = [
      { id: item.id, kind: "unsplash" as const, thumb: item.thumb, full: item.full, author: item.author, sourceUrl: item.sourceUrl },
      ...cur
    ].slice(0, 24);
    dispatch({ type: "set", patch: { references: { ...(state.references ?? { query: "", items: [] }), items: next } } });
  }

  function removeReference(id: string) {
    const cur = state.references?.items ?? [];
    const next = cur.filter((x) => x.id !== id);
    dispatch({ type: "set", patch: { references: { ...(state.references ?? { query: "", items: [] }), items: next } } });
  }

  async function onUploadRefs(files: FileList | null) {
    if (!files || files.length === 0) return;
    const maxBytes = 3_000_000;
    const cur = state.references?.items ?? [];
    const uploads: typeof cur = [];

    const readOne = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("File read error"));
        r.onload = () => resolve(String(r.result ?? ""));
        r.readAsDataURL(f);
      });

    setRefBusy(true);
    try {
      for (const f of Array.from(files).slice(0, 12)) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > maxBytes) {
          setRefNotice(`Файл слишком большой: ${f.name} (лимит 3MB)`);
          continue;
        }
        const dataUrl = await readOne(f);
        const id = `upload_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
        uploads.push({ id, kind: "upload", thumb: dataUrl, full: dataUrl });
      }
      const next = [...uploads, ...cur].slice(0, 24);
      dispatch({ type: "set", patch: { references: { ...(state.references ?? { query: "", items: [] }), items: next } } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setRefNotice(msg);
    } finally {
      setRefBusy(false);
      if (uploadRefsRef.current) uploadRefsRef.current.value = "";
    }
  }

  function onProjectChange(nextProject: ProjectId) {
    if (nextProject === state.project) return;
    if (hasCreativeContent) {
      const ok = window.confirm("Смена проекта сбросит текущий сценарий, диалог и вывод.");
      if (!ok) {
        dispatch({ type: "set", patch: { project: prevProject.current } });
        return;
      }
    }
    prevProject.current = nextProject;
    resetContentAfterProjectSwitch(nextProject);
  }

  function exportSessionJson() {
    try {
      const envelope = {
        v: SESSION_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        state
      };
      const payload = JSON.stringify(envelope, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-reels-studio-session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const res = parseSessionImport(parsed);
      if (!res.ok) {
        setImportNotice({ kind: "error", message: `Импорт отклонён: ${res.error}` });
        return;
      }
      dispatch({ type: "replace", state: res.state, resetSessionUndo: true });
      setImportNotice({ kind: "ok", message: "Сессия загружена из файла." });
    } catch {
      setImportNotice({
        kind: "error",
        message: "Не удалось прочитать файл."
      });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <>
      <div className="panel-strip">
        <div className="strip-row">
          <span className="strip-tag">Параметры</span>
        </div>
        <h2 className="strip-title">
          Сессия <b>контур</b>
        </h2>
      </div>

      <div className="panel-body min-h-0">
        {importNotice ? (
          <div
            role="status"
            aria-live="polite"
            className={[
              "session-import-notice",
              importNotice.kind === "ok" ? "session-import-notice--ok" : "session-import-notice--err"
            ].join(" ")}
          >
            <span>{importNotice.message}</span>
            <button
              type="button"
              className="session-import-notice-dismiss"
              onClick={() => setImportNotice(null)}
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="group">
          <div className="group-title">Проект</div>
          <div className="field">
            <span className="label mono">Профиль</span>
            <select
              className="select"
              value={state.project}
              onChange={(e) => onProjectChange(e.target.value as ProjectId)}
            >
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Формат и длина</div>
          <div className="field-row">
            <div className="field">
              <span className="label">Тип</span>
              <select
                className="select"
                value={state.contentType}
                onChange={(e) =>
                  dispatch({ type: "set", patch: { contentType: e.target.value as StudioState["contentType"] } })
                }
              >
                <option value="reels">Ролики · 9:16 · 1080×1920</option>
                <option value="post">Пост · 4:5 (1080×1350)</option>
              </select>
            </div>
            <div className="field">
              <span className="label">Кадров</span>
              <select
                className="select"
                value={state.slideCount}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    patch: { slideCount: Number(e.target.value) as StudioState["slideCount"] }
                  })
                }
              >
                {[5, 7, 9].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="group">
          <div className="group-title">CTA</div>
          <div className="field">
            <span className="label">Режим</span>
            <select
              className="select"
              value={state.ctaMode === "custom" ? "none" : state.ctaMode}
              onChange={(e) =>
                dispatch({ type: "set", patch: { ctaMode: e.target.value as StudioState["ctaMode"] } })
              }
            >
              <option value="website">Сайт</option>
              <option value="direct">Триггер-слово</option>
              <option value="none">Без CTA</option>
            </select>
          </div>
          {state.ctaMode === "website" ? (
            <div className="conditional">
              <div className="field">
                <span className="label mono">Сайт</span>
                <input
                  className="input"
                  value={state.website}
                  onChange={(e) => dispatch({ type: "set", patch: { website: e.target.value } })}
                  placeholder="poslenego.com"
                />
              </div>
            </div>
          ) : null}
          {state.ctaMode === "direct" ? (
            <div className="conditional">
              <div className="field">
                <span className="label mono">Триггер</span>
                <input
                  className="input"
                  value={state.triggerWord}
                  onChange={(e) => dispatch({ type: "set", patch: { triggerWord: e.target.value } })}
                  placeholder="Триггер-слово"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="group">
          <div className="group-title">Тема</div>
          <div className="field">
            <span className="label mono">Тема</span>
            <input
              className="input"
              value={state.topic}
              onChange={(e) => dispatch({ type: "set", patch: { topic: e.target.value } })}
              placeholder="Тема / что обсуждаем?"
            />
          </div>
        </div>

        <div className="group">
          <div className="group-title">Референсы</div>
          {refNotice ? (
            <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 8, whiteSpace: "pre-wrap" }}>{refNotice}</div>
          ) : null}
          <div className="field">
            <span className="label mono">Поиск (Unsplash)</span>
            <div className="field-row" style={{ gap: 8 }}>
              <select
                className="select"
                value={state.references?.source ?? "unsplash"}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    patch: {
                      references: { ...(state.references ?? { query: "", source: "unsplash", items: [], pinterestUrls: [] }), source: e.target.value as "unsplash" | "pexels" }
                    }
                  })
                }
                style={{ maxWidth: 140 }}
                aria-label="Источник поиска референсов"
              >
                <option value="unsplash">Unsplash</option>
                <option value="pexels">Pexels</option>
              </select>
              <input
                className="input"
                value={state.references?.query ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    patch: {
                      references: {
                        ...(state.references ?? { query: "", source: "unsplash", items: [], pinterestUrls: [] }),
                        query: e.target.value
                      }
                    }
                  })
                }
                placeholder="например: italy street, women walking, cafe sunlight"
              />
              <button type="button" className="gen-btn" onClick={() => void searchReferences()} disabled={refBusy}>
                {refBusy ? "…" : "Искать"}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
              Если результатов нет: проверь ключи в <span className="mono">.env.local</span> (UNSPLASH_ACCESS_KEY / PEXELS_API_KEY) и перезапусти сервер.
            </div>
          </div>
          <div className="field">
            <span className="label mono">Загрузить свои</span>
            <div className="field-row" style={{ gap: 8 }}>
              <button type="button" className="gen-btn" onClick={() => uploadRefsRef.current?.click()} disabled={refBusy}>
                Загрузить
              </button>
              <input
                ref={uploadRefsRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => void onUploadRefs(e.target.files)}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>до 12 файлов, 3MB каждый</span>
            </div>
          </div>

          {refResults.length > 0 ? (
            <div className="field">
              <span className="label mono">Результаты</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {refResults.slice(0, 18).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="studio-btn-ghost"
                    onClick={() => addReference(it)}
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

          {state.references?.items?.length ? (
            <div className="field">
              <span className="label mono">Выбрано</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {state.references.items.slice(0, 24).map((it) => (
                  <div key={it.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.thumb} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                    <button
                      type="button"
                      onClick={() => removeReference(it.id)}
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
              <input
                className="input"
                value={pinterestDraft}
                onChange={(e) => setPinterestDraft(e.target.value)}
                placeholder="вставь ссылку на Pin / Board"
              />
              <button
                type="button"
                className="gen-btn"
                onClick={() => {
                  addPinterestUrl(pinterestDraft);
                  setPinterestDraft("");
                }}
                disabled={refBusy}
              >
                Добавить
              </button>
            </div>
            {state.references?.pinterestUrls?.length ? (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {state.references.pinterestUrls.slice(0, 12).map((u) => (
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
                      {u.length > 62 ? `${u.slice(0, 62)}…` : u}
                    </a>
                    <div style={{ flex: 1 }} />
                    <button type="button" className="asset-badge" onClick={() => removePinterestUrl(u)} title="Remove">
                      ×
                    </button>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Примечание: Pinterest выдачу “как в Pinterest” внутри приложения не даёт официальным API. Ссылки — чтобы держать рефы рядом; нужные картинки загружай через “Загрузить свои”.
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                Вставь ссылку — она сохранится в сессии и будет всегда под рукой.
              </div>
            )}
          </div>
        </div>

        <div className="group">
          <div className="group-title">Фон студии</div>
          <div className="field">
            <span className="label mono">Режим оформления</span>
            <div className="mode-pill" role="group" aria-label="Режим оформления фона">
              <button
                type="button"
                className={!richStudioBackground ? "active" : ""}
                onClick={() => setRichStudioBackground(false)}
              >
                Спокойный
              </button>
              <button
                type="button"
                className={richStudioBackground ? "active" : ""}
                onClick={() => setRichStudioBackground(true)}
              >
                Насыщенный
              </button>
            </div>
          </div>
        </div>

        <div className="group">
          <div className="group-title">Провайдер</div>
          <div className="seg" role="group" aria-label="Провайдер LLM">
            <button
              type="button"
              className={state.provider === "openai" ? "active" : ""}
              onClick={() => dispatch({ type: "set", patch: { provider: "openai" } })}
            >
              OpenAI
            </button>
            <button
              type="button"
              className={state.provider === "anthropic" ? "active" : ""}
              onClick={() => dispatch({ type: "set", patch: { provider: "anthropic" } })}
            >
              Anthropic
            </button>
          </div>
        </div>

        <details className="group session-file-details">
          <summary className="group-title session-file-summary">Файл сессии</summary>
          <div className="field-row session-file-fields">
            <div className="field">
              <button type="button" className="gen-btn w-full" onClick={() => exportSessionJson()}>
                Сохранить файл
              </button>
            </div>
            <div className="field">
              <button type="button" className="gen-btn w-full" onClick={() => importRef.current?.click()}>
                Загрузить файл
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="field session-file-reset">
            <button
              type="button"
              className="studio-btn-ghost w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text hover:bg-black/30"
              onClick={() => {
                const ok = window.confirm("Сбросить всю сессию? Это очистит диалог, сценарий и ассеты.");
                if (ok) dispatch({ type: "resetAll" });
              }}
            >
              Сбросить всё
            </button>
          </div>
        </details>
      </div>
    </>
  );
}
