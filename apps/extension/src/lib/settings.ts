import type { Mode } from "@repo/protocol";
import { browser } from "wxt/browser";

/** Preferences in `storage.local` under `settings`. */
export interface Settings {
  name: string;
  room: string;
  /** Applied only when you create a room. */
  mode: Mode;
  follow: boolean;
  join: boolean;
}

export const DEFAULTS: Settings = {
  name: "Guest",
  room: "My Room",
  mode: "host",
  follow: true,
  join: true,
};

/** A room you were in, newest first in `storage.local` under `recent`. */
export interface Recent {
  id: string;
  name: string;
  host: string;
  /** Local time you were last in it. */
  at: number;
  /** Lets a rejoin inside the grace period keep your seat. */
  resume?: string;
}

export const RECENT_MAX = 10;

export async function settings(): Promise<Settings> {
  const stored = await browser.storage.local.get("settings");
  return { ...DEFAULTS, ...(stored.settings as Partial<Settings>) };
}

export async function recent(): Promise<Recent[]> {
  const stored = await browser.storage.local.get("recent");
  return (stored.recent as Recent[] | undefined) ?? [];
}

/** Put a room at the top of the recent list. */
export function remember(list: Recent[], entry: Recent): Recent[] {
  return [entry, ...list.filter((item) => item.id !== entry.id)].slice(
    0,
    RECENT_MAX,
  );
}
