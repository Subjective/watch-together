import { expect, synced, test, type User } from "./fixtures";
import { SITE } from "./servers";

/** Both on video A in a room Alice created, playing. */
async function watching(alice: User, bob: User) {
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  const code = await alice.create();
  await bob.join(code);
  await alice.play();
  await synced([alice, bob], { paused: false });
  return code;
}

/** The host plays a video with sound in their foreground tab. */
async function host(user: User, path: string, fresh = false) {
  if (fresh) user.page = await user.context.newPage();
  await user.page.bringToFront();
  await user.page.goto(`${SITE}/${path}`);
  await user.ready();
  await user.play();
}

test("auto-follow takes the follower's synced tab along and reuses it", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await watching(alice, bob);
  const tab = (await bob.view()).synced!.tab;

  // Same tab, new video
  await host(alice, "watch.html?v=b");
  await expect.poll(() => bob.page.url()).toContain("v=b");
  await bob.ready();
  await synced([alice, bob], { paused: false });

  // A new tab only moves the room when the host says so
  await host(alice, "watch.html?v=a", true);
  const pill = alice.page.getByTestId("pill");
  await expect(pill).toContainText("Not synced");
  expect((await alice.view()).room?.playback.url).toContain("v=b");
  await pill.getByRole("button", { name: "Move room here" }).click();
  await expect.poll(() => bob.page.url()).toContain("v=a");
  await bob.ready();
  await synced([alice, bob], { paused: false });
  expect(bob.videos()).toHaveLength(1);
  expect((await bob.view()).synced!.tab).toBe(tab);
});

test("a follower without a video tab gets one new tab for every switch", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await alice.play();
  expect(bob.videos()).toHaveLength(0);
  await bob.join(await alice.create());

  // Joining from a tab without a video opens the room's video
  await expect.poll(() => bob.videos().length).toBe(1);
  bob.page = bob.videos()[0];
  await bob.ready();
  await synced([alice, bob], { paused: false });

  await host(alice, "watch.html?v=b");
  await expect.poll(() => bob.page.url()).toContain("v=b");
  await bob.ready();
  await synced([alice, bob], { paused: false });
  expect(bob.videos()).toHaveLength(1);
});

test("with auto-follow off, the overlay offers to follow", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await bob.settings({ follow: false });
  await watching(alice, bob);

  await host(alice, "watch.html?v=b");
  const pill = bob.page.getByTestId("pill");
  await expect(pill).toContainText("Alice switched videos");
  expect(bob.page.url()).toContain("v=a");
  await pill.getByRole("button", { name: "Follow" }).click();
  await expect.poll(() => bob.page.url()).toContain("v=b");
  await bob.ready();
  await synced([alice, bob], { paused: false });
});

test("a share link joins the room in that tab and cleans the URL", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  const code = await alice.create();
  await alice.seek(40);
  await alice.play();

  await bob.settings({ name: "Bob" });
  bob.page = bob.context.pages()[0];
  await bob.page.goto(`${SITE}/watch.html?v=a&wt_room=${code}`);
  await expect.poll(async () => (await bob.view()).room?.id).toBe(code);
  await expect.poll(() => bob.page.url()).not.toContain("wt_room");
  expect(bob.page.url()).toContain("watch.html?v=a");
  await bob.ready();
  await synced([alice, bob], { paused: false });
  const room = (await alice.view()).room!;
  expect(room.members.map((member) => member.name)).toEqual(["Alice", "Bob"]);
});

test("the overlay shows who you're synced with and what they did", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await watching(alice, bob);

  await expect(alice.page.getByTestId("pill")).toContainText("Alice's room");
  const pill = bob.page.getByTestId("pill");
  await expect(pill).toContainText("Synced with Alice");
  await expect(pill).toContainText("2");

  await alice.pause();
  await expect(pill).toContainText("Alice paused");
  await expect(pill).toHaveAttribute("data-visible", "true");
  // Fades like player controls, and comes back over the video
  await expect(pill).toHaveAttribute("data-visible", "false", {
    timeout: 6000,
  });
  await expect(pill).toContainText("Synced with Alice");
  await bob.page.mouse.move(300, 200);
  await bob.page.mouse.move(320, 220);
  await expect(pill).toHaveAttribute("data-visible", "true");
});

test("another tab with the room's video offers to sync it", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await watching(alice, bob);

  const other = await bob.context.newPage();
  await other.goto(`${SITE}/watch.html?v=a`);
  const pill = other.getByTestId("pill");
  await expect(pill).toContainText("Not synced");
  await expect(pill).toHaveAttribute("data-warn", "true");
  await pill.getByRole("button", { name: "Sync this tab" }).click();

  bob.page = other;
  await synced([alice, bob], { paused: false });
  await expect(pill).toContainText("Synced with Alice");
});

test("the badge counts members and turns amber while reconnecting", async ({
  users,
  servers,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  expect((await alice.badge()).text).toBe("");
  await watching(alice, bob);
  const tab = (await alice.view()).synced!.tab;
  await expect.poll(async () => (await alice.badge()).text).toBe("2");
  expect((await alice.badge(tab)).color).toEqual([34, 197, 94, 255]);

  const restart = servers.restart();
  await expect
    .poll(async () => (await alice.badge(tab)).color)
    .toEqual([245, 158, 11, 255]);
  await expect(alice.page.getByTestId("pill")).toContainText("Reconnecting");
  await restart;
  await expect
    .poll(async () => (await alice.badge(tab)).color, { timeout: 15_000 })
    .toEqual([34, 197, 94, 255]);

  await (await alice.popup()).getByTestId("leave").click();
  await expect.poll(async () => (await alice.badge()).text).toBe("");
  await expect.poll(async () => (await alice.badge(tab)).text).toBe("");
  await expect(alice.page.getByTestId("pill")).toHaveCount(0);
});

test("a follower whose browser refuses to play is asked to press play", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await watching(alice, bob);
  await alice.pause();
  await synced([alice, bob], { paused: true });

  await bob.refuse();
  await alice.play();
  const pill = bob.page.getByTestId("pill");
  await expect(pill).toContainText("Press play to catch up");
  await expect(pill).toHaveAttribute("data-warn", "true");
  const tab = (await bob.view()).synced!.tab;
  await expect.poll(async () => (await bob.badge(tab)).text).toBe("!");
  expect((await bob.media()).paused).toBe(true);
  // The room keeps playing for everyone else
  expect((await alice.media()).paused).toBe(false);

  // Any click on the page counts, and playback catches up
  await bob.page.locator("#readout").click();
  await synced([alice, bob], { paused: false });
  await expect(pill).toContainText("Synced with Alice");
  await expect.poll(async () => (await bob.badge(tab)).text).toBe("2");
});
