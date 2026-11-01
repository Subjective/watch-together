import type { Offer, Overlay } from "../lib/overlay";

/** How long the pill stays after it was last needed, like player controls. */
const FADE_MS = 3000;

const STYLE = `
:host { all: initial; }
.pill {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 12px 0 10px;
  border-radius: 999px;
  background: rgba(17, 18, 20, 0.78);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  color: #fff;
  font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
  transform-origin: top left;
  transition: opacity 250ms ease, transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 300ms ease;
  pointer-events: none;
}
.pill[data-visible="true"] { opacity: 1; transform: none; pointer-events: auto; }
.pill.offer { padding-right: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex: none; transition: background-color 300ms ease; }
.pill[data-warn="true"] .dot { background: #f59e0b; }
.text { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.count { display: flex; align-items: center; gap: 4px; opacity: 0.7; }
.count svg { width: 14px; height: 14px; }
button {
  all: unset;
  cursor: pointer;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff;
  color: #111214;
  font: 600 12px/24px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  transition: transform 150ms ease-out, background-color 150ms ease-out;
}
button:hover { transform: scale(1.04); background: #f1f5f9; }
button:active { transform: scale(0.94); }
button:focus-visible { outline: 2px solid #86efac; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .pill, .dot, button { transition-duration: 1ms; }
}
`;

/** lucide "users" */
const PEOPLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

const OFFERS = {
  sync: "Sync this tab",
  follow: "Follow",
  move: "Move room here",
};

/**
 * The status pill on the synced video, in a shadow root so the page's styles
 * can't reach it. It sits over the video's top left corner, and inside the
 * fullscreen element when there is one.
 */
export function pill(
  video: () => HTMLVideoElement | null,
  press: (offer: Offer) => void,
) {
  const host = document.createElement("watch-together-overlay");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${STYLE}</style><div class="pill" data-testid="pill"><span class="dot"></span><span class="text"></span><span class="count">${PEOPLE}<span></span></span><button></button></div>`;
  const box = root.querySelector<HTMLElement>(".pill")!;
  const text = root.querySelector<HTMLElement>(".text")!;
  const count = root.querySelector<HTMLElement>(".count span")!;
  const button = root.querySelector<HTMLButtonElement>("button")!;
  const state = {
    overlay: null as Overlay | null,
    timer: 0,
    hovered: false,
  };

  function show() {
    box.dataset.visible = "true";
    clearTimeout(state.timer);
    if (state.overlay?.warn || state.hovered) return;
    state.timer = window.setTimeout(() => {
      box.dataset.visible = "false";
    }, FADE_MS);
  }

  /** Follow the video every frame while there's a pill to show. */
  function place() {
    if (!state.overlay) {
      host.remove();
      return;
    }
    requestAnimationFrame(place);
    const target = video();
    if (!target) {
      host.remove();
      return;
    }
    const screen = document.fullscreenElement;
    const parent =
      screen && !(screen instanceof HTMLVideoElement) && screen.contains(target)
        ? screen
        : document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
    const rect = target.getBoundingClientRect();
    box.style.display = rect.width > 0 && rect.height > 0 ? "" : "none";
    box.style.left = `${Math.max(rect.left, 0) + 12}px`;
    box.style.top = `${Math.max(rect.top, 0) + 12}px`;
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.overlay?.offer) press(state.overlay.offer);
  });
  box.addEventListener("mouseenter", () => {
    state.hovered = true;
    show();
  });
  box.addEventListener("mouseleave", () => {
    state.hovered = false;
    show();
  });
  // Moving over the video brings the pill back, like its controls
  document.addEventListener(
    "mousemove",
    (event) => {
      const target = video();
      if (!state.overlay || !target) return;
      const rect = target.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (inside) show();
    },
    true,
  );

  return function set(overlay: Overlay | null) {
    const previous = state.overlay;
    state.overlay = overlay;
    if (!overlay) return;
    if (!previous) requestAnimationFrame(place);
    // A new line eases in rather than snapping
    if (text.textContent !== overlay.text && previous)
      text.animate(
        [
          { opacity: 0, transform: "translateY(2px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 200, easing: "ease-out" },
      );
    text.textContent = overlay.text;
    count.textContent = String(overlay.count);
    box.dataset.warn = String(overlay.warn);
    box.classList.toggle("offer", overlay.offer !== null);
    button.style.display = overlay.offer ? "" : "none";
    button.textContent = overlay.offer ? OFFERS[overlay.offer] : "";
    const fresh =
      !previous ||
      previous.id !== overlay.id ||
      previous.warn !== overlay.warn ||
      previous.offer !== overlay.offer;
    if (fresh) show();
  };
}
