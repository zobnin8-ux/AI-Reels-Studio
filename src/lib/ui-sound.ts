const STORAGE_KEY = "ai-reels-studio-sound";

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Очень тихий «щелчок» при отправке сообщения (только если включено в настройках). */
export function playSendClick(): void {
  if (!getSoundEnabled()) return;
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});

  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.04, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}
