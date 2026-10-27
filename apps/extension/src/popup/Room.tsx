import { useState } from "react";
import {
  Check,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  Lock,
  MoreHorizontal,
  Pause,
  Play,
  Unlock,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { LIMITS, position } from "@repo/protocol";
import type { Action, View } from "../lib/messages";
import type { Settings } from "../lib/settings";
import { Editable, Header, Switch } from "./ui";

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
  onFollowSetting: (follow: boolean) => void;
  onSettings: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const view = props.view;
  const room = view.room!;
  const playback = room.playback;
  const host = room.host === view.you;
  const leader = room.members.find((member) => member.id === room.host);
  const online = view.status === "connected";
  const now = position(playback, Date.now() + view.offset);
  const progress =
    playback.duration && playback.duration > 0
      ? Math.min(100, (now / playback.duration) * 100)
      : 0;
  const link = share(view);
  const behind =
    !host && playback.url !== null && view.synced?.matches !== true;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Watch Together"
        back="Leave room"
        onBack={() => props.run({ kind: "leave" })}
      >
        <div className="relative">
          <button
            aria-label="Menu"
            title="Menu"
            onClick={() => setMenu(!menu)}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <button
                onClick={props.onSettings}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </Header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        <section
          className={`rounded-2xl border-2 p-4 ${
            online
              ? "border-green-200 bg-green-50/80"
              : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <div className="flex items-start gap-3">
            {online ? (
              <Wifi className="mt-1 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <WifiOff className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <Editable
                value={room.name}
                max={LIMITS.roomName}
                label="Rename room"
                editable={host}
                onSave={(name) =>
                  props.run({ kind: "rename", target: "room", name })
                }
                className="block w-full text-lg font-semibold"
              />
              <p
                data-testid="status"
                className={`text-sm ${online ? "text-green-600" : "text-amber-700"}`}
              >
                {online
                  ? "Connected"
                  : view.status === "connecting"
                    ? "Connecting…"
                    : "Reconnecting…"}
              </p>
            </div>
            <button
              data-testid="copy"
              aria-label={
                link === room.id ? "Copy room code" : "Copy share link"
              }
              title={
                link === room.id
                  ? `Copy room code (${room.id})`
                  : "Copy share link"
              }
              onClick={copy}
              className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            {!host && (
              <button
                data-testid="follow"
                aria-label="Go to host's video"
                title="Go to host's video"
                disabled={!playback.url}
                onClick={() => props.run({ kind: "follow" })}
                className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button
              data-testid="leave"
              onClick={() => props.run({ kind: "leave" })}
              className="rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Leave
            </button>
          </div>

          <p
            data-testid="title"
            className="mt-3 truncate text-sm text-slate-600"
            title={playback.title ?? undefined}
          >
            {playback.url
              ? (playback.title ?? playback.url)
              : "Nothing playing yet"}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {playback.playing ? (
              <Pause
                aria-label="Playing"
                className="h-5 w-5 shrink-0 fill-current"
              />
            ) : (
              <Play
                aria-label="Paused"
                className="h-5 w-5 shrink-0 fill-current"
              />
            )}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              data-testid="time"
              className="font-mono text-sm font-semibold"
            >
              {clock(now)}
              {playback.duration ? ` / ${clock(playback.duration)}` : ""}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-green-200/70 pt-3 text-sm">
            <span
              data-testid="sync-status"
              className="min-w-0 flex-1 truncate text-slate-600"
            >
              {view.blocked
                ? "Press play to catch up"
                : view.synced?.matches
                  ? `Synced · ${view.synced.title}`
                  : "This tab isn't synced"}
            </span>
            <button
              data-testid="sync"
              onClick={() => props.run({ kind: "sync" })}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
            >
              Sync this tab
            </button>
          </div>
        </section>

        {!host && !props.settings.follow && behind && (
          <div
            data-testid="banner"
            className="flex items-center gap-3 rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-3"
          >
            <Eye className="h-4 w-4 shrink-0 text-yellow-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-yellow-800">
                Host switched video
              </p>
              <p className="truncate text-xs text-yellow-700">
                Click to follow {leader?.name ?? "the host"}
              </p>
            </div>
            <button
              onClick={() => props.run({ kind: "follow" })}
              className="rounded-xl border-2 border-yellow-300 bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-200"
            >
              Follow
            </button>
          </div>
        )}

        <section className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Users className="h-5 w-5 text-slate-500" />
            Participants ({room.members.length})
          </h2>
          <ul data-testid="members" className="space-y-2">
            {room.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${member.online ? "bg-green-500" : "bg-slate-400"}`}
                />
                <Editable
                  value={member.name}
                  max={LIMITS.userName}
                  label="Edit your name"
                  editable={member.id === view.you}
                  onSave={(name) =>
                    props.run({ kind: "rename", target: "self", name })
                  }
                  className="flex-1"
                />
                {member.id === room.host && (
                  <span className="flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    <Crown className="h-3 w-3" /> Host
                  </span>
                )}
                {member.id === view.you && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    You
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
            {room.mode === "host" ? (
              <Lock className="h-4 w-4 shrink-0 text-orange-500" />
            ) : (
              <Unlock className="h-4 w-4 shrink-0 text-green-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {room.mode === "host"
                  ? "Only host can control"
                  : "Everyone can control"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {room.mode === "host"
                  ? `Only ${leader?.name ?? "the host"} can play/pause`
                  : "Anyone can play, pause and seek"}
              </p>
            </div>
            {host ? (
              <Switch
                label="Only host can control"
                checked={room.mode === "host"}
                onChange={(only) =>
                  props.run({ kind: "mode", mode: only ? "host" : "everyone" })
                }
              />
            ) : (
              <span
                data-testid="mode"
                className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium"
              >
                {room.mode === "host" ? "Host only" : "Everyone"}
              </span>
            )}
          </div>

          {!host && (
            <div className="mt-4 flex items-center gap-3">
              <Eye className="h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Auto-follow host</p>
                <p
                  data-testid="following"
                  className="truncate text-xs text-slate-500"
                >
                  {props.settings.follow
                    ? `Following ${leader?.name ?? "the host"}`
                    : "Follow manually when the host switches videos"}
                </p>
              </div>
              <Switch
                label="Auto-follow host"
                checked={props.settings.follow}
                onChange={props.onFollowSetting}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
