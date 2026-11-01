export interface Report {
  /** You are the room's host. */
  host: boolean;
  /** The event came from your synced tab. */
  synced: boolean;
  /** The tab's video is the room's video. */
  matches: boolean;
  /** The frame has room state applied. */
  bound: boolean;
  playing: boolean;
  /** Unmuted with volume above zero. */
  audible: boolean;
  /** The active tab of the last focused window. */
  foreground: boolean;
  /** You have no synced tab with a video. */
  free: boolean;
}

/**
 * What the background does with a user action on a video.
 * - report: send it to the room as a playback intent.
 * - adopt: make this tab the synced tab, then report.
 * - offer: ask the host on this tab's overlay whether to move the room here.
 * - push: apply the room's state to the tab instead (it hasn't been yet).
 * - ignore: other tabs never affect the room.
 */
export function route(
  report: Report,
): "report" | "adopt" | "offer" | "push" | "ignore" {
  if (report.synced && report.matches) return report.bound ? "report" : "push";
  if (!report.playing || !report.audible) return "ignore";
  // A new video in the host's synced tab moves the room, even in the background
  if (report.host && report.synced) return "report";
  if (!report.foreground) return "ignore";
  if (report.host && report.free) return "adopt";
  // Other tabs only move the room when the host says so
  if (report.host) return report.matches ? "ignore" : "offer";
  return report.matches ? "adopt" : "ignore";
}
