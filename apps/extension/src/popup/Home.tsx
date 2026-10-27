import { useState } from "react";
import { ArrowRight, Clock, Plus, Settings, Users } from "lucide-react";
import type { Recent } from "../lib/settings";

function ago(at: number) {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 60 / 24)}d ago`;
}

export function Home(props: {
  recent: Recent[];
  busy: boolean;
  onCreate: () => void;
  onJoin: (room: string, resume?: string) => void;
  onSettings: () => void;
}) {
  const [code, setCode] = useState("");
  const join = () => code.trim() && props.onJoin(code.trim());

  return (
    <main className="flex h-full flex-col p-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Watch Together</h1>
          <p className="text-sm text-slate-500">
            Synchronized video watching with friends
          </p>
        </div>
        <button
          aria-label="Settings"
          title="Settings"
          onClick={props.onSettings}
          className="rounded-xl p-2 hover:bg-slate-100"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Rooms</h2>
      <div className="space-y-3">
        <label className="flex cursor-text items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50/80 p-4 transition-colors hover:border-green-300 hover:bg-green-100/90">
          <ArrowRight className="h-4 w-4 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <input
              data-testid="code"
              value={code}
              disabled={props.busy}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && join()}
              placeholder="Enter room code to join..."
              className="w-full bg-transparent text-base font-semibold text-green-800 outline-none placeholder:text-green-700"
            />
            <p className="mt-1 text-sm text-green-600">Join an existing room</p>
          </div>
          <button
            data-testid="join"
            onClick={join}
            disabled={!code.trim() || props.busy}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Join
          </button>
        </label>

        {props.recent.slice(0, 2).map((room) => (
          <div
            key={room.id}
            data-testid="recent"
            className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{room.name}</p>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <span className="truncate">by {room.host}</span>
                <span>•</span>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0">{ago(room.at)}</span>
              </p>
            </div>
            <button
              data-testid="rejoin"
              disabled={props.busy}
              onClick={() => props.onJoin(room.id, room.resume)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
            >
              Rejoin
            </button>
          </div>
        ))}

        {props.recent.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <Users className="mb-2 h-8 w-8 text-slate-400" />
            <p className="font-medium text-slate-500">No recent rooms</p>
            <p className="text-xs text-slate-400">
              Rooms you&apos;ve joined will appear here
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <button
          data-testid="create"
          disabled={props.busy}
          onClick={props.onCreate}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-medium text-white shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-60"
        >
          <Plus className="h-5 w-5" />
          Create Room
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          Create or join a room to watch videos together
        </p>
      </div>
    </main>
  );
}
