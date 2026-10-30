import { expect, synced, test } from "./fixtures";

test("the player inside an iframe is synced, not the small video beside it", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("frame.html");
  await bob.open("frame.html");
  await bob.join(await alice.create());

  await alice.play();
  await synced([alice, bob], { paused: false });
  await alice.seek(45);
  await synced([alice, bob], { time: 45 });
  const decoy = await bob.page.evaluate(() => {
    const video = document.getElementById("decoy") as HTMLVideoElement;
    return { paused: video.paused, time: video.currentTime };
  });
  expect(decoy).toEqual({ paused: true, time: 0 });
});

test("sync follows the page replacing its video element", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("spa.html");
  await bob.open("spa.html");
  await bob.join(await alice.create());
  await alice.seek(30);
  await alice.play();
  await synced([alice, bob], { paused: false });

  await bob.page.evaluate(() =>
    (window as unknown as { remount(): void }).remount(),
  );
  await synced([alice, bob], { paused: false });
  await alice.page.evaluate(() =>
    (window as unknown as { remount(): void }).remount(),
  );
  await alice.ready();
  await alice.seek(80);
  await alice.play();
  await synced([alice, bob], { time: 80, paused: false });
});

test("muted autoplay in the host's foreground tab does not move the room", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  await bob.join(await alice.create());

  const preview = await alice.context.newPage();
  await preview.goto(alice.page.url().replace("v=a", "v=b&muted&autoplay"));
  await preview.waitForFunction(
    () => !(document.getElementById("player") as HTMLVideoElement).paused,
  );
  await preview.waitForTimeout(1000);
  expect((await alice.view()).room!.playback.url).toContain("v=a");

  // Playing it with sound does move the room
  await preview.evaluate(() => {
    (document.getElementById("player") as HTMLVideoElement).muted = false;
  });
  await preview.evaluate(() =>
    (document.getElementById("player") as HTMLVideoElement).pause(),
  );
  await preview.evaluate(() =>
    (document.getElementById("player") as HTMLVideoElement).play(),
  );
  await expect
    .poll(async () => (await bob.view()).room?.playback.url)
    .toContain("v=b");
});
