import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { IDLE, type Action, type Reply, type View } from "../lib/messages";
import {
  DEFAULTS,
  type Recent,
  type Settings as Values,
} from "../lib/settings";
import { Home } from "./Home";
import { Room } from "./Room";
import { Toast } from "./ui";

/**
 * The popup only renders state and sends actions: the room comes from the
 * `view` key in storage.session, preferences and recent rooms from
 * storage.local.
 */
export function App() {
  const [view, setView] = useState<View>(IDLE);
  const [settings, setSettings] = useState<Values>(DEFAULTS);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    browser.storage.session
      .get("view")
      .then((stored) => setView((stored.view as View) ?? IDLE));
    browser.storage.local.get(["settings", "recent"]).then((stored) => {
      setSettings({ ...DEFAULTS, ...(stored.settings as Partial<Values>) });
      setRecent((stored.recent as Recent[] | undefined) ?? []);
    });
    const session = (changes: Record<string, { newValue?: unknown }>) => {
      if (!("view" in changes)) return;
      const next = (changes.view.newValue as View) ?? IDLE;
      setView(next);
      if (next.error) setError(next.error);
    };
    const local = (changes: Record<string, { newValue?: unknown }>) => {
      if ("recent" in changes)
        setRecent((changes.recent.newValue as Recent[] | undefined) ?? []);
      if ("settings" in changes)
        setSettings({
          ...DEFAULTS,
          ...(changes.settings.newValue as Partial<Values>),
        });
    };
    browser.storage.session.onChanged.addListener(session);
    browser.storage.local.onChanged.addListener(local);
    // Keeps the playback clock moving
    const timer = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => {
      browser.storage.session.onChanged.removeListener(session);
      browser.storage.local.onChanged.removeListener(local);
      clearInterval(timer);
    };
  }, []);

  async function run(action: Action) {
    setBusy(true);
    const reply: Reply = await browser.runtime.sendMessage({
      type: "action",
      action,
    });
    setBusy(false);
    if (!reply.ok) setError(reply.error ?? "Something went wrong");
  }

  function save(next: Values) {
    setSettings(next);
    browser.storage.local.set({ settings: next });
  }

  const clear = useCallback(() => setError(null), []);

  return (
    <div>
      {view.room ? (
        <Room
          view={view}
          settings={settings}
          run={run}
          onFollow={(follow) => save({ ...settings, follow })}
        />
      ) : (
        <Home
          name={settings.name}
          recent={recent}
          busy={busy}
          onName={(name) => save({ ...settings, name })}
          onCreate={() => run({ kind: "create" })}
          onJoin={(room, resume) => run({ kind: "join", room, resume })}
        />
      )}
      <Toast error={error} onDone={clear} />
    </div>
  );
}
