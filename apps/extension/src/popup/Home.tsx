import { useState } from "react";
import { ArrowRight, Plus, RotateCcw, User } from "lucide-react";
import { LIMITS } from "@repo/protocol";
import { DEFAULTS, type Recent } from "../lib/settings";
import { Avatar, Editable, Icon } from "./ui";

function ago(at: number) {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 60 / 24)}d ago`;
}

export function Home(props: {
  name: string;
  recent: Recent[];
  busy: boolean;
  onName: (name: string) => void;
  onCreate: () => void;
  onJoin: (room: string, resume?: string) => void;
}) {
  const [code, setCode] = useState("");
  const join = () => code.trim() && props.onJoin(code.trim());
  const guest = props.name === DEFAULTS.name;

  return (
    <main className="space-y-3 p-4">
      <header className="flex items-center gap-2 px-1 pb-1">
        <img src="/icons/icon-128.png" alt="" className="h-7 w-7" />
        <h1 className="flex-1 text-lg font-bold">Watch Together</h1>
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 py-1 pr-3 pl-1">
          {guest ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200">
              <User className="h-3.5 w-3.5 text-slate-500" />
            </span>
          ) : (
            <Avatar name={props.name} className="h-6 w-6 text-xs" />
          )}
          <Editable
            value={props.name}
            max={LIMITS.userName}
            label="Edit your name"
            editable
            onSave={props.onName}
            className="max-w-28 text-sm font-medium"
          />
        </div>
      </header>

      <label className="flex cursor-text items-center gap-2 rounded-2xl border-2 border-green-200 bg-green-50 p-2 pl-4 focus-within:border-green-300">
        <input
          data-testid="code"
          value={code}
          disabled={props.busy}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && join()}
          placeholder="Room code"
          className="min-w-0 flex-1 bg-transparent text-sm text-green-900 outline-none placeholder:text-green-700/60"
        />
        <Icon
          label="Join room"
          testid="join"
          onClick={join}
          disabled={!code.trim() || props.busy}
          tone="bg-green-500 enabled:hover:bg-green-600 disabled:opacity-50"
        >
          <ArrowRight className="h-4 w-4 text-white" />
        </Icon>
      </label>

      {props.recent.length > 0 && (
        <ul className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-2">
          {props.recent.slice(0, 2).map((room) => (
            <li
              key={room.id}
              data-testid="recent"
              className="flex items-center gap-3 rounded-xl px-2 py-2"
            >
              <span title={room.host}>
                <Avatar name={room.host || "?"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{room.name}</p>
                <p className="text-xs text-slate-500">{ago(room.at)}</p>
              </div>
              <Icon
                label={`Rejoin ${room.name}`}
                testid="rejoin"
                disabled={props.busy}
                onClick={() => props.onJoin(room.id, room.resume)}
              >
                <RotateCcw className="h-4 w-4" />
              </Icon>
            </li>
          ))}
        </ul>
      )}

      <button
        data-testid="create"
        disabled={props.busy}
        onClick={props.onCreate}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111214] font-semibold text-white hover:bg-black disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        Create room
      </button>
    </main>
  );
}
