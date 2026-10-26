import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { position } from "@repo/protocol";
import { IDLE, type Action, type Reply, type View } from "../lib/messages";

function act(action: Action): Promise<Reply> {
  return browser.runtime.sendMessage({ type: "action", action });
}

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const STATUS: Record<View["status"], string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
};

/**
 * Temporary popup for milestone 2: create, join and leave a room, and see
 * what the room is doing. It only renders the view and sends actions.
 */
export function App() {
  const [view, setView] = useState<View>(IDLE);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    browser.storage.session
      .get("view")
      .then((stored) => setView((stored.view as View) ?? IDLE));
    browser.storage.local
      .get("name")
      .then((stored) => setName((stored.name as string) ?? "Guest"));
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if ("view" in changes) setView((changes.view.newValue as View) ?? IDLE);
    };
    browser.storage.session.onChanged.addListener(listener);
    const timer = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => {
      browser.storage.session.onChanged.removeListener(listener);
      clearInterval(timer);
    };
  }, []);

  async function run(action: Action) {
    const reply = await act(action);
    setError(reply.ok ? null : (reply.error ?? "Something went wrong"));
  }

  function rename(value: string) {
    setName(value);
    browser.storage.local.set({ name: value });
  }

  const room = view.room;
  const shown = error ?? view.error;

  if (!room) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <header>
          <h1 className="text-2xl font-bold">Watch Together</h1>
          <p className="text-sm text-zinc-500">
            Synchronized video watching with friends
          </p>
        </header>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <input
            data-testid="name"
            className="rounded-xl border border-zinc-200 px-3 py-2"
            value={name}
            onChange={(event) => rename(event.target.value)}
          />
        </label>
        <button
          data-testid="create"
          className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          onClick={() => run({ kind: "create", name: name.trim() || "Guest" })}
        >
          Create room
        </button>
        <div className="flex gap-2 rounded-2xl border-2 border-green-200 bg-green-50/80 p-3">
          <input
            data-testid="code"
            className="min-w-0 flex-1 bg-transparent font-semibold text-green-800 outline-none placeholder:text-green-600/70"
            placeholder="Enter room code to join..."
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            data-testid="join"
            className="rounded-xl bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            disabled={!code.trim()}
            onClick={() =>
              run({ kind: "join", room: code, name: name.trim() || "Guest" })
            }
          >
            Join
          </button>
        </div>
        {shown && <p className="text-sm text-red-600">{shown}</p>}
      </main>
    );
  }

  const host = room.host === view.you;
  const playback = room.playback;
  const now = position(playback, Date.now() + view.offset);

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 data-testid="room-name" className="truncate text-xl font-bold">
            {room.name}
          </h1>
          <button
            data-testid="room-code"
            className="font-mono text-sm text-zinc-500 hover:text-zinc-800"
            onClick={() => navigator.clipboard.writeText(room.id)}
            title="Copy room code"
          >
            {room.id}
          </button>
        </div>
        <span
          data-testid="status"
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            view.status === "connected"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {STATUS[view.status]}
        </span>
      </header>

      <section className="rounded-2xl border border-zinc-200 p-3">
        <p className="text-xs font-medium uppercase text-zinc-500">
          Now playing
        </p>
        <p data-testid="title" className="truncate font-semibold">
          {playback.title ?? playback.url ?? "Nothing yet"}
        </p>
        <p className="text-sm text-zinc-500">
          {playback.playing ? "Playing" : "Paused"} · {clock(now)}
          {playback.rate === 1 ? "" : ` · ${playback.rate}x`}
        </p>
        {view.blocked && (
          <p className="text-sm text-amber-700">Press play to catch up</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          {view.synced ? `Synced tab: ${view.synced.title}` : "No synced tab"}
        </p>
        <button
          data-testid="sync"
          className="mt-2 rounded-xl border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50"
          onClick={() => run({ kind: "sync" })}
        >
          Sync this tab
        </button>
      </section>

      <section>
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
          Members
        </p>
        <ul data-testid="members" className="flex flex-col gap-1">
          {room.members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${member.online ? "bg-green-500" : "bg-zinc-300"}`}
              />
              <span>{member.name}</span>
              {member.id === room.host && <span title="Host">👑</span>}
              {member.id === view.you && (
                <span className="text-zinc-400">(you)</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-between text-sm">
        <span>Control</span>
        {host ? (
          <div className="flex rounded-xl bg-zinc-100 p-1">
            {(["host", "everyone"] as const).map((mode) => (
              <button
                key={mode}
                data-testid={`mode-${mode}`}
                className={`rounded-lg px-3 py-1 ${room.mode === mode ? "bg-white shadow-sm" : "text-zinc-500"}`}
                onClick={() => run({ kind: "mode", mode })}
              >
                {mode === "host" ? "Host only" : "Everyone"}
              </button>
            ))}
          </div>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
            {room.mode === "host" ? "Host only" : "Everyone"}
          </span>
        )}
      </section>

      {shown && <p className="text-sm text-red-600">{shown}</p>}

      <button
        data-testid="leave"
        className="rounded-2xl border border-red-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
        onClick={() => run({ kind: "leave" })}
      >
        Leave room
      </button>
    </main>
  );
}
