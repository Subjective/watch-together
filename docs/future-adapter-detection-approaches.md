# Future Adapter Detection Approaches

This document outlines advanced approaches for detecting active video adapters that could be implemented in the future to make navigation broadcasting more accurate.

## Current Implementation (Option 1: Conservative Domain-Based)

Currently, we use a simple domain-based approach in `isValidNavigationUrl()` that only allows navigation broadcasts to known video streaming sites. This is implemented by making the domain allowlist restrictive rather than permissive.

```typescript
// Only broadcast navigation to known video sites
const allowedDomains = ["youtube.com", "netflix.com", "vimeo.com", ...];
return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
```

**Pros:** Simple, reliable, no timing issues, predictable behavior
**Cons:** Might miss new video sites, less flexible

## Option 2: Real-Time Adapter Detection

Check if a tab actually has an active adapter when navigation occurs.

```typescript
// In main.ts - tab update listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && roomManager) {
    const currentUser = roomManager.getCurrentUser();

    if (currentUser?.isHost) {
      // Check if this tab actually has an active adapter
      const hasActiveAdapter = await checkActiveAdapter(tabId);
      
      if (hasActiveAdapter && isValidNavigationUrl(changeInfo.url)) {
        console.log("Host navigated to site with active adapter:", changeInfo.url);
        await roomManager.broadcastNavigation(changeInfo.url);
      } else {
        console.log("Host navigated to site without adapter, not broadcasting:", changeInfo.url);
      }
    }
  }
});

// New function to check if tab has active adapter
async function checkActiveAdapter(tabId: number): Promise<boolean> {
  try {
    // Use the existing adapter handler to check active adapters
    const activeAdapters = getActiveAdapters();
    return activeAdapters.some(adapter => adapter.tabId === tabId && adapter.connected);
  } catch {
    return false;
  }
}
```

**Pros:** Most accurate, works with any site that gets an adapter
**Cons:** Timing dependent, more complex, requires adapter to be loaded

## Option 3: Message-Based Detection

Listen for `ADAPTER_READY` and `NO_ADAPTER` messages from content scripts to track which tabs have confirmed adapters.

```typescript
// Track which tabs have confirmed adapters
const tabsWithAdapters = new Set<number>();

// Listen for adapter ready messages
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "ADAPTER_READY" && sender.tab?.id) {
    tabsWithAdapters.add(sender.tab.id);
    console.log(`Tab ${sender.tab.id} has adapter ready`);
  } else if (message.type === "NO_ADAPTER" && sender.tab?.id) {
    tabsWithAdapters.delete(sender.tab.id);
    console.log(`Tab ${sender.tab.id} has no adapter`);
  }
});

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithAdapters.delete(tabId);
});

// Modified tab update listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && roomManager) {
    const currentUser = roomManager.getCurrentUser();

    if (currentUser?.isHost) {
      // Wait a moment for adapter to initialize on new page
      setTimeout(async () => {
        if (tabsWithAdapters.has(tabId) && isValidNavigationUrl(changeInfo.url)) {
          console.log("Broadcasting navigation - adapter confirmed:", changeInfo.url);
          await roomManager.broadcastNavigation(changeInfo.url);
        } else {
          console.log("Not broadcasting - no adapter confirmed for tab:", tabId);
        }
      }, 1000); // Give adapter time to initialize
    }
  }
});
```

**Pros:** Most reliable, event-driven, handles dynamic adapter loading
**Cons:** Most complex, requires timing delays, needs message handling

## Option 4: Hybrid Approach

Combine domain-based detection with real-time verification:

1. First check if domain is in known video sites list (fast path)
2. If not in list, check for active adapter (slow path)
3. Cache results to avoid repeated checks

```typescript
const adapterCache = new Map<string, boolean>();

async function hasAdapterSupport(url: string): Promise<boolean> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  
  // Fast path: check known video sites
  const knownVideoSites = ["youtube.com", "netflix.com", /* ... */];
  if (knownVideoSites.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return true;
  }
  
  // Check cache
  if (adapterCache.has(hostname)) {
    return adapterCache.get(hostname)!;
  }
  
  // Slow path: check for active adapter
  const tabs = await chrome.tabs.query({ url: `https://${hostname}/*` });
  const hasAdapter = tabs.some(tab => tab.id && isAdapterActive(tab.id));
  
  // Cache result for 5 minutes
  adapterCache.set(hostname, hasAdapter);
  setTimeout(() => adapterCache.delete(hostname), 5 * 60 * 1000);
  
  return hasAdapter;
}
```

**Pros:** Best of both worlds, performance optimized, handles edge cases
**Cons:** Most complex implementation, requires caching logic

## Implementation Notes

### Prerequisites for Options 2-4:
- Content scripts must send `ADAPTER_READY`/`NO_ADAPTER` messages
- Service worker must import `getActiveAdapters` from `adapterHandler`
- Timing considerations for adapter initialization

### Testing Strategy:
- Unit tests for each detection method
- Integration tests with multiple video sites
- Performance tests for caching approaches
- E2E tests for real browser behavior

### Migration Path:
1. Start with current domain-based approach (Option 1)
2. Implement message-based tracking (Option 3) for better accuracy
3. Add real-time detection (Option 2) for unknown sites
4. Optimize with hybrid approach (Option 4) if needed

## Conclusion

The current domain-based approach (Option 1) provides a solid foundation. Future enhancements should prioritize the message-based approach (Option 3) for its reliability and event-driven nature, with the hybrid approach (Option 4) as the ultimate solution for maximum accuracy and performance.