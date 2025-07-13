import type { IPlayerAdapter } from "@repo/types";

/**
 * Base class for iframe-based video player adapters that use postMessage communication
 */
export abstract class IframePlayerBase implements IPlayerAdapter {
  protected iframe: HTMLIFrameElement | null = null;
  protected messageHandler: ((event: MessageEvent) => void) | null = null;
  protected pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  protected eventListeners = new Map<string, Set<Function>>();
  protected isDestroyed = false;

  protected abstract readonly allowedOrigins: string[];
  protected abstract readonly messageTimeout: number;
  protected abstract readonly maxRetries: number;

  constructor(iframe?: HTMLIFrameElement) {
    if (iframe) {
      this.attach(iframe);
    }
  }

  /**
   * Attach to an iframe element and set up postMessage communication
   */
  attach(iframe: HTMLIFrameElement): void {
    if (this.iframe) {
      this.detach();
    }

    this.iframe = iframe;
    this.setupMessageHandler();
  }

  /**
   * Detach from the current iframe
   */
  detach(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("Adapter detached"));
    });
    this.pendingRequests.clear();

    this.iframe = null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.detach();
    this.eventListeners.clear();
  }

  /**
   * Send a command to the iframe player
   */
  protected async sendCommand(
    message: any,
    expectResponse = false,
  ): Promise<any> {
    if (!this.iframe) {
      throw new Error("No iframe attached to adapter");
    }

    // Wait for iframe to be ready if needed
    await this.waitForIframeReady();

    if (!this.iframe.contentWindow) {
      throw new Error("Iframe contentWindow not accessible");
    }

    const messageWithSource = {
      ...message,
      source: "watch-together",
      id: expectResponse ? this.generateRequestId() : undefined,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (expectResponse && messageWithSource.id) {
          // Set up promise for response
          const responsePromise = this.createResponsePromise(
            messageWithSource.id,
          );

          // Send message
          this.iframe.contentWindow.postMessage(messageWithSource, "*");

          // Wait for response
          return await responsePromise;
        } else {
          // Fire and forget
          this.iframe.contentWindow.postMessage(messageWithSource, "*");
          return;
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1)),
          );
        }
      }
    }

    throw new Error(
      `Failed to send message after retries: ${lastError?.message}`,
    );
  }

  /**
   * Wait for iframe to be ready (has contentWindow)
   */
  protected async waitForIframeReady(maxWait = 5000): Promise<void> {
    if (!this.iframe) {
      throw new Error("No iframe attached");
    }

    if (this.iframe.contentWindow) {
      return; // Already ready
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (this.iframe?.contentWindow) {
          resolve();
        } else if (Date.now() - startTime > maxWait) {
          reject(new Error("Iframe failed to become ready"));
        } else {
          setTimeout(checkReady, 50);
        }
      };

      checkReady();
    });
  }

  /**
   * Set up the message handler for postMessage communication
   */
  protected setupMessageHandler(): void {
    this.messageHandler = (event: MessageEvent) => {
      // Filter by origin
      if (!this.allowedOrigins.includes(event.origin)) {
        return;
      }

      const data = event.data;

      if (!data || typeof data !== "object") {
        return;
      }

      // Handle response to request
      if (data.id && this.pendingRequests.has(data.id)) {
        const request = this.pendingRequests.get(data.id)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(data.id);

        if (data.error) {
          request.reject(new Error(data.error));
        } else {
          request.resolve(data);
        }
        return;
      }

      // Handle player events
      this.handlePlayerEvent(data);
    };

    window.addEventListener("message", this.messageHandler);
  }

  /**
   * Handle player events from iframe
   */
  protected abstract handlePlayerEvent(data: any): void;

  /**
   * Create a promise that waits for a response message
   */
  protected createResponsePromise(requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Timeout waiting for player response"));
      }, this.messageTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
    });
  }

  /**
   * Generate a unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Register an event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Unregister an event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit an event to registered listeners
   */
  protected emit(event: string, payload?: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`Error in adapter event listener for ${event}:`, error);
      }
    });
  }

  // Abstract methods that must be implemented by subclasses
  abstract play(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract seek(time: number): Promise<void>;
  abstract setPlaybackRate(rate: number): Promise<void>;
  abstract getCurrentTime(): Promise<number>;
  abstract getDuration(): Promise<number>;
  abstract isPaused(): Promise<boolean>;
}
