import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, synced, test, type User } from "./fixtures";

/**
 * A narrated run for the milestone video. Only runs with RECORD=<output.mp4>,
 * and joins both people's recordings side by side.
 */
test.skip(!process.env.RECORD, "set RECORD=<output.mp4> to record the demo");

test("demo: two browsers stay in sync", async ({ users, servers }) => {
  test.setTimeout(240_000);
  const [alice, bob] = await users("Alice", "Bob");
  const pause = (ms = 1500) => alice.page.waitForTimeout(ms);
  const say = async (text: string) => {
    await Promise.all([alice.caption(text), bob.caption(text)]);
  };
  const status = async (user: User) => {
    const view = await user.view();
    const host = view.room?.host === view.you ? " · host" : "";
    await user.label(`${user.name} · ${view.status}${host}`);
  };

  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  await say("Alice creates a room, Bob joins with the code");
  const code = await alice.create();
  await bob.join(code);
  await Promise.all([status(alice), status(bob)]);
  await alice.page.bringToFront();
  await pause();

  await say("Alice presses play");
  await alice.play();
  await synced([alice, bob], { paused: false });
  await pause(3000);

  await say("Alice seeks to 1:00");
  await alice.seek(60);
  await synced([alice, bob], { time: 60 });
  await pause(3000);

  await say("Alice speeds up to 1.5x");
  await alice.rate(1.5);
  await synced([alice, bob], { rate: 1.5 });
  await pause(3000);

  await say("Alice pauses");
  await alice.pause();
  await synced([alice, bob], { paused: true });
  await pause(2500);

  await say("Host-only mode: Bob tries to play and seek, and snaps back");
  await bob.play();
  await pause(1200);
  await bob.seek(10);
  await synced([alice, bob], { paused: true });
  await pause(3000);

  await say(
    "Alice lets everyone control playback; Bob seeks to 0:30 and plays",
  );
  await (await alice.popup()).getByTestId("mode-everyone").click();
  await alice.page.bringToFront();
  await expect.poll(async () => (await bob.view()).room?.mode).toBe("everyone");
  await bob.rate(1);
  await bob.seek(30);
  await bob.play();
  await synced([alice, bob], { time: 30, paused: false, rate: 1 });
  await pause(3500);

  await say("The network drops both sockets…");
  servers.kill();
  await expect.poll(async () => (await bob.view()).status).toBe("reconnecting");
  await Promise.all([status(alice), status(bob)]);
  await expect.poll(async () => (await bob.view()).status).toBe("connected");
  await expect.poll(async () => (await alice.view()).status).toBe("connected");
  await Promise.all([status(alice), status(bob)]);
  await say("…both resume as the same members, and Alice is still host");
  await pause(3000);

  await say("Chrome stops Bob's service worker; Bob pauses anyway");
  await bob.suspend();
  await bob.pause();
  await synced([alice, bob], { paused: true });
  await pause(3000);

  await say("Alice plays again: still in sync");
  await alice.play();
  await synced([alice, bob], { paused: false });
  await pause(4000);

  const paths = [
    await alice.page.video()!.path(),
    await bob.page.video()!.path(),
  ];
  await Promise.all([alice.context.close(), bob.context.close()]);
  const output = process.env.RECORD!;
  mkdirSync(dirname(output), { recursive: true });
  execFileSync("ffmpeg", [
    ...["-loglevel", "error", "-y", "-i", paths[0], "-i", paths[1]],
    ...["-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]"],
    ...["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", output],
  ]);
});
