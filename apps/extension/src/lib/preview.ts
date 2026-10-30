import type { Playback } from "@repo/protocol";
import { key } from "./key";

/** YouTube's own thumbnail when the key says YouTube, else the reported image. */
export function preview(playback: Playback): string | null {
  const id = key(playback.url);
  if (id?.startsWith("youtube:"))
    return `https://i.ytimg.com/vi/${encodeURIComponent(id.slice(8))}/mqdefault.jpg`;
  return playback.image;
}
