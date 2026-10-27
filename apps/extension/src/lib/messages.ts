import type { Mode, Playback, Room } from "@repo/protocol";
import type { Kind } from "./sync";

/** Content script → background, over the frame's port. */
export type FrameMessage =
  | { type: "video"; area: number }
  | {
      type: "event";
      kind: Kind | "status";
      playing: boolean;
      position: number;
      rate: number;
      audible: boolean;
      bound: boolean;
      duration: number | null;
    }
  | { type: "blocked"; blocked: boolean };

/** Background → content script. A null playback releases the video. */
export type Command =
  | { type: "state"; playback: Playback | null; offset: number }
  | { type: "status" }
  | { type: "rescan" };

/** Popup → background, through `runtime.sendMessage`. */
export type Action =
  | { kind: "create" }
  | { kind: "join"; room: string; resume?: string }
  | { kind: "leave" }
  | { kind: "mode"; mode: Mode }
  | { kind: "rename"; target: "room" | "self"; name: string }
  | { kind: "sync" }
  /** Go to the host's video in the synced tab, or a new one. */
  | { kind: "follow" };

export interface Reply {
  ok: boolean;
  error?: string;
}

export type Status = "idle" | "connecting" | "connected" | "reconnecting";

/** Everything the popup renders, kept in `storage.session` under `view`. */
export interface View {
  status: Status;
  room: Room | null;
  you: string | null;
  /** Server time minus local time. */
  offset: number;
  /** `matches` is whether the tab shows the room's video. */
  synced: { tab: number; title: string; matches: boolean } | null;
  blocked: boolean;
  error: string | null;
}

export const IDLE: View = {
  status: "idle",
  room: null,
  you: null,
  offset: 0,
  synced: null,
  blocked: false,
  error: null,
};
