import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        props.checked ? "bg-slate-900" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          props.checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export function Header(props: {
  title: string;
  onBack: () => void;
  back: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
      <button
        aria-label={props.back}
        title={props.back}
        onClick={props.onBack}
        className="rounded-lg p-1 hover:bg-slate-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="flex-1 text-lg font-semibold">{props.title}</h1>
      {props.children}
    </header>
  );
}

/** Text that turns into an input on click; Enter saves, Escape cancels. */
export function Editable(props: {
  value: string;
  max: number;
  label: string;
  editable: boolean;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!props.editable || draft === null) {
    return (
      <button
        disabled={!props.editable}
        title={props.editable ? props.label : undefined}
        aria-label={props.editable ? props.label : undefined}
        onClick={() => setDraft(props.value)}
        className={`min-w-0 truncate text-left enabled:cursor-text enabled:hover:underline enabled:decoration-dotted enabled:underline-offset-4 ${props.className ?? ""}`}
      >
        {props.value}
      </button>
    );
  }
  const commit = () => {
    const value = draft.trim();
    setDraft(null);
    if (value && value !== props.value) props.onSave(value);
  };
  return (
    <input
      autoFocus
      aria-label={props.label}
      value={draft}
      maxLength={props.max}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
      className={`min-w-0 rounded-md border border-slate-300 bg-white px-1 outline-none focus:ring-2 focus:ring-blue-200 ${props.className ?? ""}`}
    />
  );
}

/** Errors are the only toasts. */
export function Toast(props: { error: string | null; onDone: () => void }) {
  const done = props.onDone;
  useEffect(() => {
    if (!props.error) return;
    const timer = setTimeout(done, 4000);
    return () => clearTimeout(timer);
  }, [props.error, done]);
  if (!props.error) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg"
    >
      {props.error}
    </div>
  );
}
