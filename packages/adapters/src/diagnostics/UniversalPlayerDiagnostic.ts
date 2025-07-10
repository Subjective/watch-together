/**
 * Universal video player diagnostic tool for analyzing any video site
 */

interface DiagnosticResults {
  timestamp: string;
  url: string;
  domain: string;
  videoElements: any[];
  iframes: any[];
  globalPlayerObjects: Record<string, any>;
  domPlayerElements: any[];
  networkRequests: any[];
  postMessagePatterns: any[];
  eventListeners: any[];
  playerLibraries: Record<string, boolean>;
  recommendations: string[];
  adapterStrategy: string;
}

export class UniversalPlayerDiagnostic {
  private results: DiagnosticResults;
  private messageLog: any[] = [];
  private networkLog: any[] = [];
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      domain: window.location.hostname,
      videoElements: [],
      iframes: [],
      globalPlayerObjects: {},
      domPlayerElements: [],
      networkRequests: [],
      postMessagePatterns: [],
      eventListeners: [],
      playerLibraries: {},
      recommendations: [],
      adapterStrategy: "unknown",
    };
  }

  async analyze(): Promise<DiagnosticResults> {
    console.log(
      "[UniversalPlayerDiagnostic] Starting comprehensive analysis...",
    );

    try {
      // 1. Find all video elements
      this.findVideoElements();

      // 2. Find all iframes that might contain players
      this.findIframes();

      // 3. Analyze global objects for player APIs
      this.analyzeGlobalObjects();

      // 4. Find DOM elements with player-related classes/IDs
      this.findPlayerDOMElements();

      // 5. Check for known player libraries
      this.detectPlayerLibraries();

      // 6. Monitor network requests for video sources
      this.monitorNetworkRequests();

      // 7. Monitor postMessage communication
      this.monitorPostMessages();

      // 8. Analyze event listeners
      this.analyzeEventListeners();

      // Wait a bit to collect runtime data
      await this.collectRuntimeData();

      // 9. Generate recommendations
      this.generateRecommendations();

      // 10. Determine best adapter strategy
      this.determineAdapterStrategy();
    } catch (error) {
      console.error(
        "[UniversalPlayerDiagnostic] Error during analysis:",
        error,
      );
      this.results.recommendations.push(`Error during analysis: ${error}`);
    }

    this.cleanup();
    this.logResults();
    return this.results;
  }

  private findVideoElements(): void {
    const videos = Array.from(document.querySelectorAll("video"));
    this.results.videoElements = videos.map((video, index) => ({
      index,
      src: video.src || video.currentSrc,
      sources: Array.from(video.querySelectorAll("source")).map((s) => ({
        src: s.src,
        type: s.type,
      })),
      width: video.width || video.clientWidth,
      height: video.height || video.clientHeight,
      duration: video.duration,
      paused: video.paused,
      controls: video.controls,
      autoplay: video.autoplay,
      muted: video.muted,
      id: video.id,
      className: video.className,
      dataset: { ...video.dataset },
      parentHierarchy: this.getParentHierarchy(video),
      computedStyles: this.getRelevantStyles(video),
      mediaKeys: !!video.mediaKeys,
      crossOrigin: video.crossOrigin,
    }));

    console.log(
      `[UniversalPlayerDiagnostic] Found ${videos.length} video elements`,
    );
  }

  private findIframes(): void {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    this.results.iframes = iframes
      .filter((iframe) => {
        // Filter for potential video player iframes
        const src = iframe.src.toLowerCase();
        const className = iframe.className.toLowerCase();
        const id = iframe.id.toLowerCase();

        return (
          src.includes("player") ||
          src.includes("video") ||
          src.includes("embed") ||
          className.includes("player") ||
          className.includes("video") ||
          id.includes("player") ||
          id.includes("video") ||
          iframe.allow?.includes("autoplay")
        );
      })
      .map((iframe, index) => {
        const iframeInfo: any = {
          index,
          src: iframe.src,
          id: iframe.id,
          className: iframe.className,
          width: iframe.width || iframe.clientWidth,
          height: iframe.height || iframe.clientHeight,
          dataset: { ...iframe.dataset },
          sandbox: iframe.sandbox.toString(),
          allow: iframe.allow,
          crossOrigin: this.isCrossOrigin(iframe.src),
          parentHierarchy: this.getParentHierarchy(iframe),
        };

        // Try to access iframe content
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            iframeInfo.accessible = true;
            iframeInfo.videoCount = iframeDoc.querySelectorAll("video").length;
          } else {
            iframeInfo.accessible = false;
          }
        } catch (e) {
          iframeInfo.accessible = false;
          iframeInfo.accessError = (e as Error).message;
        }

        return iframeInfo;
      });

    console.log(
      `[UniversalPlayerDiagnostic] Found ${this.results.iframes.length} potential player iframes`,
    );
  }

  private analyzeGlobalObjects(): void {
    const playerPatterns = [
      "player",
      "video",
      "media",
      "jwplayer",
      "videojs",
      "youtube",
      "vimeo",
      "netflix",
      "hulu",
      "prime",
      "disney",
      "hbo",
      "crunchyroll",
      "vilos",
      "bitmovin",
      "shaka",
      "hls",
      "dash",
      "flv",
    ];

    const foundObjects: Record<string, any> = {};

    // Check window object
    Object.keys(window).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (playerPatterns.some((pattern) => lowerKey.includes(pattern))) {
        try {
          const value = (window as any)[key];
          if (
            value &&
            (typeof value === "object" || typeof value === "function")
          ) {
            foundObjects[key] = this.analyzeObject(value, key);
          }
        } catch (e) {
          foundObjects[key] = { error: (e as Error).message };
        }
      }
    });

    // Check for specific player instances
    const specificChecks = [
      {
        path: "netflix.appContext.state.playerApp.getAPI()",
        name: "Netflix Player API",
      },
      { path: "window.player", name: "Generic Player" },
      {
        path: 'document.querySelector("video")?._player',
        name: "Video Element Player",
      },
    ];

    specificChecks.forEach((check) => {
      try {
        const result = eval(check.path);
        if (result) {
          foundObjects[check.name] = this.analyzeObject(result, check.name);
        }
      } catch {
        // Ignore errors for non-existent paths
      }
    });

    this.results.globalPlayerObjects = foundObjects;
    console.log(
      `[UniversalPlayerDiagnostic] Found ${Object.keys(foundObjects).length} potential player objects`,
    );
  }

  private analyzeObject(obj: any, _name: string): any {
    const analysis: any = {
      type: typeof obj,
      constructor: obj.constructor?.name,
    };

    // Get methods and properties
    try {
      const props = Object.getOwnPropertyNames(obj);
      const prototype = Object.getPrototypeOf(obj);
      const prototypeMethods = prototype
        ? Object.getOwnPropertyNames(prototype)
        : [];

      analysis.methods = props.filter((p) => typeof obj[p] === "function");
      analysis.properties = props.filter((p) => typeof obj[p] !== "function");
      analysis.prototypeMethods = prototypeMethods.filter(
        (p) => typeof prototype[p] === "function",
      );

      // Check for player-like methods
      const playerMethods = [
        "play",
        "pause",
        "seek",
        "getCurrentTime",
        "getDuration",
        "setVolume",
      ];
      analysis.hasPlayerMethods = playerMethods.filter(
        (m) =>
          analysis.methods.includes(m) || analysis.prototypeMethods.includes(m),
      );

      // If it looks like a player, try to get current state
      if (analysis.hasPlayerMethods.length > 2) {
        analysis.currentState = {};
        [
          "getCurrentTime",
          "getDuration",
          "isPaused",
          "getVolume",
          "getPlaybackRate",
        ].forEach((method) => {
          try {
            if (typeof obj[method] === "function") {
              analysis.currentState[method] = obj[method]();
            }
          } catch {
            // Ignore errors
          }
        });
      }
    } catch (e) {
      analysis.error = (e as Error).message;
    }

    return analysis;
  }

  private findPlayerDOMElements(): void {
    const selectors = [
      // Generic player selectors
      '[class*="player"]:not(iframe)',
      '[id*="player"]:not(iframe)',
      "[data-player]",
      ".video-container",
      ".video-wrapper",

      // Library-specific selectors
      ".video-js",
      ".jw-player",
      ".plyr",
      ".flowplayer",
      ".afterglow",
      ".sublime",

      // Site-specific selectors
      ".netflix-player",
      ".youtube-player",
      ".vimeo-player",
    ];

    const elements: any[] = [];
    selectors.forEach((selector) => {
      try {
        const found = Array.from(document.querySelectorAll(selector));
        found.forEach((el) => {
          if (!elements.some((e) => e.element === el)) {
            elements.push({
              selector,
              element: el,
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              dataset: { ...(el as HTMLElement).dataset },
              hasVideo: el.querySelector("video") !== null,
              hasIframe: el.querySelector("iframe") !== null,
              boundEvents: this.getEventListeners(el),
            });
          }
        });
      } catch {
        // Ignore invalid selectors
      }
    });

    this.results.domPlayerElements = elements.map(
      ({ element: _element, ...rest }) => rest,
    );
    console.log(
      `[UniversalPlayerDiagnostic] Found ${elements.length} player-related DOM elements`,
    );
  }

  private detectPlayerLibraries(): void {
    const libraries = {
      // Popular HTML5 players
      videojs: typeof (window as any).videojs !== "undefined",
      jwplayer: typeof (window as any).jwplayer !== "undefined",
      plyr: typeof (window as any).Plyr !== "undefined",
      flowplayer: typeof (window as any).flowplayer !== "undefined",
      afterglow: typeof (window as any).afterglow !== "undefined",
      sublime: typeof (window as any).sublime !== "undefined",
      mediaelement: typeof (window as any).MediaElementPlayer !== "undefined",

      // Streaming libraries
      hls: typeof (window as any).Hls !== "undefined",
      dashjs: typeof (window as any).dashjs !== "undefined",
      shaka: typeof (window as any).shaka !== "undefined",
      flvjs: typeof (window as any).flvjs !== "undefined",

      // Platform-specific
      youtube: typeof (window as any).YT !== "undefined",
      vimeo: typeof (window as any).Vimeo !== "undefined",

      // DRM
      widevine: !!(document.querySelector("video") as any)?.mediaKeys,
    };

    this.results.playerLibraries = libraries;
    const detected = Object.entries(libraries)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    console.log(
      `[UniversalPlayerDiagnostic] Detected libraries: ${detected.join(", ") || "none"}`,
    );
  }

  private monitorNetworkRequests(): void {
    // Use Performance API to find video requests
    const entries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    this.results.networkRequests = entries
      .filter((entry) => {
        const url = entry.name.toLowerCase();
        return (
          url.includes(".m3u8") ||
          url.includes(".mpd") ||
          url.includes(".mp4") ||
          url.includes(".webm") ||
          url.includes(".flv") ||
          url.includes("manifest") ||
          url.includes("video") ||
          url.includes("media") ||
          url.includes("chunk") ||
          url.includes("segment")
        );
      })
      .map((entry) => ({
        url: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        type: this.guessMediaType(entry.name),
        initiatorType: entry.initiatorType,
      }));

    console.log(
      `[UniversalPlayerDiagnostic] Found ${this.results.networkRequests.length} media-related requests`,
    );
  }

  private monitorPostMessages(): void {
    this.messageHandler = (event: MessageEvent) => {
      // Log all messages for pattern analysis
      const messageInfo = {
        origin: event.origin,
        data: event.data,
        timestamp: Date.now(),
        sourceIsIframe:
          event.source !== window && event.source !== window.parent,
      };

      this.messageLog.push(messageInfo);

      // Look for player-related messages
      if (this.isPlayerMessage(event.data)) {
        console.log(
          "[UniversalPlayerDiagnostic] Detected player message:",
          event.data,
        );
      }
    };

    window.addEventListener("message", this.messageHandler);
    console.log(
      "[UniversalPlayerDiagnostic] Monitoring postMessage communication...",
    );
  }

  private analyzeEventListeners(): void {
    // Check video elements for event listeners
    const videos = document.querySelectorAll("video");
    videos.forEach((video, index) => {
      const listeners = this.getEventListeners(video);
      if (Object.keys(listeners).length > 0) {
        this.results.eventListeners.push({
          type: "video",
          index,
          listeners,
        });
      }
    });

    // Note: getEventListeners is only available in Chrome DevTools
    // In production, we can only detect some listeners through other means
  }

  private async collectRuntimeData(): Promise<void> {
    console.log(
      "[UniversalPlayerDiagnostic] Collecting runtime data for 3 seconds...",
    );

    // Set up Performance Observer for new requests
    if ("PerformanceObserver" in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const url = entry.name.toLowerCase();
          if (
            url.includes("video") ||
            url.includes("media") ||
            url.includes(".m3u8") ||
            url.includes(".mpd")
          ) {
            this.networkLog.push({
              url: entry.name,
              type: "observed",
              timestamp: entry.startTime,
            });
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ["resource"] });
    }

    // Wait and collect data
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Analyze collected messages
    this.analyzePostMessagePatterns();
  }

  private analyzePostMessagePatterns(): void {
    if (this.messageLog.length === 0) return;

    // Group messages by origin
    const byOrigin: Record<string, any[]> = {};
    this.messageLog.forEach((msg) => {
      if (!byOrigin[msg.origin]) byOrigin[msg.origin] = [];
      byOrigin[msg.origin].push(msg);
    });

    // Analyze patterns
    Object.entries(byOrigin).forEach(([origin, messages]) => {
      const pattern: any = {
        origin,
        messageCount: messages.length,
        messageTypes: new Set(),
        sampleMessages: [],
      };

      messages.forEach((msg) => {
        if (typeof msg.data === "object" && msg.data !== null) {
          // Look for common keys
          Object.keys(msg.data).forEach((key) => pattern.messageTypes.add(key));

          // Keep sample messages
          if (pattern.sampleMessages.length < 3) {
            pattern.sampleMessages.push(msg.data);
          }
        }
      });

      pattern.messageTypes = Array.from(pattern.messageTypes);
      this.results.postMessagePatterns.push(pattern);
    });
  }

  private generateRecommendations(): void {
    const recs: string[] = [];

    // Check video elements
    if (this.results.videoElements.length > 0) {
      recs.push(
        "✓ Direct video elements found - GenericHTML5Adapter can be used",
      );

      if (this.results.videoElements.some((v) => v.crossOrigin)) {
        recs.push(
          "⚠️ Some videos use crossOrigin - might have CORS restrictions",
        );
      }

      if (this.results.videoElements.some((v) => v.mediaKeys)) {
        recs.push("⚠️ DRM protection detected - might need special handling");
      }
    }

    // Check iframes
    if (this.results.iframes.length > 0) {
      const accessible = this.results.iframes.filter(
        (i) => i.accessible,
      ).length;
      const crossOrigin = this.results.iframes.filter(
        (i) => i.crossOrigin,
      ).length;

      if (accessible > 0) {
        recs.push(
          `✓ ${accessible} accessible iframe(s) found - can directly control video inside`,
        );
      }

      if (crossOrigin > 0) {
        recs.push(
          `⚠️ ${crossOrigin} cross-origin iframe(s) found - need postMessage or parent API`,
        );

        if (this.results.postMessagePatterns.length > 0) {
          recs.push(
            "✓ PostMessage communication detected - can build postMessage adapter",
          );
        }
      }
    }

    // Check global objects
    const playerObjects = Object.entries(
      this.results.globalPlayerObjects,
    ).filter(([_, info]) => info.hasPlayerMethods?.length > 2);

    if (playerObjects.length > 0) {
      recs.push(
        `✓ ${playerObjects.length} player API object(s) found in global scope:`,
      );
      playerObjects.forEach(([name, info]) => {
        recs.push(`  - ${name}: ${info.hasPlayerMethods.join(", ")}`);
      });
    }

    // Check libraries
    const detectedLibs = Object.entries(this.results.playerLibraries)
      .filter(([_, detected]) => detected)
      .map(([lib]) => lib);

    if (detectedLibs.length > 0) {
      recs.push(
        `✓ Known player libraries detected: ${detectedLibs.join(", ")}`,
      );
      detectedLibs.forEach((lib) => {
        switch (lib) {
          case "videojs":
            recs.push("  - Video.js: Use videojs() to get player instance");
            break;
          case "jwplayer":
            recs.push("  - JW Player: Use jwplayer() to get player instance");
            break;
          case "youtube":
            recs.push(
              "  - YouTube IFrame API: Use YT.Player or postMessage API",
            );
            break;
        }
      });
    }

    // Network analysis
    if (this.results.networkRequests.length > 0) {
      const types = new Set(this.results.networkRequests.map((r) => r.type));
      recs.push(`✓ Media streams detected: ${Array.from(types).join(", ")}`);
    }

    this.results.recommendations = recs;
  }

  private determineAdapterStrategy(): void {
    // Priority-based strategy selection

    // 1. Check for known player libraries
    if (this.results.playerLibraries.videojs) {
      this.results.adapterStrategy = "VideoJSAdapter - use videojs() API";
    } else if (this.results.playerLibraries.jwplayer) {
      this.results.adapterStrategy = "JWPlayerAdapter - use jwplayer() API";
    } else if (this.results.playerLibraries.youtube) {
      this.results.adapterStrategy =
        "YouTubeAdapter - use YT.Player API or postMessage";
    }
    // 2. Check for global player objects
    else if (Object.keys(this.results.globalPlayerObjects).length > 0) {
      const playerObj = Object.entries(this.results.globalPlayerObjects).find(
        ([_, info]) => info.hasPlayerMethods?.length > 2,
      );

      if (playerObj) {
        this.results.adapterStrategy = `CustomAdapter - use global ${playerObj[0]} object`;
      }
    }
    // 3. Check for accessible video elements
    else if (
      this.results.videoElements.length > 0 &&
      !this.results.videoElements[0].mediaKeys
    ) {
      this.results.adapterStrategy =
        "GenericHTML5Adapter - direct video element control";
    }
    // 4. Check for iframes with postMessage
    else if (
      this.results.iframes.length > 0 &&
      this.results.postMessagePatterns.length > 0
    ) {
      this.results.adapterStrategy =
        "PostMessageAdapter - communicate with iframe player";
    }
    // 5. No clear strategy
    else {
      this.results.adapterStrategy = "Unknown - manual investigation required";
    }
  }

  private cleanup(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  private logResults(): void {
    console.log("[UniversalPlayerDiagnostic] === ANALYSIS COMPLETE ===");

    // Create downloadable report and auto-download
    const reportJson = JSON.stringify(this.results, null, 2);
    const blob = new Blob([reportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `player-diagnostic-${this.results.domain}-${Date.now()}.json`;

    // Create a temporary download link and click it
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log(
      `[UniversalPlayerDiagnostic] Downloaded report as: ${filename}`,
    );

    // Log summary
    console.log("\n=== SUMMARY ===");
    console.log(`Domain: ${this.results.domain}`);
    console.log(`Video elements: ${this.results.videoElements.length}`);
    console.log(`Iframes: ${this.results.iframes.length}`);
    console.log(
      `Player objects: ${Object.keys(this.results.globalPlayerObjects).length}`,
    );
    console.log(
      `Detected libraries: ${
        Object.entries(this.results.playerLibraries)
          .filter(([_, v]) => v)
          .map(([k]) => k)
          .join(", ") || "none"
      }`,
    );
    console.log(`\nRecommended strategy: ${this.results.adapterStrategy}`);
    console.log("\n=== RECOMMENDATIONS ===");
    this.results.recommendations.forEach((rec) => console.log(rec));
  }

  // Helper methods

  private getParentHierarchy(element: Element): string[] {
    const hierarchy: string[] = [];
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 5) {
      const desc = `${current.tagName.toLowerCase()}${current.id ? "#" + current.id : ""}${current.className ? "." + current.className.split(" ").join(".") : ""}`;
      hierarchy.push(desc);
      current = current.parentElement;
      depth++;
    }

    return hierarchy;
  }

  private getRelevantStyles(element: HTMLElement): any {
    const computed = window.getComputedStyle(element);
    return {
      position: computed.position,
      display: computed.display,
      width: computed.width,
      height: computed.height,
      zIndex: computed.zIndex,
      visibility: computed.visibility,
      opacity: computed.opacity,
    };
  }

  private isCrossOrigin(url: string): boolean {
    try {
      const srcUrl = new URL(url, window.location.href);
      return srcUrl.origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  private guessMediaType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes(".m3u8")) return "HLS";
    if (lower.includes(".mpd")) return "DASH";
    if (lower.includes(".mp4")) return "MP4";
    if (lower.includes(".webm")) return "WebM";
    if (lower.includes(".flv")) return "FLV";
    if (lower.includes("manifest")) return "Manifest";
    if (lower.includes("chunk") || lower.includes("segment")) return "Segment";
    return "Unknown";
  }

  private isPlayerMessage(data: any): boolean {
    if (!data || typeof data !== "object") return false;

    const playerKeywords = [
      "play",
      "pause",
      "seek",
      "time",
      "duration",
      "volume",
      "player",
      "video",
      "media",
    ];
    const dataStr = JSON.stringify(data).toLowerCase();

    return playerKeywords.some((keyword) => dataStr.includes(keyword));
  }

  private getEventListeners(element: Element): any {
    // This would only work in Chrome DevTools context
    // In regular context, we can only make educated guesses
    const listeners: any = {};

    // Check for common player events
    const events = [
      "play",
      "pause",
      "timeupdate",
      "ended",
      "seeking",
      "seeked",
    ];
    events.forEach((event) => {
      // Try to detect if listener exists (limited capability)
      const attr = element.getAttribute(`on${event}`);
      if (attr) {
        listeners[event] = "inline";
      }
    });

    return listeners;
  }
}

// Export convenience function
export function runUniversalPlayerDiagnostic(): Promise<DiagnosticResults> {
  const diagnostic = new UniversalPlayerDiagnostic();
  return diagnostic.analyze();
}
