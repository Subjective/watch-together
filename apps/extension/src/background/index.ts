import { browser, type Browser } from "wxt/browser";
import {
  ROOM_ID,
  position,
  type ClientMessage,
  type Room,
} from "@repo/protocol";
import { offset, sample } from "../lib/clock";
import { key } from "../lib/key";
import { NOTE_MS, note, overlay } from "../lib/overlay";
import { route } from "../lib/route";
import {
  IDLE,
  type Action,
  type Command,
  type FrameMessage,
  type Reply,
  type View,
} from "../lib/messages";
import { recent, remember, settings, type Settings } from "../lib/settings";
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
  /** We created the room: report the synced tab's video and apply the
   * default control mode once welcomed. */
  announce?: boolean;
  /** Room name to create the room with. */
  label?: string;
  /** Key of the last room video auto-follow acted on. */
  followed?: string | null;
}

interface Frame {
  port: Browser.runtime.Port;
  tab: number;
  frame: number;
  area: number;
  /** The overlay last sent, to skip repeats. */
  pill: string;
}

/** Toolbar icons: color on your synced tab, grey everywhere else. */
const COLOR = icons("icon");
const GREY = icons("icon-grey");

const BADGE = { ok: "#22c55e", warn: "#f59e0b", error: "#ef4444" };

function icons(name: string) {
  return Object.fromEntries(
    [16, 32, 48, 128].map((size) => [size, `/icons/${name}-${size}.png`]),
  );
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
    /** Last room name and host written to the recent list. */
    remembered: "",
    /** The latest note about the room, shown on the overlay for a moment. */
    note: { text: "", id: 0, at: 0 },
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
    const matches =
      key(info?.url) !== null &&
      key(info?.url) === key(state.room?.playback.url);
    state.view = {
      ...state.view,
      ...patch,
      room: state.room,
      you: state.session?.you ?? null,
      offset: offset(state.samples),
      synced: info?.id
        ? { tab: info.id, title: info.title ?? "", matches }
        : null,
    };
    await browser.storage.session.set({ view: state.view });
    paint();
    badge();
  }

  /** Send every tab's player its overlay, and clear it everywhere else. */
  async function paint() {
    const session = state.session;
    const room = state.room;
    const fresh = Date.now() - state.note.at < NOTE_MS;
    for (const tab of new Set([...frames.values()].map((frame) => frame.tab))) {
      const target = player(tab);
      const info =
        target && room && session?.you
          ? await browser.tabs.get(tab).catch(() => null)
          : null;
      const pill =
        info && room && session?.you
          ? overlay({
              room,
              you: session.you,
              status: state.view.status,
              blocked: state.view.blocked,
              synced: tab === session.tab,
              url: info.url,
              note: fresh ? state.note.text : null,
              id: state.note.id,
            })
          : null;
      for (const frame of frames.values()) {
        if (frame.tab !== tab) continue;
        const value = frame === target ? pill : null;
        const text = JSON.stringify(value);
        if (frame.pill === text) continue;
        frame.pill = text;
        send(frame, { type: "overlay", overlay: value });
      }
    }
  }

  /** Member count on the toolbar, and the color icon on the synced tab. */
  async function badge() {
    const view = state.view;
    const action = browser.action;
    const color = view.error
      ? BADGE.error
      : view.status === "connected"
        ? BADGE.ok
        : BADGE.warn;
    const count = view.room ? String(view.room.members.length) : "";
    await action.setBadgeText({ text: count });
    await action.setBadgeBackgroundColor({ color });
    const tab = view.room ? state.session?.tab : undefined;
    if (tab === undefined) return;
    await action.setIcon({ tabId: tab, path: COLOR }).catch(() => null);
    await action
      .setBadgeText({ tabId: tab, text: view.blocked ? "!" : count })
      .catch(() => null);
    await action
      .setBadgeBackgroundColor({
        tabId: tab,
        color: view.blocked ? BADGE.warn : color,
      })
      .catch(() => null);
  }

  /** Give a tab back the plain toolbar icon and the shared badge. */
  async function plain(tab: number | undefined) {
    if (tab === undefined) return;
    const action = browser.action;
    await action.setIcon({ tabId: tab, path: GREY }).catch(() => null);
    const text = await action.getBadgeText({});
    const color = await action.getBadgeBackgroundColor({});
    await action.setBadgeText({ tabId: tab, text }).catch(() => null);
    await action
      .setBadgeBackgroundColor({ tabId: tab, color })
      .catch(() => null);
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
        link.send({
          type: "join",
          name: session.name,
          resume: session.resume,
          room: session.label,
        }),
      message: (message) => {
        if (message.type === "error") {
          if (message.code === "forbidden") push(state.session?.tab);
          render({ error: message.message });
          return;
        }
        if (state.room && message.room.seq < state.room.seq) return;
        state.samples = sample(state.samples, message.now - Date.now());
        const before = state.room;
        state.room = message.room;
        const said =
          before && session.you
            ? note(before, message.room, session.you)
            : null;
        if (said) {
          state.note = { text: said, id: state.note.id + 1, at: Date.now() };
          setTimeout(paint, NOTE_MS);
        }
        if (message.type === "welcome") {
          link.settled();
          session.resume = message.resume;
          session.you = message.you;
          save();
          announce();
        }
        record();
        chase();
        push(session.tab);
        render({ status: "connected", error: null });
      },
      lost: () => render({ status: "reconnecting" }),
    });
    state.link = link;
    link.open();
    render({ status: "connecting", error: null });
  }

  /**
   * After creating a room, apply the default control mode and ask the
   * synced tab's video for its state.
   */
  async function announce() {
    const session = state.session!;
    if (!session.announce) return;
    session.announce = false;
    save();
    const preferred = (await settings()).mode;
    if (preferred !== state.room?.mode)
      state.link?.send({ type: "mode", mode: preferred });
    const frame = session.tab === undefined ? null : player(session.tab);
    if (frame) send(frame, { type: "status" });
  }

  /**
   * Auto-follow: when the room moves to another video, take a follower's
   * synced tab there, or open one tab for it and keep reusing that one.
   */
  async function chase() {
    const session = state.session!;
    const url = state.room?.playback.url;
    if (!url || state.room?.host === session.you) return;
    const target = key(url);
    if (target === session.followed) return;
    session.followed = target;
    save();
    if (!(await settings()).follow) return;
    const info =
      session.tab === undefined
        ? null
        : await browser.tabs.get(session.tab).catch(() => null);
    if (info?.id !== undefined) {
      if (key(info.url) !== target) await browser.tabs.update(info.id, { url });
      return;
    }
    const created = await browser.tabs.create({ url });
    await adopt(created.id);
  }

  /** Keep the room at the top of the recent list with its current name. */
  async function record() {
    const room = state.room!;
    const host = room.members.find((member) => member.id === room.host);
    const label = `${room.id}:${room.name}:${host?.name}`;
    if (label === state.remembered) return;
    state.remembered = label;
    const list = remember(await recent(), {
      id: room.id,
      name: room.name,
      host: host?.name ?? "",
      at: Date.now(),
      resume: state.session?.resume,
    });
    await browser.storage.local.set({ recent: list });
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
    if (previous !== tab) {
      push(previous);
      plain(previous);
    }
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
      duration: message.duration,
      image: host ? message.image : room.playback.image,
    });
  }

  async function act(action: Action): Promise<Reply> {
    await ready;
    if (action.kind === "create" || action.kind === "join") {
      const room = action.kind === "join" ? action.room.trim() : code();
      if (!ROOM_ID.test(room)) return { ok: false, error: "Invalid room code" };
      const tab = await foreground();
      await enter(
        room,
        tab?.id !== undefined && player(tab.id) ? tab.id : undefined,
        action.kind === "create",
        action.kind === "join" ? action.resume : undefined,
      );
      return { ok: true };
    }
    if (!state.session) return { ok: false, error: "Not in a room" };
    if (action.kind === "leave") {
      leave();
      return { ok: true };
    }
    if (action.kind === "mode") {
      const reply = relay({ type: "mode", mode: action.mode });
      if (reply.ok) keep({ mode: action.mode });
      return reply;
    }
    if (action.kind === "rename") {
      const reply = relay({
        type: "rename",
        target: action.target,
        name: action.name,
      });
      if (reply.ok && action.target === "self") {
        state.session.name = action.name;
        save();
        keep({ name: action.name });
      }
      return reply;
    }
    if (action.kind === "play") {
      const playback = state.room?.playback;
      if (!playback?.url) return { ok: false, error: "Nothing is playing" };
      const now = position(playback, Date.now() + offset(state.samples));
      return relay({
        type: "playback",
        url: playback.url,
        title: playback.title,
        playing: action.playing,
        position: playback.duration ? Math.min(now, playback.duration) : now,
        rate: playback.rate,
        duration: playback.duration,
        image: playback.image,
      });
    }
    return follow();
  }

  /** Start a session in a room, with `tab` as the synced tab. */
  async function enter(
    room: string,
    tab: number | undefined,
    create: boolean,
    resume?: string,
  ) {
    if (state.session) leave();
    const preferences = await settings();
    state.session = {
      room,
      name: preferences.name,
      resume,
      tab,
      announce: create,
      label: create ? `${preferences.name}'s room` : undefined,
    };
    await save();
    connect();
  }

  /** Remember a choice made in the popup as the next default. */
  async function keep(patch: Partial<Settings>) {
    await browser.storage.local.set({
      settings: { ...(await settings()), ...patch },
    });
  }

  /** Open the room's video in the synced tab, or in a new synced tab. */
  async function follow(): Promise<Reply> {
    const url = state.room?.playback.url;
    if (!url) return { ok: false, error: "The host isn't playing anything" };
    const tab = state.session?.tab;
    const info =
      tab === undefined ? null : await browser.tabs.get(tab).catch(() => null);
    if (info?.id !== undefined) {
      const same = key(info.url) === key(url);
      await browser.tabs.update(
        info.id,
        same ? { active: true } : { url, active: true },
      );
      await browser.windows.update(info.windowId, { focused: true });
      return { ok: true };
    }
    const created = await browser.tabs.create({ url });
    await adopt(created.id);
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
    state.remembered = "";
    state.note = { text: "", id: state.note.id, at: 0 };
    push(tab);
    save();
    state.view = IDLE;
    browser.storage.session.set({ view: IDLE });
    paint();
    badge().then(() => plain(tab));
  }

  browser.runtime.onConnect.addListener((port) => {
    const tab = port.sender?.tab?.id;
    if (port.name !== "frame" || tab === undefined) return;
    const frame: Frame = {
      port,
      tab,
      frame: port.sender?.frameId ?? 0,
      area: 0,
      pill: "null",
    };
    const id = `${tab}:${frame.frame}`;
    frames.set(id, frame);
    port.onMessage.addListener(async (message: FrameMessage) => {
      await ready;
      if (message.type === "video") {
        frame.area = message.area;
        if (tab === state.session?.tab) push(tab);
        paint();
        return;
      }
      if (message.type === "offer") {
        if (!state.session) return;
        if (message.offer === "follow") return follow();
        return adopt(tab);
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

  browser.tabs.onUpdated.addListener(async (tab, change) => {
    await ready;
    if (change.url) paint();
    if (tab !== state.session?.tab || !(change.url || change.title)) return;
    if (change.url) push(tab);
    render();
  });

  // Share links: the host's video URL with `wt_room` joins that room
  browser.webNavigation.onDOMContentLoaded.addListener(async (details) => {
    if (details.frameId !== 0 || !URL.canParse(details.url)) return;
    const url = new URL(details.url);
    const room = url.searchParams.get("wt_room");
    if (!room || !ROOM_ID.test(room)) return;
    url.searchParams.delete("wt_room");
    browser.scripting
      .executeScript({
        target: { tabId: details.tabId },
        func: (clean: string) => history.replaceState(history.state, "", clean),
        args: [url.toString()],
      })
      .catch(() => null);
    await ready;
    if (state.session?.room === room) return adopt(details.tabId);
    const resume = (await recent()).find((entry) => entry.id === room)?.resume;
    await enter(room, details.tabId, false, resume);
  });

  // The content script's isolated world can't see the page's pushState
  browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    await ready;
    for (const frame of frames.values()) {
      if (frame.tab === details.tabId) send(frame, { type: "rescan" });
    }
    if (details.tabId === state.session?.tab) push(details.tabId);
    paint();
  });
}
