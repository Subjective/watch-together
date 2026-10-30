import { expect, synced, test, type User } from "./fixtures";

async function playing(alice: User, bob: User) {
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  await bob.join(await alice.create());
  await alice.seek(20);
  await alice.play();
  await synced([alice, bob], { paused: false });
}

/** Both reconnect as the same members, and the host keeps the role. */
async function resumed(
  alice: User,
  bob: User,
  host: string,
  members: string[],
) {
  for (const user of [alice, bob]) {
    await expect.poll(async () => (await user.view()).status).toBe("connected");
  }
  const view = await alice.view();
  expect(view.room!.host).toBe(host);
  expect(view.room!.members.map((member) => member.id).sort()).toEqual(members);
  expect(view.room!.members.every((member) => member.online)).toBe(true);
}

test("everyone resumes after the sockets are cut", async ({
  users,
  servers,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await playing(alice, bob);
  const before = (await alice.view()).room!;

  servers.kill();
  await expect.poll(async () => (await bob.view()).status).toBe("reconnecting");
  await resumed(
    alice,
    bob,
    before.host,
    before.members.map((m) => m.id).sort(),
  );

  await alice.pause();
  await synced([alice, bob], { paused: true });
});

test("everyone resumes after the backend restarts", async ({
  users,
  servers,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await playing(alice, bob);
  const before = (await alice.view()).room!;

  await servers.restart();
  await resumed(
    alice,
    bob,
    before.host,
    before.members.map((m) => m.id).sort(),
  );

  await alice.seek(70);
  await synced([alice, bob], { time: 70, paused: false });
});

test("a stopped service worker resumes the session", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await playing(alice, bob);
  const before = (await alice.view()).room!;

  // Pages reconnect their ports, which wakes the worker again
  await alice.suspend();
  await resumed(
    alice,
    bob,
    before.host,
    before.members.map((m) => m.id).sort(),
  );

  await alice.pause();
  await synced([alice, bob], { paused: true });
  await bob.suspend();
  await alice.play();
  await synced([alice, bob], { paused: false });
});

test("when the host leaves, the host role moves", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await playing(alice, bob);

  await (await alice.popup()).getByTestId("leave").click();
  await expect
    .poll(async () => {
      const view = await bob.view();
      return view.room!.host === view.you && view.room!.members.length === 1;
    })
    .toBe(true);
  expect((await alice.view()).room).toBeNull();

  await bob.pause();
  await expect
    .poll(async () => (await bob.view()).room!.playback.playing)
    .toBe(false);
  // Alice's tab is no longer driven by the room
  await alice.play();
  await alice.page.waitForTimeout(1000);
  expect((await alice.media()).paused).toBe(false);
});
