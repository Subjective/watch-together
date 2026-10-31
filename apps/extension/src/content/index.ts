import { browser, type Browser } from "wxt/browser";
import type { Playback } from "@repo/protocol";
import type { Command, FrameMessage } from "../lib/messages";
import { ECHO_MS, echo, plan, type Expected, type Kind } from "../lib/sync";

/** Recheck drift and layout this often while bound. */
const TICK_MS = 2000;

const KINDS: Kind[] = ["play", "pause", "seeked", "ratechange", "ended"];

/** The largest visible video in this frame. */
function largest(): { video: HTMLVideoElement | null; area: number } {
  return [...document.querySelectorAll("video")].reduce(
    (best, video) => {
      const rect = video.getBoundingClientRect();
      const area = Math.round(rect.width * rect.height);
      return area > best.area ? { video, area } : best;
    },
    { video: null as HTMLVideoElement | null, area: 0 },
  );
}

/** The video's poster, or the page's share image in the top frame. */
function image(video: HTMLVideoElement): string | null {
  if (video.poster) return video.poster;
  if (window !== top) return null;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[property="og:image"], meta[name="twitter:image"]',
  );
  if (!meta?.content || !URL.canParse(meta.content, location.href)) return null;
  return new URL(meta.content, location.href).toString();
}

function holds(node: Node): boolean {
  return (
    node instanceof HTMLVideoElement ||
    (node instanceof Element && node.querySelector("video") !== null)
  );
}

/**
 * Runs in every frame. Owns everything that touches a `<video>`: picking the
 * frame's player, applying room state, suppressing the echoes of what it
 * applied, and reporting everything else as user actions.
 */
export function start() {
  const state = {
    port: null as Browser.runtime.Port | null,
    video: null as HTMLVideoElement | null,
    area: -1,
    playback: null as Playback | null,
    offset: 0,
    expected: null as Expected | null,
    blocked: false,
    deferred: false,
  };

  function post(message: FrameMessage) {
    state.port?.postMessage(message);
  }

  function server() {
    return Date.now() + state.offset;
  }

  function media(video: HTMLVideoElement) {
    return {
      paused: video.paused,
      time: video.currentTime,
      rate: video.playbackRate,
      duration: video.duration,
    };
  }

  function block(blocked: boolean) {
    if (state.blocked === blocked) return;
    state.blocked = blocked;
    post({ type: "blocked", blocked });
    if (!blocked) return;
    // Browsers allow play() again once the user touches the page
    const retry = () => {
      removeEventListener("pointerdown", retry, true);
      removeEventListener("keydown", retry, true);
      apply(true);
    };
    addEventListener("pointerdown", retry, true);
    addEventListener("keydown", retry, true);
  }

  /** Bring the video in line with the room. `retry` replays a blocked play. */
  function apply(retry = false) {
    const video = state.video;
    const playback = state.playback;
    if (!video || !playback) return;
    // Seeking over an unfinished seek would swallow its seeked event, which
    // may be the user's; try again once it lands
    if (video.seeking) {
      if (state.deferred) return;
      state.deferred = true;
      const resume = () => {
        state.deferred = false;
        apply(retry);
      };
      video.addEventListener("seeked", resume, { once: true });
      return;
    }
    if (!playback.playing) block(false);
    const steps = plan(media(video), playback, server());
    if (
      steps.play === undefined &&
      steps.rate === undefined &&
      steps.seek === undefined
    )
      return;
    state.expected = { playback, until: Date.now() + ECHO_MS };
    if (steps.rate !== undefined) video.playbackRate = steps.rate;
    if (steps.seek !== undefined) video.currentTime = steps.seek;
    if (steps.play === false) video.pause();
    if (steps.play !== true || (state.blocked && !retry)) return;
    video.play().then(
      () => block(false),
      (error: DOMException) => {
        if (error.name === "NotAllowedError") block(true);
      },
    );
  }

  /** Pick this frame's player and tell the background its size. */
  function scan() {
    const best = largest();
    const changed = best.video !== state.video;
    state.video = best.video;
    if (changed) apply();
    if (best.area === state.area) return;
    state.area = best.area;
    post({ type: "video", area: best.area });
  }

  function receive(command: Command) {
    if (command.type === "rescan") return scan();
    if (command.type === "status") return report("status");
    state.playback = command.playback;
    state.offset = command.offset;
    if (command.playback) return apply();
    state.expected = null;
    block(false);
  }

  function report(kind: Kind | "status") {
    const video = state.video;
    if (!video) return;
    const ended = kind === "ended";
    post({
      type: "event",
      kind,
      playing: ended ? false : !video.paused,
      position: ended ? video.duration : video.currentTime,
      rate: video.playbackRate,
      audible: !video.muted && video.volume > 0,
      bound: state.playback !== null,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      image: image(video),
    });
  }

  function connect() {
    // The extension was reloaded or removed; this script is orphaned
    if (!browser.runtime?.id) return;
    const port = browser.runtime.connect({ name: "frame" });
    state.port = port;
    port.onMessage.addListener(receive);
    // A stopped service worker drops every port; reconnecting wakes it
    port.onDisconnect.addListener(() => {
      state.port = null;
      setTimeout(connect, 500);
    });
    state.area = -1;
    scan();
  }

  for (const kind of KINDS) {
    // Media events don't bubble, but they do pass through capture
    document.addEventListener(
      kind,
      (event) => {
        const video = state.video;
        if (event.target !== video || !video) return;
        if (kind === "pause" && video.ended) return;
        if (echo(state.expected, kind, media(video), Date.now(), server()))
          return;
        if (kind === "play") block(false);
        report(kind);
      },
      true,
    );
  }

  new MutationObserver((records) => {
    const touched = records.some(
      (record) =>
        [...record.addedNodes].some(holds) ||
        [...record.removedNodes].some(holds),
    );
    if (touched) scan();
  }).observe(document, { childList: true, subtree: true });

  document.addEventListener("loadedmetadata", scan, true);
  addEventListener("resize", scan);
  setInterval(() => {
    scan();
    if (state.playback?.playing && !state.blocked) apply();
  }, TICK_MS);

  connect();
}
