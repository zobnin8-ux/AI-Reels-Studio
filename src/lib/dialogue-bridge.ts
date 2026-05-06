/** Односторонний мост: OutputPanel и др. могут попросить центральную панель отправить ход диалога. */

let pending: string | null = null;
let flush: (() => void) | null = null;

export function subscribeDialogueFlush(cb: () => void): () => void {
  flush = cb;
  return () => {
    flush = null;
  };
}

export function requestDialogueTurn(text: string): void {
  const t = text.trim();
  if (!t) return;
  pending = t;
  flush?.();
}

export function takePendingDialogueTurn(): string | null {
  const p = pending;
  pending = null;
  return p;
}
