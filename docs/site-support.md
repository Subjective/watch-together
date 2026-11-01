# Site support

The extension syncs any HTML5 `<video>`, in any frame. There are no
site-specific adapters yet. These sites are known to need one:

- **Disney+:** seeking breaks sync.
- **Hulu:** joining a room crashes the guest's player.
- **Paramount+:** a seek lands near the target time rather than on it, even
  on the same video. Ads sometimes inserted at the start may shift the
  timeline.

The old extension's `packages/adapters` had only the generic HTML5 adapter and
a diagnostic script, with nothing specific to these sites, so it was removed.
