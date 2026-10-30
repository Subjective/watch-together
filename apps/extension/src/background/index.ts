import { browser, type Browser } from "wxt/browser";
import { ROOM_ID, type ClientMessage, type Room } from "@repo/protocol";
import { offset, sample } from "../lib/clock";
import { key } from "../lib/key";
import { route } from "../lib/route";
import {
  IDLE,
  type Action,
  type Command,
  type FrameMessage,
  type Reply,
  type View,
} from "../lib/messages";
import { Link } from "./link";

export const BACKEND =
  import.meta.env.WXT_BACKEND_URL ??
  "wss://watch-together-backend.joshjyin.workers.dev";

/** What survives a service worker restart, in `storage.session`. */
interface Session {
  room: string;
  name: string;
  resume?: string;
  you?: string;
  /** The synced tab: the only tab playback commands ever touch. */
  tab?: number;
  /** Report the synced tab's video once welcomed (we created the room). */
  announce?: boolean;
}

interface Frame {
  port: Browser.runtime.Port;
  tab: number;
  frame: number;
  area: number;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function code(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/**
 * The background owns the socket, the session and the synced tab, and turns
 * user actions on videos into playback intents. Listeners are registered
 * synchronously so a restarted worker receives the events that woke it.
 */
export function start() {
  const frames = new Map<string, Frame>();
  const state = {
    session: null as Session | null,
    link: null as Link | null,
    room: null as Room | null,
    samples: [] as number[],
    view: IDLE,
  };

  const ready = browser.storage.session.get("session").then((stored) => {
    state.session = (stored.session as Session | undefined) ?? null;
    if (state.session) connect();
  });

  function save() {
    return browser.storage.session.set({ session: state.session });
  }

  async function render(patch: Partial<View> = {}) {
    const tab = state.session?.tab;
    const info =
      tab === undefined ? null : await browser.tabs.get(tab).catch(() => null);
    state.view = {
      ...state.view,
      ...patch,
      room: state.room,
      you: state.session?.you ?? null,
      offset: offset(state.samples),
      synced: info?.id ? { tab: info.id, title: info.title ?? "" } : null,
    };
    await browser.storage.session.set({ view: state.view });
  }

  function send(frame: Frame, command: Command) {
    frame.port.postMessage(command);
  }

  /** The frame with the largest visible video in a tab. */
  function player(tab: number): Frame | null {
    const candidates = [...frames.values()].filter(
      (frame) => frame.tab === tab && frame.area > 0,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, frame) =>
      frame.area > best.area ? frame : best,
    );
  }

  /** Apply the room to a tab's player, and release every other frame. */
  async function push(tab: number | undefined) {
    if (tab === undefined) return;
    const info = await browser.tabs.get(tab).catch(() => null);
    const room = state.room;
    const live =
      room !== null &&
      tab === state.session?.tab &&
      key(info?.url) !== null &&
      key(info?.url) === key(room.playback.url);
    const target = live ? player(tab) : null;
    for (const frame of frames.values()) {
      if (frame.tab !== tab) continue;
      send(frame, {
        type: "state",
        playback: frame === target ? room!.playback : null,
        offset: offset(state.samples),
      });
    }
  }

  function connect() {
    const session = state.session!;
    state.link?.close();
    const link = new Link(`${BACKEND}/rooms/${session.room}`, {
      open: () =>
        link.send({ type: "join", name: session.name, resume: session.resume }),
      message: (message) => {
        if (message.type === "error") {
          if (message.code === "forbidden") push(state.session?.tab);
          render({ error: message.message });
          return;
        }
        if (state.room && message.room.seq < state.room.seq) return;
        state.samples = sample(state.samples, message.now - Date.now());
        state.room = message.room;
        if (message.type === "welcome") {
          link.settled();
          session.resume = message.resume;
          session.you = message.you;
          save();
          announce();
        }
        push(session.tab);
        render({ status: "connected", error: null });
      },
      lost: () => render({ status: "reconnecting" }),
    });
    state.link = link;
    link.open();
    render({ status: "connecting", error: null });
  }

  /** After creating a room, ask the synced tab's video for its state. */
  function announce() {
    const session = state.session!;
    if (!session.announce || session.tab === undefined) return;
    session.announce = false;
    save();
    const frame = player(session.tab);
    if (frame) send(frame, { type: "status" });
  }

  /** The active tab of the last focused normal window. */
  async function foreground(): Promise<Browser.tabs.Tab | null> {
    const window = await browser.windows
      .getLastFocused({ windowTypes: ["normal"] })
      .catch(() => null);
    if (!window?.id) return null;
    const tabs = await browser.tabs.query({
      active: true,
      windowId: window.id,
    });
    return tabs[0] ?? null;
  }

  /** Make a tab the synced tab, releasing the previous one. */
  async function adopt(tab: number | undefined) {
    const session = state.session!;
    const previous = session.tab;
    session.tab = tab;
    await save();
    if (previous !== tab) push(previous);
    push(tab);
    render();
  }

  async function report(
    frame: Frame,
    message: Extract<FrameMessage, { type: "event" }>,
  ) {
    const session = state.session;
    const room = state.room;
    if (!session || !room || player(frame.tab) !== frame) return;
    const info = await browser.tabs.get(frame.tab);
    const host = room.host === session.you;
    const synced = session.tab === frame.tab;
    const front = await foreground();
    const decision =
      message.kind === "status"
        ? host && synced
          ? "report"
          : "ignore"
        : route({
            host,
            synced,
            matches:
              key(info.url) !== null &&
              key(info.url) === key(room.playback.url),
            bound: message.bound,
            playing: message.playing,
            audible: message.audible,
            foreground: front?.id === frame.tab,
          });
    if (decision === "ignore") return;
    if (decision === "push") return push(frame.tab);
    if (decision === "adopt") await adopt(frame.tab);
    state.link?.send({
      type: "playback",
      url: host ? (info.url ?? null) : room.playback.url,
      title: host ? (info.title ?? null) : room.playback.title,
      playing: message.playing,
      position: message.position,
      rate: message.rate,
    });
  }

  async function act(action: Action): Promise<Reply> {
    await ready;
    if (action.kind === "create" || action.kind === "join") {
      const room = action.kind === "join" ? action.room.trim() : code();
      if (!ROOM_ID.test(room)) return { ok: false, error: "Invalid room code" };
      if (state.session) leave();
      const tab = await foreground();
      state.session = {
        room,
        name: action.name,
        tab: tab?.id !== undefined && player(tab.id) ? tab.id : undefined,
        announce: action.kind === "create",
      };
      await save();
      connect();
      return { ok: true };
    }
    if (!state.session) return { ok: false, error: "Not in a room" };
    if (action.kind === "leave") {
      leave();
      return { ok: true };
    }
    if (action.kind === "mode") {
      return relay({ type: "mode", mode: action.mode });
    }
    const tab = await foreground();
    const frame = tab?.id === undefined ? null : player(tab.id);
    if (!frame) return { ok: false, error: "No video in this tab" };
    await adopt(frame.tab);
    if (state.room?.host === state.session.you) send(frame, { type: "status" });
    return { ok: true };
  }

  function relay(message: ClientMessage): Reply {
    if (state.link?.send(message)) return { ok: true };
    return { ok: false, error: "Not connected" };
  }

  function leave() {
    const tab = state.session?.tab;
    state.link?.send({ type: "leave" });
    state.link?.close();
    state.link = null;
    state.session = null;
    state.room = null;
    state.samples = [];
    push(tab);
    save();
    state.view = IDLE;
    browser.storage.session.set({ view: IDLE });
  }

  browser.runtime.onConnect.addListener((port) => {
    const tab = port.sender?.tab?.id;
    if (port.name !== "frame" || tab === undefined) return;
    const frame: Frame = {
      port,
      tab,
      frame: port.sender?.frameId ?? 0,
      area: 0,
    };
    const id = `${tab}:${frame.frame}`;
    frames.set(id, frame);
    port.onMessage.addListener(async (message: FrameMessage) => {
      await ready;
      if (message.type === "video") {
        frame.area = message.area;
        if (tab === state.session?.tab) push(tab);
        return;
      }
      if (message.type === "blocked") {
        if (tab === state.session?.tab) render({ blocked: message.blocked });
        return;
      }
      report(frame, message);
    });
    port.onDisconnect.addListener(() => {
      if (frames.get(id) === frame) frames.delete(id);
      if (tab === state.session?.tab) push(tab);
    });
  });

  browser.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "action") return;
    act(message.action as Action).then(respond);
    return true;
  });

  browser.tabs.onRemoved.addListener(async (tab) => {
    await ready;
    if (state.session?.tab !== tab) return;
    state.session.tab = undefined;
    save();
    render();
  });

  // The content script's isolated world can't see the page's pushState
  browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    await ready;
    for (const frame of frames.values()) {
      if (frame.tab === details.tabId) send(frame, { type: "rescan" });
    }
    if (details.tabId === state.session?.tab) push(details.tabId);
  });
}
