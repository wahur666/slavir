import type {MatchInfo, Observation, WireCommand} from "./Observation.js";

/**
 * Messages between the lobby page, the WebSocket server and bots, as JSON text frames.
 *
 * The server keeps rooms and relays the match messages between the room's human (who runs the simulation in the
 * browser) and its networked AI. It never simulates anything itself.
 */

export const NET_PROTOCOL_VERSION = 1;
/** Away from 8081 and up, where Vite moves when its port is taken */
export const DEFAULT_SERVER_PORT = 8090;
/** Path the dev server proxies to the WebSocket server */
export const WS_PATH = "/ws";

export type Role = "human" | "bot";

export interface RoomMember {
    id: string;
    name: string;
    role: Role;
}

export interface RoomSummary {
    id: string;
    name: string;
    /** Client id of the human who created the room and runs the simulation */
    hostId: string;
    members: RoomMember[];
    state: "lobby" | "playing";
}

/** Match traffic, relayed as is between the two members of a room */
export type RelayMessage =
    /** Host → bot, once at match start */
    | {type: "matchStart"; info: MatchInfo}
    /** Host → bot, every {@link MatchInfo.observationIntervalMs} of simulation time */
    | {type: "observation"; obs: Observation}
    /** Bot → host: commands decided on the observation of `tick` */
    | {type: "commands"; tick: number; commands: WireCommand[]}
    /** Host → bot; winnerIndex is null when the match was abandoned */
    | {type: "matchEnd"; winnerIndex: number | null};

export type ClientMessage =
    | {type: "hello"; role: Role; name: string; protocol: number}
    | {type: "listRooms"}
    | {type: "createRoom"; name: string}
    | {type: "joinRoom"; roomId: string}
    | {type: "leaveRoom"}
    /** Ask the server to start a bot process for the sender's room */
    | {type: "spawnBot"}
    /** Host only, needs a bot in the room */
    | {type: "startMatch"}
    | RelayMessage;

export type ServerMessage =
    | {type: "welcome"; clientId: string}
    | {type: "rooms"; rooms: RoomSummary[]}
    /** The room the client is in, null after leaving */
    | {type: "roomState"; room: RoomSummary | null}
    | {type: "matchStarting"; room: RoomSummary}
    | {type: "peerLeft"; member: RoomMember}
    | {type: "error"; message: string}
    | RelayMessage;

export const RELAY_TYPES = new Set<string>(["matchStart", "observation", "commands", "matchEnd"]);

/** Which role may send each relay message */
export const RELAY_SENDER: Record<RelayMessage["type"], Role> = {
    matchStart: "human",
    observation: "human",
    matchEnd: "human",
    commands: "bot",
};
