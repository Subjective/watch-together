import { expect, synced, test } from "./fixtures";

test("settings shape new rooms: names and default control mode", async ({
  users,
}) => {
  const [alice] = await users("Alice");
  await alice.open("watch.html?v=a");
  const popup = await alice.popup();
  await popup.getByRole("button", { name: "Settings" }).click();
  await popup.getByTestId("default-name").fill("Alice");
  await popup.getByTestId("default-room").fill("Movie night");
  await popup.getByTestId("default-mode-everyone").check();
  await popup.getByRole("button", { name: "Back" }).click();
  await popup.reload();
  await popup.getByRole("button", { name: "Settings" }).click();
  await expect(popup.getByTestId("default-room")).toHaveValue("Movie night");
  await popup.getByRole("button", { name: "Back" }).click();

  await popup.getByTestId("create").click();
  await expect(popup.getByTestId("status")).toHaveText("Connected");
  await expect
    .poll(async () => (await alice.view()).room?.mode)
    .toBe("everyone");
  const room = (await alice.view()).room!;
  expect(room.name).toBe("Movie night");
  expect(room.members[0].name).toBe("Alice");
  await expect(popup.getByText("Movie night")).toBeVisible();
  await expect(popup.getByText("Everyone can control")).toBeVisible();
});

test("recent rooms show the last two with Rejoin", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("watch.html?v=a");
  const first = await alice.create();
  const popup = await bob.popup();
  await expect(popup.getByText("No recent rooms")).toBeVisible();
  await bob.join(first);
  await popup.getByRole("button", { name: "Leave room" }).click();
  await expect(popup.getByTestId("recent")).toHaveCount(1);
  await expect(popup.getByTestId("recent")).toContainText("My Room");
  await expect(popup.getByTestId("recent")).toContainText("by Alice");

  await popup.getByTestId("rejoin").click();
  await expect(popup.getByTestId("status")).toHaveText("Connected");
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

  await guest.getByRole("button", { name: "Edit your name" }).click();
  await guest.getByRole("textbox", { name: "Edit your name" }).fill("Bobby");
  await guest.keyboard.press("Enter");
  await expect(host.getByTestId("members")).toContainText("Bobby");
});

test("now playing, share link and the mode badge", async ({ users }) => {
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
  await expect(guest.getByLabel("Playing")).toBeVisible();
  await expect(guest.getByTestId("time")).toContainText("1:0");
  await expect(guest.getByTestId("time")).toContainText("/ 2:00");
  await expect(guest.getByTestId("mode")).toHaveText("Host only");
  await expect(guest.getByTestId("sync-status")).toHaveText("Synced · Video A");

  const host = await alice.popup();
  // Capture what the button copies
  await host.evaluate(() => {
    navigator.clipboard.writeText = async (text: string) => {
      document.body.dataset.copied = text;
    };
  });
  await host.getByRole("button", { name: "Copy share link" }).click();
  const copied = await host.evaluate(() => document.body.dataset.copied!);
  expect(new URL(copied).searchParams.get("wt_room")).toBe(code);
  expect(copied).toContain("watch.html?v=a");
});

test("go to host's video opens it in a synced tab", async ({ users }) => {
  const [alice, bob] = await users("Alice", "Bob");
  await alice.open("watch.html?v=a");
  await bob.open("frame.html");
  await bob.settings({ follow: false });
  await bob.join(await alice.create());
  await alice.seek(30);
  await alice.play();

  const guest = await bob.popup();
  await expect(guest.getByTestId("banner")).toBeVisible();
  await expect(guest.getByTestId("sync-status")).toHaveText(
    "This tab isn't synced",
  );
  await guest.getByRole("button", { name: "Follow" }).click();
  await expect.poll(() => bob.page.url()).toContain("watch.html?v=a");
  await bob.ready();
  await synced([alice, bob], { paused: false });
  await expect(guest.getByTestId("banner")).toHaveCount(0);
});

test("the back arrow leaves the room", async ({ users }) => {
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
