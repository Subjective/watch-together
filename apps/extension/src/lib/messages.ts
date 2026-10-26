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
    }
  | { type: "blocked"; blocked: boolean };

/** Background → content script. A null playback releases the video. */
export type Command =
  | { type: "state"; playback: Playback | null; offset: number }
  | { type: "status" }
  | { type: "rescan" };

/** Popup → background, through `runtime.sendMessage`. */
export type Action =
  | { kind: "create"; name: string }
  | { kind: "join"; room: string; name: string }
  | { kind: "leave" }
  | { kind: "mode"; mode: Mode }
  | { kind: "sync" };

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
  synced: { tab: number; title: string } | null;
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
