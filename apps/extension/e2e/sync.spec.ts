import { expect, synced, test, type User } from "./fixtures";

/** Everyone opens the same video; the first user creates the room. */
async function room(users: User[], path = "watch.html?v=a") {
  for (const user of users) await user.open(path);
  const code = await users[0].create();
  for (const user of users.slice(1)) await user.join(code);
  return code;
}

test("host mode: the host's play, pause, seek and rate reach everyone", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await room([alice, bob]);

  await alice.play();
  await synced([alice, bob], { paused: false });
  await alice.seek(30);
  await synced([alice, bob], { time: 30, paused: false });
  await alice.rate(1.5);
  await synced([alice, bob], { rate: 1.5 });
  await alice.pause();
  await synced([alice, bob], { paused: true });
  await alice.seek(75);
  await synced([alice, bob], { time: 75, paused: true });
});

test("host mode: a follower's actions snap back to the room", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await room([alice, bob]);
  await alice.seek(20);
  await synced([alice, bob], { time: 20, paused: true });

  await bob.play();
  await synced([alice, bob], { paused: true, time: 20 });
  await bob.seek(90);
  await synced([alice, bob], { paused: true, time: 20 });
  await bob.rate(2);
  await synced([alice, bob], { rate: 1, time: 20 });
});

test("everyone mode: any member can play, pause, seek and change rate", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await room([alice, bob]);
  const popup = await alice.popup();
  await popup.getByRole("switch", { name: "Only host can control" }).click();
  await expect.poll(async () => (await bob.view()).room?.mode).toBe("everyone");

  await bob.play();
  await synced([alice, bob], { paused: false });
  await bob.seek(50);
  await synced([alice, bob], { time: 50, paused: false });
  await bob.rate(2);
  await synced([alice, bob], { rate: 2 });
  await bob.pause();
  await synced([alice, bob], { paused: true });
  await alice.seek(10);
  await synced([alice, bob], { time: 10, paused: true });
});

test("a late joiner lands where the room is", async ({ users }) => {
  const [alice, bob, carol] = await users("Alice", "Bob", "Carol");
  await room([alice, bob]);
  await alice.seek(40);
  await alice.play();
  await synced([alice, bob], { paused: false });

  await carol.open("watch.html?v=a");
  await carol.join((await alice.view()).room!.id);
  await synced([alice, bob, carol], { paused: false });
  expect((await carol.media()).time).toBeGreaterThan(40);
});

test("other tabs never touch the room, and only the synced tab is driven", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await room([alice, bob]);
  await alice.seek(15);
  await synced([alice, bob], { time: 15, paused: true });

  // Bob watches something else in another tab
  const other = await bob.context.newPage();
  await other.goto(alice.page.url().replace("v=a", "v=b"));
  await other.evaluate(() =>
    (document.getElementById("player") as HTMLVideoElement).play(),
  );
  await alice.page.bringToFront();
  await alice.play();
  await synced([alice, bob], { paused: false });
  const untouched = await other.evaluate(
    () => (document.getElementById("player") as HTMLVideoElement).playbackRate,
  );
  expect(untouched).toBe(1);
  expect((await alice.view()).room!.playback.url).toContain("v=a");
});
