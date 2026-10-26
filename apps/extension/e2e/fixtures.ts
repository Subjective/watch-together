import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Frame,
  type Page,
  type Worker,
} from "@playwright/test";
import type { View } from "../src/lib/messages";
import { SITE, backend, proxy, site } from "./servers";

/** The extension API inside `worker.evaluate` callbacks. */
declare const chrome: typeof import("wxt/browser").browser;

const EXTENSION = resolve(import.meta.dirname, "../.output/chrome-mv3");

/** Allowed difference in seconds between two synced videos. */
export const TOLERANCE = 1;

export interface Media {
  time: number;
  paused: boolean;
  rate: number;
}

/** One person: their own browser profile with the extension loaded. */
export class User {
  page!: Page;
  private panel: Page | null = null;

  constructor(
    readonly name: string,
    readonly context: BrowserContext,
  ) {}

  /** The service worker, which is a new object after a restart. */
  async worker(): Promise<Worker> {
    return (
      this.context.serviceWorkers()[0] ??
      (await this.context.waitForEvent("serviceworker"))
    );
  }

  async id() {
    return new URL((await this.worker()).url()).host;
  }

  async open(path: string) {
    this.page ??= this.context.pages()[0] ?? (await this.context.newPage());
    if (process.env.DEBUG_SW)
      this.page.on("console", (line) => {
        if (line.text().startsWith("wt ")) console.log(this.name, line.text());
      });
    await this.page.goto(`${SITE}/${path}`);
    await this.label(this.name);
    await this.ready();
    return this.page;
  }

  /** Wait until the player has metadata and the content script saw it. */
  async ready() {
    const frame = await this.player();
    await frame.waitForFunction(() => {
      const video = document.getElementById("player") as HTMLVideoElement;
      return video !== null && video.readyState >= 1;
    });
    await this.page.waitForTimeout(300);
  }

  async label(text: string) {
    await this.page.evaluate((value) => {
      document.getElementById("label")!.textContent = value;
    }, text);
  }

  async caption(text: string) {
    await this.page.evaluate((value) => {
      document.getElementById("caption")!.textContent = value;
    }, text);
  }

  /** The frame holding `#player`, which may be an iframe. */
  async player(): Promise<Frame> {
    for (const frame of this.page.frames()) {
      const found = await frame
        .evaluate(() => document.getElementById("player") !== null)
        .catch(() => false);
      if (found) return frame;
    }
    throw new Error("No player on the page");
  }

  /** The popup, opened in its own window like a real action popup. */
  async popup(): Promise<Page> {
    if (this.panel && !this.panel.isClosed()) return this.panel;
    const id = await this.id();
    const opened = this.context.waitForEvent("page");
    await (
      await this.worker()
    ).evaluate((url) => {
      chrome.windows.create({ url, type: "popup", width: 380, height: 640 });
    }, `chrome-extension://${id}/popup.html`);
    this.panel = await opened;
    await this.panel.waitForLoadState();
    return this.panel;
  }

  async create(): Promise<string> {
    const popup = await this.popup();
    await popup.getByTestId("name").fill(this.name);
    await popup.getByTestId("create").click();
    await expect(popup.getByTestId("status")).toHaveText("Connected");
    return (await popup.getByTestId("room-code").textContent())!;
  }

  async join(code: string) {
    const popup = await this.popup();
    await popup.getByTestId("name").fill(this.name);
    await popup.getByTestId("code").fill(code);
    await popup.getByTestId("join").click();
    await expect(popup.getByTestId("status")).toHaveText("Connected");
  }

  async view(): Promise<View> {
    const worker = await this.worker();
    return worker.evaluate(
      async () => (await chrome.storage.session.get("view")).view as View,
    );
  }

  async media(): Promise<Media> {
    const frame = await this.player();
    return frame.evaluate(() => {
      const video = document.getElementById("player") as HTMLVideoElement;
      return {
        time: video.currentTime,
        paused: video.paused,
        rate: video.playbackRate,
      };
    });
  }

  /** Act on the player like the person would, through the page itself. */
  async play() {
    const frame = await this.player();
    await frame.evaluate(() =>
      (document.getElementById("player") as HTMLVideoElement).play(),
    );
  }

  async pause() {
    const frame = await this.player();
    await frame.evaluate(() =>
      (document.getElementById("player") as HTMLVideoElement).pause(),
    );
  }

  async seek(time: number) {
    const frame = await this.player();
    await frame.evaluate((value) => {
      (document.getElementById("player") as HTMLVideoElement).currentTime =
        value;
    }, time);
  }

  async rate(rate: number) {
    const frame = await this.player();
    await frame.evaluate((value) => {
      (document.getElementById("player") as HTMLVideoElement).playbackRate =
        value;
    }, rate);
  }

  /**
   * Stop the service worker the way Chrome does when it goes idle, and wait
   * until a fresh instance (with none of the old memory) is running.
   */
  async suspend() {
    const worker = await this.worker();
    await worker.evaluate(() => {
      (self as unknown as { stale: boolean }).stale = true;
    });
    const session = await this.context.newCDPSession(this.page);
    await session.send("ServiceWorker.enable");
    await session.send("ServiceWorker.stopAllWorkers");
    await session.detach();
    await expect
      .poll(() =>
        worker
          .evaluate(() => (self as unknown as { stale?: boolean }).stale)
          .catch(() => true),
      )
      .toBeUndefined();
  }
}

/** Wait until every user's video matches the first one's. */
export async function synced(users: User[], expected: Partial<Media> = {}) {
  await expect
    .poll(
      async () => {
        const all = await Promise.all(users.map((user) => user.media()));
        const first = all[0];
        const slack = TOLERANCE + (first.paused ? 0 : 3);
        const ok =
          (expected.paused === undefined || first.paused === expected.paused) &&
          (expected.rate === undefined || first.rate === expected.rate) &&
          (expected.time === undefined ||
            Math.abs(first.time - expected.time) <= slack) &&
          all.every(
            (media) =>
              media.paused === first.paused &&
              media.rate === first.rate &&
              Math.abs(media.time - first.time) <= TOLERANCE,
          );
        // The last mismatch is what a failure prints
        return ok ? "synced" : JSON.stringify({ expected, all });
      },
      { timeout: 15_000, intervals: [250] },
    )
    .toBe("synced");
}

interface Servers {
  kill(): void;
  restart(): Promise<void>;
}

export const test = base.extend<
  { users: (...names: string[]) => Promise<User[]> },
  { servers: Servers }
>({
  servers: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const web = await site();
      const tunnel = await proxy();
      const server = await backend();
      await use({ kill: tunnel.kill, restart: server.restart });
      await server.stop();
      tunnel.close();
      web.close();
    },
    { scope: "worker" },
  ],
  users: async ({ servers }, use, info) => {
    void servers;
    const contexts: BrowserContext[] = [];
    await use(async (...names) =>
      Promise.all(
        names.map(async (name) => {
          const context = await chromium.launchPersistentContext(
            mkdtempSync(join(tmpdir(), "wt-")),
            {
              channel: "chromium",
              headless: !process.env.HEADED,
              viewport: { width: 680, height: 520 },
              recordVideo: process.env.RECORD
                ? {
                    dir: info.outputPath("videos", name),
                    size: { width: 680, height: 520 },
                  }
                : undefined,
              args: [
                `--disable-extensions-except=${EXTENSION}`,
                `--load-extension=${EXTENSION}`,
                "--autoplay-policy=no-user-gesture-required",
              ],
            },
          );
          contexts.push(context);
          const user = new User(name, context);
          const worker = await user.worker();
          if (process.env.DEBUG_SW)
            worker.on("console", (line) => console.log(name, line.text()));
          return user;
        }),
      ),
    );
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };
