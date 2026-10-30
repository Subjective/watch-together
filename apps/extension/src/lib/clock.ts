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
