"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Link,
  Lock,
  LogOut,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Unlink,
  Unlock,
} from "lucide-react";
import { Logo } from "@repo/logo";

/** Length of the demo video, in seconds. */
const DURATION = 147;
const TITLE = "Big Buck Bunny – Official Trailer";
const URL = "youtube.com/watch?v=aqz-KE-bpKQ";
/** How long the other window takes to follow. */
const DELAY = 240;
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type Player = { t: number; playing: boolean; at: number };

const time = (player: Player) =>
  (player.t + (player.playing ? (performance.now() - player.at) / 1000 : 0)) %
  DURATION;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** The app icon: the mark on an ink tile. */
export function Mark(props: { size: number }) {
  return (
    <span
      className="mark"
      style={{ width: props.size, height: props.size }}
      aria-hidden
    >
      <Logo size={Math.round(props.size * 0.62)} />
    </span>
  );
}

export function Chrome() {
  return (
    <svg className="chrome" viewBox="0 0 48 48" aria-hidden>
      <path d="M24 24L6.68 14A20 20 0 0 1 41.32 14Z" fill="#EA4335" />
      <path d="M24 24L41.32 14A20 20 0 0 1 24 44Z" fill="#FBBC04" />
      <path d="M24 24L24 44A20 20 0 0 1 6.68 14Z" fill="#34A853" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="7.5" fill="#4285F4" />
    </svg>
  );
}

/** A small animated short with a timecode large enough to compare at a glance. */
function scene(
  canvas: HTMLCanvasElement,
  t: number,
  playing: boolean,
  hud: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const s = w / 960;
  const progress = t / DURATION;
  const day = Math.sin(Math.PI * progress);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `hsl(208 70% ${22 + day * 38}%)`);
  sky.addColorStop(1, `hsl(${28 + day * 170} 75% ${62 + day * 14}%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff4cc";
  ctx.beginPath();
  ctx.arc(
    w * (0.12 + 0.76 * progress),
    h * (0.72 - 0.48 * day),
    h * 0.07,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgb(255 255 255 / 0.75)";
  [0, 1, 2].forEach((i) => {
    const x = (((i * 0.37 + t * 0.012) % 1.3) * 1.1 - 0.15) * w;
    const y = h * (0.18 + i * 0.09);
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
    ctx.ellipse(
      x + w * 0.045,
      y - h * 0.02,
      w * 0.05,
      h * 0.04,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
  const hills: [number, number, number, string][] = [
    [0.66, 0.06, 6, "hsl(150 28% 40%)"],
    [0.76, 0.05, 16, "hsl(158 34% 26%)"],
  ];
  hills.forEach(([base, amp, speed, color]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    Array.from({ length: w / 8 + 1 }, (_, i) => i * 8).forEach((x) => {
      const u = (x + t * speed * s) / w;
      ctx.lineTo(
        x,
        h * (base - amp * Math.sin(u * 7) - amp * 0.5 * Math.sin(u * 17)),
      );
    });
    ctx.lineTo(w, h);
    ctx.fill();
  });
  if (!hud) return;
  ctx.fillStyle = "rgb(255 255 255 / 0.95)";
  ctx.font = `700 ${64 * s}px ${MONO}`;
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgb(0 0 0 / 0.35)";
  ctx.shadowBlur = 12 * s;
  ctx.fillText(`${clock(t)}.${Math.floor((t % 1) * 10)}`, 36 * s, 30 * s);
  ctx.shadowBlur = 0;
  const shade = ctx.createLinearGradient(0, h * 0.78, 0, h);
  shade.addColorStop(0, "rgb(0 0 0 / 0)");
  shade.addColorStop(1, "rgb(0 0 0 / 0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  const y = h * 0.93;
  ctx.fillStyle = "rgb(255 255 255 / 0.3)";
  ctx.fillRect(w * 0.04, y, w * 0.92, 6 * s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(w * 0.04, y, w * 0.92 * progress, 6 * s);
  ctx.beginPath();
  ctx.arc(w * 0.04 + w * 0.92 * progress, y + 3 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  if (playing) return;
  ctx.fillStyle = "rgb(0 0 0 / 0.25)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgb(255 255 255 / 0.92)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 46 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111214";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 12 * s, h / 2 - 18 * s);
  ctx.lineTo(w / 2 + 20 * s, h / 2);
  ctx.lineTo(w / 2 - 12 * s, h / 2 + 18 * s);
  ctx.fill();
}

/** Types the placeholder out, holds it, then erases it, like the extension. */
function Typing(props: { text: string }) {
  const [count, setCount] = useState(0);
  const [erasing, setErasing] = useState(false);
  const length = props.text.length;
  useEffect(() => {
    const wait = erasing
      ? 30
      : count === length
        ? 2000
        : count === 0
          ? 600
          : 80;
    const timer = setTimeout(() => {
      if (erasing && count === 0) return setErasing(false);
      if (erasing) return setCount(count - 1);
      if (count === length) return setErasing(true);
      setCount(count + 1);
    }, wait);
    return () => clearTimeout(timer);
  }, [count, erasing, length]);
  return (
    <span className="typing">
      {props.text.slice(0, count)}
      <span className="caret" />
    </span>
  );
}

/**
 * Two browser windows playing the same video, driven by a copy of the
 * extension's popup. Josh is the host; Kevin's window follows him.
 */
export function Demo(props: { children: ReactNode }) {
  const josh = useRef<Player>({ t: 52, playing: true, at: 0 });
  const kevin = useRef<Player>({ t: 52, playing: true, at: 0 });
  const left = useRef<HTMLCanvasElement>(null);
  const right = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLCanvasElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const now = useRef<HTMLSpanElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(true);
  const [joined, setJoined] = useState(true);
  const [mode, setMode] = useState<"host" | "everyone">("host");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    josh.current.at = performance.now();
    kevin.current.at = performance.now();
    const handle = { frame: 0 };
    const loop = () => {
      const t = time(josh.current);
      if (left.current) scene(left.current, t, josh.current.playing, true);
      if (right.current)
        scene(right.current, time(kevin.current), kevin.current.playing, true);
      if (thumb.current) scene(thumb.current, t, true, false);
      if (fill.current) fill.current.style.width = `${(t / DURATION) * 100}%`;
      if (now.current) now.current.textContent = clock(t);
      handle.frame = requestAnimationFrame(loop);
    };
    handle.frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle.frame);
  }, []);

  const set = (player: Player, t: number, play: boolean) => {
    player.t = t;
    player.playing = play;
    player.at = performance.now();
    setPlaying(josh.current.playing);
  };

  // The other window follows a beat later, with a dot crossing the link
  const send = (from: Player, t: number, play: boolean) => {
    const to = from === josh.current ? kevin.current : josh.current;
    const ball = dot.current;
    const ring = chip.current;
    if (ball && ring) {
      ball.className = "dot";
      ring.classList.remove("ping");
      void ball.offsetWidth;
      ball.className = `dot ${from === josh.current ? "go" : "back"}`;
      ring.classList.add("ping");
    }
    setTimeout(() => set(to, t, play), DELAY);
  };

  const act = (player: Player, t: number, play: boolean) => {
    set(player, t, play);
    if (joined) send(player, t, play);
  };

  // Clicking a video plays or pauses it; clicking along the bottom seeks
  const click = (
    player: Player,
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (player === kevin.current && joined && mode === "host") {
      setLocked(true);
      setTimeout(() => setLocked(false), 700);
      return;
    }
    if (y > 0.84)
      return act(
        player,
        Math.max(0, Math.min(DURATION - 0.1, ((x - 0.04) / 0.92) * DURATION)),
        player.playing,
      );
    act(player, time(player), !player.playing);
  };

  const rejoin = () => {
    setJoined(true);
    send(josh.current, time(josh.current), josh.current.playing);
  };

  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    act(
      josh.current,
      ((event.clientX - box.left) / box.width) * DURATION,
      josh.current.playing,
    );
  };

  const host = mode === "host";

  return (
    <section className="stage" aria-label="Live demo">
      <div className="windows">
        <Window initial="J" tone="j" off={!joined}>
          <canvas
            ref={left}
            className="video"
            width={960}
            height={540}
            aria-label="Josh's video"
            onClick={(event) => click(josh.current, event)}
          />
        </Window>
        <div className={`link ${joined ? "" : "off"}`}>
          <span className="dot" ref={dot} />
          <span className="chip" ref={chip}>
            {joined ? <Link /> : <Unlink />}
          </span>
        </div>
        <Window initial="K" tone="k" off={false}>
          <canvas
            ref={right}
            className="video"
            width={960}
            height={540}
            aria-label="Kevin's video"
            onClick={(event) => click(kevin.current, event)}
          />
          <div className={`locked ${locked ? "show" : ""}`}>
            <span>
              <Lock />
            </span>
          </div>
        </Window>
      </div>

      <div className="lower">
        <div className="drop">
          <div className="popup">
            {joined ? (
              <div className="room enter">
                <div className="top">
                  <div className="row">
                    <span className="rname">Movie night</span>
                    <button
                      className="icon"
                      aria-label="Copy invite link"
                      title="Copy invite link"
                      onClick={copy}
                    >
                      {copied ? (
                        <Check
                          key="check"
                          className="pop"
                          style={{ color: "var(--green-600)" }}
                        />
                      ) : (
                        <Link key="link" className="pop" />
                      )}
                    </button>
                    <button
                      className="icon red"
                      aria-label="Leave room"
                      title="Leave room"
                      onClick={() => setJoined(false)}
                    >
                      <LogOut />
                    </button>
                  </div>
                  <div className="now">
                    <span className="thumb">
                      <canvas ref={thumb} width={184} height={104} />
                      <button
                        className="toggle"
                        aria-label={playing ? "Pause" : "Play"}
                        onClick={() =>
                          act(josh.current, time(josh.current), !playing)
                        }
                      >
                        {playing ? (
                          <Pause key="pause" className="pop fill-current" />
                        ) : (
                          <Play key="play" className="pop fill-current" />
                        )}
                      </button>
                    </span>
                    <div className="meta">
                      <div className="title">{TITLE}</div>
                      <div className="track" onClick={seek}>
                        <div ref={fill} />
                      </div>
                      <div className="times">
                        <span ref={now} />
                        <span>{clock(DURATION)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="foot">
                  <div className="faces">
                    <span className="face">
                      <span className="av j">J</span>
                      <span className="crown">
                        <Crown />
                      </span>
                    </span>
                    <span className="face">
                      <span className="av k">K</span>
                    </span>
                  </div>
                  <button
                    className="icon"
                    title={
                      host
                        ? "Only you can control playback"
                        : "Everyone can control playback"
                    }
                    aria-label={
                      host
                        ? "Only you can control playback"
                        : "Everyone can control playback"
                    }
                    style={{ color: host ? "var(--amber)" : "var(--faint)" }}
                    onClick={() => setMode(host ? "everyone" : "host")}
                  >
                    {host ? (
                      <Lock key="lock" className="pop" />
                    ) : (
                      <Unlock key="unlock" className="pop" />
                    )}
                  </button>
                  <button
                    className={`icon chev ${open ? "open" : ""}`}
                    aria-label={open ? "Hide people" : "Show people"}
                    onClick={() => setOpen(!open)}
                  >
                    <ChevronDown />
                  </button>
                </div>
                <div className={`people ${open ? "open" : ""}`}>
                  <div>
                    <ul>
                      <li className="you">
                        <span className="on">
                          <span className="av j">J</span>
                        </span>
                        <span className="n">Josh</span>
                        <Crown style={{ color: "var(--amber)" }} />
                      </li>
                      <li>
                        <span className="on">
                          <span className="av k">K</span>
                        </span>
                        <span className="n">Kevin</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="home enter">
                <header>
                  <Mark size={28} />
                  <h3>Watch Together</h3>
                  <div className="pill">
                    <span className="av sm j">J</span>Josh
                  </div>
                </header>
                <label className="code">
                  <Typing text="Enter room code…" />
                  <button
                    className="icon green"
                    aria-label="Join room"
                    disabled
                  >
                    <ArrowRight />
                  </button>
                </label>
                <div className="recent">
                  <div className="row">
                    <span className="av j">J</span>
                    <p>
                      <b>Movie night</b>
                      <small>just now</small>
                    </p>
                    <button
                      className="icon"
                      aria-label="Rejoin Movie night"
                      title="Rejoin"
                      onClick={rejoin}
                    >
                      <RotateCcw />
                    </button>
                  </div>
                </div>
                <button className="create" onClick={rejoin}>
                  <Plus />
                  Create room
                </button>
              </div>
            )}
          </div>
        </div>
        <span />
        {props.children}
      </div>
    </section>
  );
}

function Window(props: {
  initial: string;
  tone: string;
  off: boolean;
  children: ReactNode;
}) {
  return (
    <div className="win">
      <div className="bar">
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <div className="url">{URL}</div>
        <div className={`ext ${props.off ? "off" : ""}`}>
          <Mark size={22} />
          <span className="badge">2</span>
        </div>
        <span className={`av sm ${props.tone}`}>{props.initial}</span>
      </div>
      <div className="screen">{props.children}</div>
    </div>
  );
}
