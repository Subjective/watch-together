import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Link,
  Lock,
  LogOut,
  Pause,
  Play,
  Unlock,
  WifiOff,
} from "lucide-react";
import { LIMITS, position, type Member } from "@repo/protocol";
import type { Action, View } from "../lib/messages";
import { preview } from "../lib/preview";
import type { Settings } from "../lib/settings";
import { Avatar, Editable, Icon } from "./ui";

/** Faces shown before the rest collapse into +N. */
const FACES = 6;

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  if (hours === 0) return `${minutes}:${rest}`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
}

/** The host's video URL with the room attached, or just the code. */
function share(view: View) {
  const room = view.room!;
  if (!room.playback.url || !URL.canParse(room.playback.url)) return room.id;
  const url = new URL(room.playback.url);
  url.searchParams.set("wt_room", room.id);
  return url.toString();
}

export function Room(props: {
  view: View;
  settings: Settings;
  run: (action: Action) => void;
  onFollow: (follow: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const view = props.view;
  const room = view.room!;
  const playback = room.playback;
  const host = room.host === view.you;
  const control = host || room.mode === "everyone";
  const online = view.status === "connected";
  const now = position(playback, Date.now() + view.offset);
  const progress = playback.duration
    ? Math.min(100, (now / playback.duration) * 100)
    : 0;
  const link = share(view);
  const image = preview(playback);
  const thumbnail = image !== null && image !== broken;
  const away = playback.url !== null && view.synced?.matches !== true;
  // You, then the host, then everyone else in join order
  const members = [...room.members].sort(
    (a, b) =>
      Number(b.id === view.you) - Number(a.id === view.you) ||
      Number(b.id === room.host) - Number(a.id === room.host) ||
      a.joined - b.joined,
  );
  const faces = [...members].sort(
    (a, b) => Number(b.id === room.host) - Number(a.id === room.host),
  );

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const toggle = (
    <button
      data-testid="toggle"
      aria-label={playback.playing ? "Pause" : "Play"}
      title={
        view.blocked
          ? "Click the video to catch up"
          : control
            ? playback.playing
              ? "Pause for everyone"
              : "Play for everyone"
            : "Only the host can control"
      }
      disabled={!control || !online}
      onClick={() => props.run({ kind: "play", playing: !playback.playing })}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform enabled:hover:scale-105 ${
        thumbnail ? "bg-white/90 text-slate-900" : "bg-green-500 text-white"
      } ${view.blocked ? "ring-2 ring-amber-400" : ""}`}
    >
      {playback.playing ? (
        <Pause className="h-4 w-4 fill-current" />
      ) : (
        <Play className="ml-0.5 h-4 w-4 fill-current" />
      )}
    </button>
  );

  return (
    <main className="p-4">
      <section
        data-testid="status"
        data-status={view.status}
        className={`overflow-hidden rounded-2xl border-2 ${online ? "border-green-200" : "border-amber-200"}`}
      >
        <div className={`p-3 ${online ? "bg-green-50" : "bg-amber-50"}`}>
          <div className="flex items-center gap-2 px-1">
            {!online && (
              <WifiOff
                aria-label="Reconnecting"
                className="h-4 w-4 shrink-0 text-amber-600"
              />
            )}
            <Editable
              value={room.name}
              max={LIMITS.roomName}
              label="Rename room"
              editable={host}
              onSave={(name) =>
                props.run({ kind: "rename", target: "room", name })
              }
              className="flex-1 text-lg font-semibold"
            />
            <Icon
              label={link === room.id ? "Copy room code" : "Copy invite link"}
              testid="copy"
              onClick={copy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : link === room.id ? (
                <Copy className="h-4 w-4" />
              ) : (
                <Link className="h-4 w-4" />
              )}
            </Icon>
            <Icon
              label="Leave room"
              testid="leave"
              onClick={() => props.run({ kind: "leave" })}
              tone="bg-red-500 hover:bg-red-600"
            >
              <LogOut className="h-4 w-4 text-white" />
            </Icon>
          </div>

          {playback.url ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm">
              {thumbnail ? (
                <span className="relative flex h-[52px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                  <img
                    src={image}
                    alt=""
                    onError={() => setBroken(image)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/20" />
                  <span className="relative">{toggle}</span>
                </span>
              ) : (
                <span className="pl-1">{toggle}</span>
              )}
              <div className="min-w-0 flex-1 pr-1">
                <button
                  data-testid="title"
                  title={host ? "Go to the video" : "Go to the host's video"}
                  onClick={() => props.run({ kind: "follow" })}
                  className="flex w-full min-w-0 items-center gap-1 text-left text-sm font-semibold hover:underline"
                >
                  <span className="truncate">
                    {playback.title ?? playback.url}
                  </span>
                  {away && (
                    <ArrowUpRight
                      data-testid="away"
                      className="h-4 w-4 shrink-0 text-green-600"
                    />
                  )}
                </button>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-green-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div
                  data-testid="time"
                  className="mt-1 flex justify-between text-[11px] text-slate-400 tabular-nums"
                >
                  <span>{clock(now)}</span>
                  {playback.duration && <span>{clock(playback.duration)}</span>}
                </div>
              </div>
            </div>
          ) : (
            <p
              data-testid="title"
              className="mt-2 flex items-center gap-2 px-1 text-sm text-green-800/70"
            >
              <Play className="h-3.5 w-3.5" />
              Play a video in any tab
            </p>
          )}
        </div>

        <div
          className={`flex items-center gap-2 border-t-2 bg-white p-3 pt-4 ${online ? "border-green-200" : "border-amber-200"}`}
        >
          <button
            data-testid="faces"
            aria-label={`${room.members.length} watching`}
            title={members.map((member) => member.name).join(", ")}
            onClick={() => setOpen(!open)}
            className="flex flex-1 -space-x-2 pl-1"
          >
            {faces.slice(0, FACES).map((member) => (
              <span key={member.id} className="relative">
                <Avatar
                  name={member.name}
                  dim={!member.online}
                  className="h-8 w-8 text-sm ring-2 ring-white"
                />
                {member.id === room.host && (
                  <Crown className="absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-amber-500" />
                )}
              </span>
            ))}
            {faces.length > FACES && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-2 ring-white">
                +{faces.length - FACES}
              </span>
            )}
          </button>
          {host ? (
            <Icon
              label={
                room.mode === "host"
                  ? "Only you can control playback"
                  : "Everyone can control playback"
              }
              testid="mode"
              pressed={room.mode === "host"}
              onClick={() =>
                props.run({
                  kind: "mode",
                  mode: room.mode === "host" ? "everyone" : "host",
                })
              }
            >
              {room.mode === "host" ? (
                <Lock className="h-4 w-4 text-amber-500" />
              ) : (
                <Unlock className="h-4 w-4 text-slate-400" />
              )}
            </Icon>
          ) : (
            <span
              data-testid="mode"
              data-mode={room.mode}
              title={
                room.mode === "host"
                  ? "Only the host can control playback"
                  : "Everyone can control playback"
              }
              className="flex h-8 w-8 items-center justify-center"
            >
              {room.mode === "host" ? (
                <Lock className="h-4 w-4 text-amber-500/50" />
              ) : (
                <Unlock className="h-4 w-4 text-slate-300" />
              )}
            </span>
          )}
          {!host && (
            <Icon
              label={
                props.settings.follow
                  ? "Following the host to new videos"
                  : "Not following the host"
              }
              testid="auto-follow"
              pressed={props.settings.follow}
              onClick={() => props.onFollow(!props.settings.follow)}
            >
              {props.settings.follow ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4 text-slate-400" />
              )}
            </Icon>
          )}
          <Icon
            label={open ? "Hide people" : "Show people"}
            testid="expand"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </Icon>
        </div>

        {open && (
          <ul
            data-testid="members"
            className="max-h-[232px] overflow-y-auto border-t border-slate-100 bg-slate-50 p-2"
          >
            {members.map((member) => (
              <Person
                key={member.id}
                member={member}
                you={member.id === view.you}
                host={member.id === room.host}
                run={props.run}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Person(props: {
  member: Member;
  you: boolean;
  host: boolean;
  run: (action: Action) => void;
}) {
  const member = props.member;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-2 py-2 ${props.you ? "bg-white" : ""}`}
    >
      <span className="relative">
        <Avatar name={member.name} dim={!member.online} />
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${member.online ? "bg-green-500" : "bg-slate-300"}`}
        />
      </span>
      <Editable
        value={member.name}
        max={LIMITS.userName}
        label="Edit your name"
        editable={props.you}
        onSave={(name) => props.run({ kind: "rename", target: "self", name })}
        className={`flex-1 text-sm ${props.you ? "font-semibold" : ""} ${member.online ? "" : "text-slate-400"}`}
      />
      {props.host && (
        <Crown aria-label="Host" className="h-4 w-4 text-amber-500" />
      )}
    </li>
  );
}
