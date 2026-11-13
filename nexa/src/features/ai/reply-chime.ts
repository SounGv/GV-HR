/**
 * A short two-note "ติ๊ง" when น้องวีบอท's answer pops up in the chat (owner's
 * request, 2026-11-13: a notification sound, not a voice). Made with Web Audio,
 * so there is no sound file to load.
 *
 * Browsers (Safari/iPhone and the LINE in-app browser most strictly) only let a
 * page start audio inside a click or key press. The answer arrives seconds later,
 * outside that gesture, so the first version stayed silent there. Now the send
 * action calls `unlockReplyChime()` while the gesture is still live, which
 * creates and resumes the audio context; the later `playReplyChime()` reuses it.
 * Where audio is unavailable or blocked it simply stays silent.
 */
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Call from the send button / Enter key handler, before any await. */
export function unlockReplyChime(): void {
  try {
    // Only inside a real click/key press; an auto-asked question (useEffect)
    // would just create a locked context and a console warning.
    const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    if (activation && !activation.isActive) return;
    const c = audioContext();
    if (!c) return;
    if (c.state !== "running") c.resume().catch(() => {});
    // A one-sample silent buffer: iOS only counts the context as unlocked once
    // something has actually been started inside the gesture.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // No sound is fine.
  }
}

export function playReplyChime(): void {
  try {
    const c = audioContext();
    if (!c) return;
    const play = () => {
      const now = c.currentTime + 0.02;
      // Two sine notes, a fifth apart (E6 then B6), each fading out quickly.
      for (const [freq, at] of [
        [1318.5, 0],
        [1975.5, 0.11],
      ] as const) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35);
        osc.connect(gain).connect(c.destination);
        osc.start(now + at);
        osc.stop(now + at + 0.37);
      }
    };
    if (c.state === "running") {
      play();
      return;
    }
    // Still locked: try once, but give up after a moment. Otherwise resume()
    // stays pending until some later tap and the chime would sound then, for
    // no visible reason.
    let gaveUp = false;
    const timer = setTimeout(() => (gaveUp = true), 800);
    c.resume().then(
      () => {
        clearTimeout(timer);
        if (!gaveUp) play();
      },
      () => clearTimeout(timer),
    );
  } catch {
    // No sound is fine; the answer is on screen either way.
  }
}
