import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PROXY_PORT } from "./servers";

const MEDIA = resolve(import.meta.dirname, "site/media");

/** Test videos: an ffmpeg pattern with a tone, so playback is audible. */
const VIDEOS = [
  { name: "a", pattern: "testsrc2", tone: 440 },
  { name: "b", pattern: "smptehdbars", tone: 660 },
];

export default function setup() {
  mkdirSync(MEDIA, { recursive: true });
  for (const video of VIDEOS) {
    const file = resolve(MEDIA, `${video.name}.webm`);
    if (existsSync(file)) continue;
    execFileSync("ffmpeg", [
      ...["-loglevel", "error", "-y"],
      ...[
        "-f",
        "lavfi",
        "-i",
        `${video.pattern}=size=640x360:rate=30:duration=120`,
      ],
      ...["-f", "lavfi", "-i", `sine=frequency=${video.tone}:duration=120`],
      ...["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8"],
      ...["-b:v", "600k", "-g", "30", "-c:a", "libopus", "-shortest", file],
    ]);
  }
  if (process.env.SKIP_BUILD) return;
  execFileSync("pnpm", ["exec", "wxt", "build"], {
    cwd: resolve(import.meta.dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, WXT_BACKEND_URL: `ws://localhost:${PROXY_PORT}` },
  });
}
