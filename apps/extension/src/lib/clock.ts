/** How many recent offset samples to keep. */
const WINDOW = 10;

/**
 * Add a server clock sample. `offset = serverNow - Date.now()` is always
 * low by the message's latency, so the largest recent sample is the best.
 */
export function sample(samples: number[], offset: number): number[] {
  return [...samples, offset].slice(-WINDOW);
}

export function offset(samples: number[]): number {
  return samples.length === 0 ? 0 : Math.max(...samples);
}

/** Seconds as a clock reading: 4:05 or 1:02:09. */
export function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  if (hours === 0) return `${minutes}:${rest}`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
}
