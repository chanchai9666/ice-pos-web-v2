/**
 * Synthesizes a short beep sound using the Web Audio API.
 * Useful for scanner/POS interactions without external audio assets.
 */
export function playBeepSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, ctx.currentTime); // 1800 Hz clear POS beep
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);

    // Clean up audio context
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 200);
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

/**
 * Synthesizes a low buzz/error tone for unrecognized barcodes or failed scans.
 */
export function playErrorSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 300);
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

/**
 * Triggers hardware haptic vibration feedback on supported mobile devices.
 */
export function triggerHapticFeedback(pattern: number | number[] = 80) {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !navigator.vibrate
  ) {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore vibration failure if not supported or blocked
  }
}
