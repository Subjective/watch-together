/**
 * Room state and user management types
 */
export interface User {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  users: User[];
  controlMode: ControlMode;
  followMode: FollowMode;
  videoState: VideoState;
  createdAt: number;
  lastActivity: number;
}

export type ControlMode = "HOST_ONLY" | "FREE_FOR_ALL";

export type FollowMode = "AUTO_FOLLOW" | "MANUAL_FOLLOW";

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  url: string;
  lastUpdated: number;
}

/**
 * Extension popup UI state
 */
export interface ExtensionState {
  isConnected: boolean;
  currentRoom: RoomState | null;
  connectionStatus: ConnectionStatus;
  currentUser: User | null;
  followMode: FollowMode;
  hasFollowNotification: boolean;
  followNotificationUrl: string | null;
}

export type ConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

/**
 * Chrome extension message types
 */
export interface BaseExtensionMessage {
  type: string;
  timestamp: number;
}

export interface CreateRoomRequest extends BaseExtensionMessage {
  type: "CREATE_ROOM";
  roomName: string;
  userName: string;
}

export interface JoinRoomRequest extends BaseExtensionMessage {
  type: "JOIN_ROOM";
  roomId: string;
  userName: string;
}

export interface LeaveRoomRequest extends BaseExtensionMessage {
  type: "LEAVE_ROOM";
}

export interface ToggleControlModeRequest extends BaseExtensionMessage {
  type: "TOGGLE_CONTROL_MODE";
}

export interface SetFollowModeRequest extends BaseExtensionMessage {
  type: "SET_FOLLOW_MODE";
  mode: FollowMode;
}

export interface FollowHostRequest extends BaseExtensionMessage {
  type: "FOLLOW_HOST";
}

export interface GetStateRequest extends BaseExtensionMessage {
  type: "GET_STATE";
}

export interface StateUpdateMessage extends BaseExtensionMessage {
  type: "STATE_UPDATE";
  state: ExtensionState;
}

export type ExtensionMessage =
  | CreateRoomRequest
  | JoinRoomRequest
  | LeaveRoomRequest
  | ToggleControlModeRequest
  | SetFollowModeRequest
  | FollowHostRequest
  | GetStateRequest
  | StateUpdateMessage;
