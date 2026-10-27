import type { ReactNode } from "react";
import { Crown, Eye, Settings as Gear, User } from "lucide-react";
import { LIMITS } from "@repo/protocol";
import { DEFAULTS, type Settings as Values } from "../lib/settings";
import { Header, Switch } from "./ui";

function Card(props: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {props.icon}
        {props.title}
      </h2>
      <p className="mb-4 text-sm text-slate-500">{props.hint}</p>
      <div className="space-y-4">{props.children}</div>
    </section>
  );
}

function Toggle(props: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{props.title}</p>
        <p className="text-xs text-slate-500">{props.hint}</p>
      </div>
      <Switch
        label={props.title}
        checked={props.checked}
        onChange={props.onChange}
      />
    </div>
  );
}

function Field(props: {
  id: string;
  title: string;
  hint: string;
  placeholder: string;
  max: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-2 block text-sm font-medium">
        {props.title}
      </label>
      <input
        id={props.id}
        data-testid={props.id}
        value={props.value}
        maxLength={props.max}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
      />
      <p className="mt-1 text-xs text-slate-500">{props.hint}</p>
    </div>
  );
}

const MODES = [
  {
    mode: "everyone",
    title: "Free for All",
    hint: "All participants can control playback",
  },
  {
    mode: "host",
    title: "Host Only",
    hint: "Only the host can control playback",
  },
] as const;

export function Settings(props: {
  settings: Values;
  onChange: (settings: Values) => void;
  onBack: () => void;
}) {
  const values = props.settings;
  const set = (patch: Partial<Values>) =>
    props.onChange({ ...values, ...patch });

  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" back="Back" onBack={props.onBack} />
      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        <Card
          icon={<User className="h-5 w-5" />}
          title="Profile"
          hint="Customize your display name and default room settings"
        >
          <Field
            id="default-name"
            title="Default Name"
            hint="This name will be used when joining rooms"
            placeholder="Enter your display name"
            max={LIMITS.userName}
            value={values.name}
            onChange={(name) => set({ name })}
          />
          <Field
            id="default-room"
            title="Default Room Name"
            hint="This name will be used when creating new rooms"
            placeholder="My Room"
            max={LIMITS.roomName}
            value={values.room}
            onChange={(room) => set({ room })}
          />
        </Card>

        <Card
          icon={<Crown className="h-5 w-5" />}
          title="Host Settings"
          hint="Configure default behavior when hosting rooms"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Default Control Mode
            </legend>
            <div className="space-y-2">
              {MODES.map((option) => (
                <label
                  key={option.mode}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="mode"
                    data-testid={`default-mode-${option.mode}`}
                    checked={values.mode === option.mode}
                    onChange={() => set({ mode: option.mode })}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {option.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card
          icon={<Eye className="h-5 w-5" />}
          title="Participant Settings"
          hint="Configure behavior when joining rooms as a participant"
        >
          <Toggle
            title="Auto-follow Host"
            hint="Automatically follow the host to new videos"
            checked={values.follow}
            onChange={(follow) => set({ follow })}
          />
        </Card>

        <Card
          icon={<Gear className="h-5 w-5" />}
          title="General"
          hint="General app preferences and behavior"
        >
          <Toggle
            title="Auto-join with Links"
            hint="Automatically join rooms when clicking shared links"
            checked={values.join}
            onChange={(join) => set({ join })}
          />
        </Card>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Reset Settings</h2>
          <p className="mb-4 text-sm text-slate-500">
            Restore all settings to their default values
          </p>
          <button
            data-testid="reset"
            onClick={() => props.onChange(DEFAULTS)}
            className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Reset All Settings
          </button>
        </section>
      </main>
    </div>
  );
}
