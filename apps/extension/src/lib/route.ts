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
}

/**
 * What the background does with a user action on a video.
 * - report: send it to the room as a playback intent.
 * - adopt: make this tab the synced tab, then report.
 * - push: apply the room's state to the tab instead (it hasn't been yet).
 * - ignore: other tabs never affect the room.
 */
export function route(report: Report): "report" | "adopt" | "push" | "ignore" {
  if (report.synced && report.matches) return report.bound ? "report" : "push";
  if (!report.playing || !report.audible || !report.foreground) return "ignore";
  if (report.host) return "adopt";
  return report.matches ? "adopt" : "ignore";
}
