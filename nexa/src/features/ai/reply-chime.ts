/**
 * A short two-note "ติ๊ง" when น้องวีบอท's answer pops up in the chat (owner's
 * request, 2026-11-13: a notification sound, not a voice). Made with Web Audio,
 * so there is no sound file to load. Browsers only allow sound after the person
 * has clicked or typed on the page, which asking a question already is; where
 * audio is unavailable or blocked it simply stays silent.
 */
let ctx: AudioContext | null = null;

export function playReplyChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    // Two soft sine notes, a fifth apart (E6 then B6), each fading out quickly.
    for (const [freq, at] of [
      [1318.5, 0],
      [1975.5, 0.11],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.34);
    }
  } catch {
    // No sound is fine; the answer is on screen either way.
  }
}
