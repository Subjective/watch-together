import { expect, synced, test } from "./fixtures";

test("your name and last control mode carry over to new rooms", async ({
  users,
}) => {
  const [alice] = await users("Alice");
  await alice.open("watch.html?v=a");
  const popup = await alice.popup();
  await popup.getByRole("button", { name: "Edit your name" }).click();
  await popup.getByRole("textbox", { name: "Edit your name" }).fill("Alice");
  await popup.keyboard.press("Enter");
  await popup.reload();
  await expect(
    popup.getByRole("button", { name: "Edit your name" }),
  ).toHaveText("Alice");

  await popup.getByTestId("create").click();
  await expect(popup.getByTestId("status")).toHaveAttribute(
    "data-status",
    "connected",
  );
  let room = (await alice.view()).room!;
  expect(room.name).toBe("Alice's room");
  expect(room.members[0].name).toBe("Alice");
  expect(room.mode).toBe("host");

  await popup.getByTestId("mode").click();
  await expect
    .poll(async () => (await alice.view()).room?.mode)
    .toBe("everyone");
  await popup.getByTestId("leave").click();
  await popup.getByTestId("create").click();
  await expect
    .poll(async () => (await alice.view()).room?.mode)
    .toBe("everyone");
  room = (await alice.view()).room!;
  await expect(popup.getByText(room.name)).toBeVisible();
});

test("recent rooms show the last two with rejoin", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  const first = await alice.create();
  const popup = await bob.popup();
  await expect(popup.getByTestId("recent")).toHaveCount(0);
  await bob.join(first);
  await popup.getByTestId("leave").click();
  await expect(popup.getByTestId("recent")).toHaveCount(1);
  await expect(popup.getByTestId("recent")).toContainText("Alice's room");

  await popup.getByTestId("rejoin").click();
  await expect(popup.getByTestId("status")).toHaveAttribute(
    "data-status",
    "connected",
  );
  expect((await bob.view()).room!.id).toBe(first);
  await alice.play();
  await synced([alice, bob], { paused: false });
});

test("the host renames the room and members rename themselves", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  await bob.join(await alice.create());

  const host = await alice.popup();
  await host.getByRole("button", { name: "Rename room" }).click();
  await host.getByRole("textbox", { name: "Rename room" }).fill("Friday films");
  await host.keyboard.press("Enter");
  const guest = await bob.popup();
  await expect(guest.getByText("Friday films")).toBeVisible();
  // Only the host can rename the room
  await expect(guest.getByRole("button", { name: "Rename room" })).toHaveCount(
    0,
  );

  await guest.getByTestId("expand").click();
  await guest.getByRole("button", { name: "Edit your name" }).click();
  await guest.getByRole("textbox", { name: "Edit your name" }).fill("Bobby");
  await guest.keyboard.press("Enter");
  await host.getByTestId("expand").click();
  await expect(host.getByTestId("members")).toContainText("Bobby");
  await expect(host.getByTestId("faces")).toHaveAttribute(
    "title",
    "Alice, Bobby",
  );
});

test("now playing, thumbnail, invite link and the mode lock", async ({
  users,
}) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  const code = await alice.create();
  await bob.join(code);
  await alice.seek(65);
  await alice.play();
  await synced([alice, bob], { paused: false });

  const guest = await bob.popup();
  await expect(guest.getByTestId("title")).toHaveText("Video A");
  await expect(
    guest.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  await expect(guest.getByTestId("time")).toContainText("1:0");
  await expect(guest.getByTestId("time")).toContainText("2:00");
  await expect(guest.locator("img[src$='media/a.jpg']")).toBeVisible();
  await expect(guest.getByTestId("mode")).toHaveAttribute("data-mode", "host");

  const host = await alice.popup();
  // Capture what the button copies
  await host.evaluate(() => {
    navigator.clipboard.writeText = async (text: string) => {
      document.body.dataset.copied = text;
    };
  });
  await host.getByRole("button", { name: "Copy invite link" }).click();
  const copied = await host.evaluate(() => document.body.dataset.copied!);
  expect(new URL(copied).searchParams.get("wt_room")).toBe(code);
  expect(copied).toContain("watch.html?v=a");
});

test("play and pause the room from the popup", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a&bare");
  await bob.open("watch.html?v=a&bare");
  await bob.join(await alice.create());
  await alice.seek(20);
  await synced([alice, bob], { paused: true, time: 20 });

  const host = await alice.popup();
  // Without a thumbnail the button stands on its own
  await expect(host.locator("img")).toHaveCount(0);
  await host.getByRole("button", { name: "Play", exact: true }).click();
  await synced([alice, bob], { paused: false });
  await host.getByRole("button", { name: "Pause", exact: true }).click();
  await synced([alice, bob], { paused: true });

  await host.getByTestId("mode").click();
  const guest = await bob.popup();
  await guest.getByRole("button", { name: "Play", exact: true }).click();
  await synced([alice, bob], { paused: false });
});

test("the title takes a follower to the host's video", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("frame.html");
  await bob.settings({ follow: false });
  await bob.join(await alice.create());
  await alice.seek(30);
  await alice.play();

  const guest = await bob.popup();
  await expect(guest.getByTestId("away")).toBeVisible();
  await expect(guest.getByTestId("auto-follow")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await guest.getByTestId("title").click();
  await expect.poll(() => bob.page.url()).toContain("watch.html?v=a");
  await bob.ready();
  await synced([alice, bob], { paused: false });
  await expect(guest.getByTestId("away")).toHaveCount(0);
});

test("the leave button leaves the room", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  await bob.join(await alice.create());
  const guest = await bob.popup();
  await guest.getByRole("button", { name: "Leave room" }).click();
  await expect(guest.getByTestId("create")).toBeVisible();
  await expect
    .poll(async () => (await alice.view()).room?.members.length)
    .toBe(1);
});
