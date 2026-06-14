export enum MsgType {
  // Lobby / Hub Messages
  C2S_CONNECT = "C2S_CONNECT",
  S2C_CONNECT_OK = "S2C_CONNECT_OK",
  
  C2S_CHAT = "C2S_CHAT",
  S2C_CHAT = "S2C_CHAT",

  S2C_HUB_STATE = "S2C_HUB_STATE",

  C2S_JOIN_MATCHMAKING = "C2S_JOIN_MATCHMAKING",
  C2S_LEAVE_MATCHMAKING = "C2S_LEAVE_MATCHMAKING",
  S2C_MATCHMAKING_STATUS = "S2C_MATCHMAKING_STATUS",

  C2S_PARTY_INVITE = "C2S_PARTY_INVITE",
  C2S_PARTY_ACCEPT = "C2S_PARTY_ACCEPT",
  S2C_PARTY_UPDATE = "S2C_PARTY_UPDATE",

  C2S_SELECT_CHARACTER = "C2S_SELECT_CHARACTER",

  // Game Run Messages
  S2C_RUN_START = "S2C_RUN_START",
  C2S_INPUT = "C2S_INPUT",
  S2C_SNAPSHOT = "S2C_SNAPSHOT",
  S2C_SPAWN_PATTERN = "S2C_SPAWN_PATTERN",
  S2C_ROOM_CHANGED = "S2C_ROOM_CHANGED",
  S2C_RUN_RECAP = "S2C_RUN_RECAP",

  // Progression / Crafting Messages
  C2S_CRAFT_ACTION = "C2S_CRAFT_ACTION",
  C2S_TALENT_UNLOCK = "C2S_TALENT_UNLOCK",
  S2C_CHARACTER_UPDATE = "S2C_CHARACTER_UPDATE"
}

export interface WSMessage {
  type: MsgType;
  payload: any;
}

// Input structure sent by the client
export interface PlayerInput {
  sequenceNumber: number;
  keys: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    dash: boolean;
    ult1: boolean;
    ult2: boolean;
  };
  mouseAngle: number;
}
