/** Params that never identify a video: tracking, start time, our room link. */
const NOISE = /^(utm_.*|t|si|feature|fbclid|wt_room)$/;

const YOUTUBE = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/;

/**
 * A normalized key for comparing videos, so the same video under a slightly
 * different URL still counts as the room's video. Null for unparseable input.
 */
export function key(raw: string | null | undefined): string | null {
  if (!raw || !URL.canParse(raw)) return null;
  const url = new URL(raw);
  if (url.hostname === "youtu.be") return `youtube:${url.pathname.slice(1)}`;
  if (YOUTUBE.test(url.hostname)) {
    const id =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/)?.[2];
    if (id) return `youtube:${id}`;
  }
  const params = [...url.searchParams]
    .filter((entry) => !NOISE.test(entry[0]))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const query = new URLSearchParams(params).toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}
