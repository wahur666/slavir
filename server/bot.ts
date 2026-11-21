import {parseArgs} from "node:util";
import {pathToFileURL} from "node:url";
import NetClient from "../src/net/NetClient.js";
import {DEFAULT_SERVER_PORT, NET_PROTOCOL_VERSION} from "../src/net/protocol.js";
import BotBrain from "./botBrain.js";

/**
 * The networked AI: joins a room over WebSocket, receives the match info and an observation every second from the
 * host's browser, and answers each with the commands {@link BotBrain} decides on.
 *
 *   npm run bot -- <roomId>            join a room on the local server
 *   npm run bot -- --room 3 --url ws://host:8090
 */

export interface BotOptions {
    roomId: string;
    url: string;
    name?: string;
    log?: (...args: unknown[]) => void;
}

export function runBot(options: BotOptions): NetClient {
    const log = options.log ?? ((...args: unknown[]) => console.log(`[bot ${options.roomId}]`, ...args));
    const client = new NetClient(options.url);
    let brain: BotBrain | null = null;
    let joined = false;

    client.onStatus(status => {
        if (status === "open") {
            client.send({type: "hello", role: "bot", name: options.name ?? "Networked AI", protocol: NET_PROTOCOL_VERSION});
            client.send({type: "joinRoom", roomId: options.roomId});
        } else if (status === "closed") {
            log("disconnected");
        }
    });
    client.on("error", message => log("server error:", message.message));
    client.on("roomState", ({room}) => {
        if (room) {
            joined = true;
        } else if (joined) {
            // The room closed (the host left): nothing left to do
            log("room closed");
            client.close();
        }
    });
    client.on("matchStart", ({info}) => {
        brain = new BotBrain(info);
        log(`match started, playing player ${info.playerIndex}`);
    });
    client.on("observation", ({obs}) => {
        if (!brain) return;
        const commands = brain.decide(obs);
        if (commands.length > 0) client.send({type: "commands", tick: obs.tick, commands});
    });
    client.on("matchEnd", ({winnerIndex}) => {
        log(winnerIndex === null ? "match abandoned" : winnerIndex === brain?.info.playerIndex ? "won" : "lost");
        brain = null;
    });
    client.connect();
    return client;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const {values, positionals} = parseArgs({
        options: {room: {type: "string"}, url: {type: "string"}, name: {type: "string"}},
        allowPositionals: true,
    });
    const roomId = values.room ?? positionals[0];
    if (!roomId) {
        console.error("Usage: npm run bot -- <roomId> [--url ws://localhost:8090] [--name Name]");
        process.exit(1);
    }
    const client = runBot({roomId, url: values.url ?? `ws://localhost:${DEFAULT_SERVER_PORT}`, name: values.name});
    client.onStatus(status => {
        if (status === "closed") process.exit(0);
    });
}
