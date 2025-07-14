/**
 * Video player adapter interface and related types
 */
export interface IPlayerAdapter {
  /**
   * Control methods
   */
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;

  /**
   * State methods
   */
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  isPaused(): Promise<boolean>;

  /**
   * Event subscription
   */
  on(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: any) => void,
  ): void;

  off(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: any) => void,
  ): void;

  /**
   * Cleanup
   */
  destroy(): void;
}

/**
 * Adapter factory and registry types
 */
export interface AdapterInfo {
  name: string;
  tier: AdapterTier;
  domains: string[];
  description: string;
  createAdapter: () => IPlayerAdapter;
}

export type AdapterTier = "PROPRIETARY" | "IFRAME_API" | "HTML5" | "FALLBACK";

export interface AdapterDetection {
  supported: boolean;
  confidence: number;
  tier: AdapterTier;
}

export interface AdapterDetectionResult {
  adapter: IPlayerAdapter | null;
  adapterName: string;
  tier: AdapterTier;
  success: boolean;
  error?: string;
}

/**
 * Content script communication types
 */
export interface AdapterEventMessage {
  type: "ADAPTER_EVENT";
  event: "play" | "pause" | "seeking" | "seeked" | "timeupdate";
  payload?: {
    currentTime?: number;
    duration?: number;
    isPaused?: boolean;
  };
  sourceUrl: string;
  timestamp: number;
}

export interface AdapterCommandMessage {
  type: "ADAPTER_COMMAND";
  command: "play" | "pause" | "seek" | "setPlaybackRate";
  payload?: {
    time?: number;
    rate?: number;
  };
  timestamp: number;
}

export interface AdapterStateRequestMessage {
  type: "ADAPTER_STATE_REQUEST";
  timestamp: number;
}

export interface AdapterStateResponseMessage {
  type: "ADAPTER_STATE_RESPONSE";
  state: {
    currentTime: number;
    duration: number;
    isPaused: boolean;
    playbackRate: number;
  };
  timestamp: number;
}

export type AdapterMessage =
  | AdapterEventMessage
  | AdapterCommandMessage
  | AdapterStateRequestMessage
  | AdapterStateResponseMessage;
