# Watch Together rewrite plan

This is the spec for rewriting the extension and backend from scratch. It is
the source of truth for how the new code is built.

The old extension is the reference for **what the product does and how it
looks**: its features, user flows, popup screens, copy and styles. Read it for
that. Do not carry over **how it was built**: its implementation, file names,
module structure, message names or conventions are outdated and are not a
guide. Where the old behavior and this spec differ, this spec wins.

## Goal

The same product with a much simpler, more reliable foundation:

- People watch videos together on their own devices, synced through shared
  rooms, on any site with an HTML5 video.
- WebSocket-only sync through Cloudflare (Workers + Durable Objects). No WebRTC.
- Predictable behavior during playback, reconnects, tab changes and video
  navigation, proven by browser tests.
- No playback-activation prompt.

## Architecture

```
popup (React) ──storage.session + messages──► background service worker ──WebSocket──► Room Durable Object
                                                   ▲                                    (one per room, authoritative)
                                       port per frame │
                                    content script in every frame (finds the video, applies state, reports user actions, overlay)
```

- **Server is the source of truth.** Clients send intents; the room validates
  them, applies them and broadcasts the whole room. Clients never patch state
  locally and never talk to each other.
- **Background service worker** owns the socket, the session, the synced tab,
  and turns local video events into intents.
- **Content script** runs in every frame. It owns everything that touches a
  `<video>`: detection, applying state, echo suppression, reporting user
  actions, and the overlay.
- **Popup** only renders state and sends actions.

## Protocol (done, `packages/protocol`)

```
client → server  join{name, resume?, room?}
                 playback{url, title?, playing, position, rate}
                 mode{mode: host|everyone}   rename{target: room|self, name}   leave
                 "ping" text frame (answered "pong" without waking the room)
server → client  welcome{you, resume, room, now}   room{room, now}   error{code, message}

Room     {id, name, host, mode, members[{id, name, online, joined}], playback, seq}
Playback {url, title, playing, position, rate, at}   // position is true at server time `at`
```

- `position(playback, now)` gives where playback should be at server time `now`.
- Connect to `wss://<backend>/rooms/<roomId>`; room ids match `ROOM_ID`.
- Join-or-create: the first joiner creates the room and becomes host.
- Server-side permissions: in `host` mode only the host may send `playback`.
  In `everyone` mode anyone may play, pause, seek or change rate on the
  current video. Only the host may change `url`, rename the room or change mode.
- Resume: keep `resume` from `welcome`. A dropped member keeps their seat and
  host role for `GRACE_MS` (30 s). Rejoining with `resume` restores both and
  closes any older socket for that member (close code 4000). `leave` hands
  host to the longest-present online member immediately.
- Empty rooms keep their settings for 30 minutes, then are deleted.
- Allowed protocol additions in later milestones, if needed: an optional
  `duration` on playback for the popup's progress bar. Keep changes additive
  and tested in `apps/backend`.

## Behavior

### The synced tab and following the host

**The room follows the last video the host plays with sound in the tab
they're on.**

- Each person has at most one **synced tab**. Playback commands only ever
  touch that tab. Other tabs are never affected and never affect the room.
- **Host:** when a video starts playing, unmuted (`!muted && volume > 0`), in
  the active tab of the focused window, that tab becomes the host's synced
  tab. If its URL differs from the room's, the host sends a `playback` intent
  with the new `url` and `title`. Muted autoplay (hover previews, feeds),
  background tabs and pages without video never move the room.
- **Followers:** when the room's `url` changes:
  - Auto-follow on: navigate the follower's synced tab to the new URL. If they
    have none, open one new tab and make it their synced tab. Reuse that tab
    for every later switch; never open a tab per switch.
  - Auto-follow off: show the Follow banner in the popup and overlay. "Follow"
    and "Go to host's video" are the same action.
- A follower's synced tab can also be picked by playing the room's current
  video with sound in the foreground (for example after opening the share
  link themselves).
- The tab where you create or join a room becomes your synced tab if it has a
  video.
- No Undo button. If the host moves the room by accident, playing the old tab
  again moves it back. The host sees a short "Room moved to _title_" note.
- No tab groups.

### URL matching

Compare videos by a normalized key, never the raw URL:

- YouTube: the `v` parameter (`youtube.com/watch?v=`, `youtu.be/`, shorts).
- Everything else: origin + path + query without tracking and position
  parameters (`utm_*`, `t`, `si`, `feature`, `fbclid`, `wt_room`).

### Sync

- **Server time:** on every `welcome`/`room` message, sample
  `offset = now - Date.now()`; keep the sample from the lowest-latency message
  (for example the max over a sliding window). `serverNow = Date.now() + offset`.
- **Applying state** (content script, synced tab only, and only when the
  page's video key matches the room's):
  - Match `playing` with `play()`/`pause()`, and `rate` with `playbackRate`.
  - Seek to `position(playback, serverNow)` when the difference is more than
    1 s. While playing, recheck drift every 2 s. Ignore smaller drift.
- **Echo suppression lives next to the video:** when the content script
  applies state, it records the state it expects. Media events that match
  that expected state within about 1 s are not reported. Every other
  play/pause/seeked/ratechange is a user action and is reported.
- **Reporting:** user actions in the synced tab become `playback` intents.
  The host's report includes the current URL and title. A `forbidden` reply
  (participant acting in host-only mode) re-applies the room's state
  (snap-back).
- `ended` is reported as a pause at the end position.

### Autoplay without a prompt

There is no extension API that grants user activation, so `play()` can be
refused on a tab the user hasn't touched (mostly tabs opened by following).
When `play()` rejects with `NotAllowedError`:

- Keep the room playing. Mark this member "blocked" in the overlay and popup
  ("Press play to catch up").
- Retry once on the next `pointerdown` or `keydown` in that page.
- Never show a modal or an injected prompt, and never mute to force playback.

### Connection lifecycle

- Background sends `"ping"` every 20 s while in a room. This keeps the MV3
  service worker alive and detects dead sockets.
- Reconnect with backoff of 1, 2, 4, 8, then every 15 s. Never give up while
  in a room. Always rejoin with `resume`.
- Session (`roomId`, `resume`, `you`, synced tab id) lives in
  `chrome.storage.session`. A restarted service worker reconnects and resumes.
  Never leave a room because the worker was suspended.
- Leaving is explicit: the Leave button or the popup's back arrow.

### Share links and auto-join

- The share link is the host's current video URL plus `wt_room=<roomId>`.
  When no video is detected, copy the room code instead. There is no setting
  for this.
- The background watches navigations (`webNavigation`) for `wt_room`. If
  auto-join is on, it joins with the default name, makes that tab the synced
  tab, and strips the parameter with `history.replaceState` through
  `chrome.scripting`. No `document_start` content script.

### Frames

- The content script runs in all frames (`all_frames: true`). Each frame
  connects a port, so the background tracks players by `(tabId, frameId)`.
- In a tab, the player is the frame with the largest visible video.
  Commands go only to that frame.
- Rebind when the page replaces its `<video>` element (MutationObserver
  scoped to video additions and removals) and on SPA navigation
  (`webNavigation.onHistoryStateUpdated` from the background, since the
  content script's isolated world can't see page `pushState`).

### Overlay

A small status pill inside the synced video's player, in a shadow root.
When the page is fullscreen, it is attached inside `document.fullscreenElement`.

- Shows who you're synced with, the member count and the connection state.
- Shows short notes: "Josh paused", "Josh switched videos", "Reconnecting…",
  "Press play to catch up".
- Fades out after 3 s like player controls. It stays visible while there's a
  problem (reconnecting, blocked) and on hover.
- On a tab that has the room's video but isn't synced: "Not synced · Sync this
  tab".

### Badge

Member count while in a room. Green when connected, amber when reconnecting,
red on error, empty outside a room.

## Popup (same look as today)

- **Home:** create room (uses defaults), join by code, the 2 most recent rooms
  with Rejoin, a settings gear.
- **Room:**
  - Header: back arrow (leaves the room) and a menu with Settings only.
  - Room name, which the host can edit inline.
  - Copy share link or room code.
  - Go to host's video.
  - Now playing: title, play state, time and progress.
  - Members with a crown on the host. You can edit your own name.
  - Host: control mode toggle (Host only / Everyone). Others: a badge.
  - Followers: follow toggle, a "Following _name_" line, and the Follow banner
    when auto-follow is off.
  - Sync status and a "Sync this tab" fallback button.
  - Leave.
- **Settings:** default name, default room name, default control mode (applied
  only when you create a room, by sending `mode` right after `welcome`),
  auto-follow host, auto-join from links.
- **Removed:** the Show notifications, Background sync and Enhanced URLs
  toggles, and the Report issue and Donate menu items. Only errors show
  toasts.
- Data flow: the popup renders from one `chrome.storage.session` key
  (`view`) and listens with `storage.onChanged`. Actions go through one
  `chrome.runtime.sendMessage({type: "action", ...})`, which returns
  `{ok, error?}`.
- Recent rooms (last 10) and settings live in `chrome.storage.local`.

## Decisions log

| Decision                    | Choice                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| Transport                   | WebSocket only, Cloudflare Durable Object per room                    |
| Host role on drop           | Kept for 30 s grace, then oldest online member                        |
| Control mode on host change | Stays with the room                                                   |
| Synced tabs                 | Exactly one per person; no multi-tab sync                             |
| Follow rule                 | Last video the host plays with sound in their foreground tab          |
| Undo button                 | None, replaying the old tab moves the room back                       |
| Tab groups                  | Not used                                                              |
| Settings removed            | Notifications, Background sync, Enhanced URLs                         |
| Menu removed                | Report issue, Donate                                                  |
| Activation prompt           | None, blocked playback is shown as status and retried on next gesture |
| Site support                | Generic HTML5 video in all frames; site-specific adapters later       |
| Browsers                    | Chrome first; WXT keeps a Firefox build possible later                |

## Code layout

- `packages/protocol`: wire types, validation, `position()`. Shared.
- `apps/backend`: Worker + `Room` Durable Object (done).
- `apps/extension`: rebuilt with WXT (Manifest V3), React + Tailwind popup.
  Suggested modules: `background/` (socket, session, tabs, follow), `content/`
  (video, sync, overlay), `popup/`, `lib/` (url keys, clock).
- Follow `CLAUDE.md`: Conventional Commits, small single-purpose functions only
  when reused, no needless destructuring, avoid `else`, `let`, `any` and
  `try`/`catch` where possible, short names.

## Testing

- **Pure logic (Vitest):** URL keys, clock offset, drift decisions, echo
  matching, follow decisions.
- **Backend (`@cloudflare/vitest-pool-workers`):** real Durable Object over
  real WebSockets (exists, extend as the protocol grows).
- **End to end (Playwright):**
  - Load the built extension with `chromium.launchPersistentContext` using
    `channel: "chromium"` (works headless in this environment).
  - One persistent context per user, against `wrangler dev` on port 8787.
  - A local static fixture site with a generated test video (ffmpeg test
    pattern with a tone, so it is audible). Include an iframe-embedded
    variant and an SPA variant that swaps its `<video>` element.
  - Assert on `video.currentTime` and `paused` across contexts within a
    tolerance.
- **Scenarios that must pass:**
  - Play, pause, seek and rate in both control modes, and host-only snap-back.
  - Late joiner mid-playback.
  - Host switches video in the same tab, then in a new tab. Followers'
    synced tab is reused.
  - Muted autoplay elsewhere does not move the room.
  - Socket killed, backend restarted, and service worker stopped (via the
    DevTools protocol): everyone resumes and the host keeps the role within
    grace.
  - Host leaves, so the host role moves.
  - Share-link auto-join.
  - Blocked autoplay shows status and recovers on the next click.

## Milestones

Each milestone is one PR into `main`, merged in order, with tests. Each PR is
delivered with **video evidence**: a Playwright recording (two browsers side
by side where relevant), converted to mp4 and posted in the project thread.

1. **Room server** (done, PR #5).
2. **Extension core:**
   - WXT scaffold.
   - Background: socket, session, resume, keepalive, reconnect.
   - Content script: video detection per frame, applying state, echo
     suppression, reporting.
   - A minimal temporary popup (create/join/leave) is fine.
   - The e2e harness and the sync scenarios.
   - Ship the backend and extension together from here.
3. **Popup:** port the existing look and the features listed above. Settings.
   Recent rooms.
4. **Following and visibility:** the follow rule, synced tab reuse, share
   links and auto-join, the overlay, badge states, blocked-autoplay handling,
   and the matching e2e scenarios.
5. **Cleanup:**
   - Delete the old extension code, `packages/adapters`, `packages/types`,
     the old tests, `docs/webext.md`, `specs/`, `test-runner.js` and
     `terragon-setup.sh`.
   - Update the README and CLAUDE.md.
