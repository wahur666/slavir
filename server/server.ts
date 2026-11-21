import {type ChildProcess, spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {type RawData, WebSocket, WebSocketServer} from "ws";
import {
    type ClientMessage,
    DEFAULT_SERVER_PORT,
    NET_PROTOCOL_VERSION,
    RELAY_SENDER,
    RELAY_TYPES,
    type RelayMessage,
    type Role,
    type RoomMember,
    type RoomSummary,
    type ServerMessage,
} from "../src/net/protocol.js";

/**
 * Lobby and relay server for network games. Rooms hold one human (the host, whose browser runs the simulation)
 * and one networked AI. The server never simulates; during a match it only forwards messages between the two.
 */

interface Client {
    id: string;
    socket: WebSocket;
    name: string;
    role: Role | null;
    room: Room | null;
}

interface Room {
    id: string;
    name: string;
    hostId: string;
    members: Client[];
    state: "lobby" | "playing";
    /** Bot processes started for this room, killed when the room closes */
    bots: ChildProcess[];
}

export interface ServerOptions {
    port?: number;
    /** Starts a bot process connecting to the room; replaceable in tests */
    spawnBot?: (roomId: string, serverUrl: string) => ChildProcess | null;
    log?: (...args: unknown[]) => void;
}

export interface RunningServer {
    port: number;
    url: string;
    close(): Promise<void>;
}

const BOT_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "bot.ts");

/** Runs server/bot.ts with tsx in a child process */
export function spawnBotProcess(roomId: string, serverUrl: string): ChildProcess {
    return spawn(process.execPath, ["--import", "tsx", BOT_SCRIPT, "--room", roomId, "--url", serverUrl], {stdio: "inherit"});
}

export function startServer(options: ServerOptions = {}): Promise<RunningServer> {
    const log = options.log ?? ((...args: unknown[]) => console.log("[server]", ...args));
    const spawnBot = options.spawnBot ?? spawnBotProcess;
    const clients = new Map<string, Client>();
    const rooms = new Map<string, Room>();
    let roomCounter = 0;

    const wss = new WebSocketServer({port: options.port ?? DEFAULT_SERVER_PORT});

    const send = (client: Client, message: ServerMessage) => {
        if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message));
    };
    const member = (client: Client): RoomMember => ({id: client.id, name: client.name, role: client.role ?? "human"});
    const summary = (room: Room): RoomSummary => ({
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        members: room.members.map(member),
        state: room.state,
    });
    const broadcastRooms = () => {
        const list = [...rooms.values()].map(summary);
        for (const client of clients.values()) {
            if (client.role === "human") send(client, {type: "rooms", rooms: list});
        }
    };
    const broadcastRoom = (room: Room) => {
        for (const client of room.members) send(client, {type: "roomState", room: summary(room)});
        broadcastRooms();
    };

    const closeRoom = (room: Room) => {
        rooms.delete(room.id);
        for (const client of room.members) {
            client.room = null;
            send(client, {type: "roomState", room: null});
        }
        for (const bot of room.bots) if (bot.exitCode === null) bot.kill();
        log(`room ${room.id} closed`);
        broadcastRooms();
    };

    const leaveRoom = (client: Client) => {
        const room = client.room;
        if (!room) return;
        room.members = room.members.filter(other => other !== client);
        client.room = null;
        send(client, {type: "roomState", room: null});
        if (client.id === room.hostId || room.members.length === 0) {
            closeRoom(room);
            return;
        }
        for (const other of room.members) send(other, {type: "peerLeft", member: member(client)});
        // Without its AI the match goes on in the browser; the room is open again for another bot
        broadcastRoom(room);
    };

    const joinRoom = (client: Client, room: Room): string | null => {
        if (client.room === room) return null;
        if (room.members.some(other => other.role === client.role)) return `The room already has a ${client.role}`;
        if (room.state === "playing" && client.role === "human") return "The match already started";
        leaveRoom(client);
        room.members.push(client);
        client.room = room;
        broadcastRoom(room);
        return null;
    };

    const relay = (client: Client, message: RelayMessage) => {
        const room = client.room;
        if (!room || client.role !== RELAY_SENDER[message.type]) return;
        if (message.type === "matchEnd") {
            room.state = "lobby";
            broadcastRoom(room);
        }
        const data = JSON.stringify(message);
        for (const other of room.members) {
            if (other !== client && other.socket.readyState === WebSocket.OPEN) other.socket.send(data);
        }
    };

    const handle = (client: Client, message: ClientMessage) => {
        if (message.type !== "hello" && !client.role) {
            send(client, {type: "error", message: "Say hello first"});
            return;
        }
        switch (message.type) {
            case "hello":
                if (message.protocol !== NET_PROTOCOL_VERSION) {
                    send(client, {
                        type: "error",
                        message: `Protocol ${message.protocol} is not supported, the server speaks ${NET_PROTOCOL_VERSION}`,
                    });
                    client.socket.close();
                    return;
                }
                client.role = message.role === "bot" ? "bot" : "human";
                client.name = String(message.name || (client.role === "bot" ? "Networked AI" : "Player")).slice(0, 32);
                if (client.role === "human") send(client, {type: "rooms", rooms: [...rooms.values()].map(summary)});
                return;
            case "listRooms":
                send(client, {type: "rooms", rooms: [...rooms.values()].map(summary)});
                return;
            case "createRoom": {
                if (client.role !== "human") return;
                const room: Room = {
                    id: `${++roomCounter}`,
                    name: String(message.name || `${client.name}'s room`).slice(0, 40),
                    hostId: client.id,
                    members: [],
                    state: "lobby",
                    bots: [],
                };
                rooms.set(room.id, room);
                log(`room ${room.id} created by ${client.name}`);
                joinRoom(client, room);
                return;
            }
            case "joinRoom": {
                const room = rooms.get(String(message.roomId));
                const error = room ? joinRoom(client, room) : "No such room";
                if (error) send(client, {type: "error", message: error});
                return;
            }
            case "leaveRoom":
                leaveRoom(client);
                return;
            case "spawnBot": {
                const room = client.room;
                if (!room || room.hostId !== client.id) return;
                if (room.members.some(other => other.role === "bot") || room.bots.some(bot => bot.exitCode === null)) {
                    send(client, {type: "error", message: "The room already has an AI"});
                    return;
                }
                const bot = spawnBot(room.id, `ws://localhost:${port}`);
                if (bot) {
                    room.bots.push(bot);
                    bot.on("exit", () => {
                        room.bots = room.bots.filter(other => other !== bot);
                    });
                }
                return;
            }
            case "startMatch": {
                const room = client.room;
                if (!room || room.hostId !== client.id) return;
                if (!room.members.some(other => other.role === "bot")) {
                    send(client, {type: "error", message: "Add a networked AI first"});
                    return;
                }
                room.state = "playing";
                for (const other of room.members) send(other, {type: "matchStarting", room: summary(room)});
                broadcastRoom(room);
                return;
            }
            default:
                if (RELAY_TYPES.has(message.type)) relay(client, message as RelayMessage);
        }
    };

    wss.on("connection", socket => {
        const client: Client = {id: randomUUID(), socket, name: "", role: null, room: null};
        clients.set(client.id, client);
        send(client, {type: "welcome", clientId: client.id});
        socket.on("message", (data: RawData) => {
            let message: ClientMessage;
            try {
                message = JSON.parse(data.toString());
            } catch {
                send(client, {type: "error", message: "Not JSON"});
                return;
            }
            if (!message || typeof message.type !== "string") return;
            handle(client, message);
        });
        socket.on("close", () => {
            leaveRoom(client);
            clients.delete(client.id);
        });
    });

    let port = 0;
    return new Promise((resolve, reject) => {
        wss.once("error", reject);
        wss.once("listening", () => {
            const address = wss.address();
            port = typeof address === "object" && address ? address.port : (options.port ?? DEFAULT_SERVER_PORT);
            log(`listening on ws://localhost:${port}`);
            resolve({
                port,
                url: `ws://localhost:${port}`,
                close: () =>
                    new Promise<void>(done => {
                        for (const room of [...rooms.values()]) closeRoom(room);
                        for (const client of clients.values()) client.socket.terminate();
                        wss.close(() => done());
                    }),
            });
        });
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const port = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
    startServer({port}).catch(error => {
        console.error(error);
        process.exit(1);
    });
}
