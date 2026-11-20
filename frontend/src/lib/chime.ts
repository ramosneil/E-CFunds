// Notification sound: a short, soft two-note chime made with the Web Audio API (no audio file to download).
// Quiet by design, never more than once every 3 s, and muted per device from the bell menu.
const KEY = 'ecfunds:mute';
let ctx: AudioContext | null = null;
let last = 0;

export const isMuted = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setMuted = (m: boolean) => { try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private mode */ } };

export function chime() {
  if (isMuted() || Date.now() - last < 3000) return;
  last = Date.now();
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();   // browsers allow sound only after the user has tapped once
    const t = ctx.currentTime;
    // Two bell-like notes (E6 → A6), each a sine with a fast attack and a gentle decay.
    [[1318.5, 0], [1760, 0.12]].forEach(([freq, at]) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(0.12, t + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.45);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t + at);
      osc.stop(t + at + 0.5);
    });
  } catch { /* sound is a nice-to-have */ }
}
