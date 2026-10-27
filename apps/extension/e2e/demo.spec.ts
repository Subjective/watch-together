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
  await (await alice.popup())
    .getByRole("switch", { name: "Only host can control" })
    .click();
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

test("demo: the popup", async ({ users }) => {
  test.setTimeout(240_000);
  const [alice, bob] = await users("Alice", "Bob");
  const pause = (ms = 1800) => alice.page.waitForTimeout(ms);
  const say = async (text: string) => {
    await Promise.all([alice.caption(text), bob.caption(text)]);
  };

  await alice.open("watch.html?v=a");
  await bob.open("frame.html");
  const host = await alice.popup();
  const guest = await bob.popup();
  await say("Home: join by code, recent rooms, create");
  await pause();

  await say("Settings: default name, room name and control mode");
  await host.getByRole("button", { name: "Settings" }).click();
  await pause(800);
  await host
    .getByTestId("default-name")
    .pressSequentially("Alice", { delay: 60 });
  await host.getByTestId("default-name").fill("Alice");
  await host.getByTestId("default-room").fill("");
  await host
    .getByTestId("default-room")
    .pressSequentially("Movie night", { delay: 60 });
  await host.getByTestId("default-mode-host").check();
  await pause(800);
  await host.mouse.wheel(0, 500);
  await pause(1200);
  await host.getByRole("button", { name: "Back" }).click();
  await bob.settings({ name: "Bob", follow: false });

  await say("Alice creates a room; Bob joins with the code");
  await host.getByTestId("create").click();
  await expect(host.getByTestId("status")).toHaveText("Connected");
  const code = (await alice.view()).room!.id;
  await pause(800);
  await guest.getByTestId("code").pressSequentially(code, { delay: 80 });
  await guest.getByTestId("join").click();
  await expect(guest.getByTestId("status")).toHaveText("Connected");
  await pause();

  await say("Alice plays: now playing shows title, time and progress");
  await alice.page.bringToFront();
  await alice.seek(40);
  await alice.play();
  await pause(2500);

  await say("Bob's tab shows something else, so he sees the Follow banner");
  await pause(2500);
  await say("Bob follows: his tab goes to the host's video and syncs");
  await guest.getByRole("button", { name: "Follow" }).click();
  await expect.poll(() => bob.page.url()).toContain("watch.html?v=a");
  await bob.ready();
  await bob.label("Bob");
  await synced([alice, bob], { paused: false });
  await pause(2500);

  await say("Alice renames the room inline; Bob renames himself");
  await host.getByRole("button", { name: "Rename room" }).click();
  await host.getByRole("textbox", { name: "Rename room" }).fill("");
  await host
    .getByRole("textbox", { name: "Rename room" })
    .pressSequentially("Friday films", { delay: 60 });
  await host.keyboard.press("Enter");
  await pause(800);
  await guest.getByRole("button", { name: "Edit your name" }).click();
  await guest.getByRole("textbox", { name: "Edit your name" }).fill("");
  await guest
    .getByRole("textbox", { name: "Edit your name" })
    .pressSequentially("Bobby", { delay: 60 });
  await guest.keyboard.press("Enter");
  await pause();

  await say("Alice lets everyone control playback");
  await host.getByRole("switch", { name: "Only host can control" }).click();
  await pause(2500);

  await say("Bob leaves; the room is in his recent rooms");
  await guest.getByRole("button", { name: "Leave room" }).click();
  await pause(2500);
  await say("Rejoin puts him back in");
  await guest.getByTestId("rejoin").click();
  await expect(guest.getByTestId("status")).toHaveText("Connected");
  await synced([alice, bob], { paused: false });
  await pause(3000);

  const paths = await Promise.all(
    [host, alice.page, guest, bob.page].map((page) => page.video()!.path()),
  );
  await Promise.all([alice.context.close(), bob.context.close()]);
  const output = process.env.RECORD!;
  mkdirSync(dirname(output), { recursive: true });
  // The popups are recorded in a 680x600 frame; keep their 400x600 corner
  execFileSync("ffmpeg", [
    ...["-loglevel", "error", "-y"],
    ...paths.flatMap((path) => ["-i", path]),
    ...[
      "-filter_complex",
      "[0:v]crop=400:600:0:0[a];[2:v]crop=400:600:0:0[b];" +
        "[a][1:v]hstack=inputs=2[top];[b][3:v]hstack=inputs=2[bottom];" +
        "[top][bottom]vstack=inputs=2[v]",
    ],
    ...["-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26"],
    output,
  ]);
});
