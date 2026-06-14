export var MsgType;
(function (MsgType) {
    // Lobby / Hub Messages
    MsgType["C2S_CONNECT"] = "C2S_CONNECT";
    MsgType["S2C_CONNECT_OK"] = "S2C_CONNECT_OK";
    MsgType["C2S_CHAT"] = "C2S_CHAT";
    MsgType["S2C_CHAT"] = "S2C_CHAT";
    MsgType["S2C_HUB_STATE"] = "S2C_HUB_STATE";
    MsgType["C2S_JOIN_MATCHMAKING"] = "C2S_JOIN_MATCHMAKING";
    MsgType["C2S_LEAVE_MATCHMAKING"] = "C2S_LEAVE_MATCHMAKING";
    MsgType["S2C_MATCHMAKING_STATUS"] = "S2C_MATCHMAKING_STATUS";
    MsgType["C2S_PARTY_INVITE"] = "C2S_PARTY_INVITE";
    MsgType["C2S_PARTY_ACCEPT"] = "C2S_PARTY_ACCEPT";
    MsgType["S2C_PARTY_UPDATE"] = "S2C_PARTY_UPDATE";
    MsgType["C2S_SELECT_CHARACTER"] = "C2S_SELECT_CHARACTER";
    // Game Run Messages
    MsgType["S2C_RUN_START"] = "S2C_RUN_START";
    MsgType["C2S_INPUT"] = "C2S_INPUT";
    MsgType["S2C_SNAPSHOT"] = "S2C_SNAPSHOT";
    MsgType["S2C_SPAWN_PATTERN"] = "S2C_SPAWN_PATTERN";
    MsgType["S2C_ROOM_CHANGED"] = "S2C_ROOM_CHANGED";
    MsgType["S2C_RUN_RECAP"] = "S2C_RUN_RECAP";
    // Progression / Crafting Messages
    MsgType["C2S_CRAFT_ACTION"] = "C2S_CRAFT_ACTION";
    MsgType["C2S_TALENT_UNLOCK"] = "C2S_TALENT_UNLOCK";
    MsgType["S2C_CHARACTER_UPDATE"] = "S2C_CHARACTER_UPDATE";
})(MsgType || (MsgType = {}));
