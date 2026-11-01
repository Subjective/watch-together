import { useEffect, useState, type ReactNode } from "react";

const COLORS = [
  "bg-slate-700",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-600",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-lime-600",
  "bg-pink-500",
];

/** A colored initial; the color sticks to the name. */
export function Avatar(props: {
  name: string;
  dim?: boolean;
  className?: string;
}) {
  const hash = [...props.name].reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${COLORS[hash % COLORS.length]} ${props.dim ? "opacity-40" : ""} ${props.className ?? "h-8 w-8 text-sm"}`}
    >
      {props.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Square icon button: white with a border, or filled with `tone`. */
export function Icon(props: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: string;
  pressed?: boolean;
  testid?: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      data-testid={props.testid}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm transition duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-green-300 enabled:active:scale-90 disabled:cursor-default ${
        props.tone ??
        "border border-slate-200 bg-white enabled:hover:bg-slate-50"
      }`}
    >
      {props.children}
    </button>
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
      className={`min-w-0 rounded-md border border-slate-300 bg-white px-1 outline-none focus:ring-2 focus:ring-green-200 ${props.className ?? ""}`}
    />
  );
}

/** A delay between `low` and `high` ms. */
function jitter(low: number, high: number) {
  return low + Math.random() * (high - low);
}

/**
 * How long until the next keystroke, like a person typing: an uneven pace,
 * a beat after spaces, the odd hesitation, then holding backspace, which
 * waits before it repeats.
 */
function pause(text: string, count: number, erasing: boolean) {
  // One press, the key-repeat delay, then fast repeats
  if (erasing && count === text.length) return 220;
  if (erasing) return count === text.length - 1 ? 420 : jitter(32, 55);
  if (count === text.length) return 2600;
  if (count === 0) return 700;
  const hesitate = Math.random() < 0.12 ? jitter(150, 320) : 0;
  const space = text[count - 1] === " " ? jitter(60, 140) : 0;
  return jitter(55, 140) + space + hesitate;
}

/**
 * Types `text` out like a person, holds it under a blinking caret, then
 * backspaces it and starts over. While `still`, it shows the whole text like
 * a placeholder.
 */
export function Typing(props: {
  text: string;
  still?: boolean;
  className?: string;
}) {
  const length = props.text.length;
  const [count, setCount] = useState(0);
  const [erasing, setErasing] = useState(false);
  const calm =
    props.still || matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (calm) {
      setErasing(false);
      setCount(length);
      return;
    }
    const timer = setTimeout(
      () => {
        if (erasing && count === 0) return setErasing(false);
        if (erasing) return setCount(count - 1);
        if (count === length) return setErasing(true);
        setCount(count + 1);
      },
      pause(props.text, count, erasing),
    );
    return () => clearTimeout(timer);
  }, [calm, count, erasing, length, props.text]);
  const moving = !calm && count > 0 && count < length;
  return (
    <span aria-hidden className={`whitespace-pre ${props.className ?? ""}`}>
      {props.text.slice(0, calm ? length : count)}
      {!props.still && <span className={`caret ${moving ? "" : "blink"}`} />}
    </span>
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
      className="enter fixed inset-x-4 bottom-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg"
    >
      {props.error}
    </div>
  );
}
