import {afterAll, afterEach, beforeAll, describe, expect, it} from "vitest";
import {type RunningServer, startServer} from "../../../server/server.js";
import NetClient from "../../../src/net/NetClient.js";
import {NET_PROTOCOL_VERSION, type ServerMessage} from "../../../src/net/protocol.js";
import type {Observation} from "../../../src/net/Observation.js";

let server: RunningServer;
const spawned: string[] = [];
const clients: NetClient[] = [];

beforeAll(async () => {
    server = await startServer({
        port: 0,
        log: () => {},
        spawnBot: roomId => {
            spawned.push(roomId);
            return null;
        },
    });
});

afterAll(() => server.close());

afterEach(() => {
    clients.splice(0).forEach(client => client.close());
});

/** Resolves with the next message of the type that matches */
function next<T extends ServerMessage["type"]>(
    client: NetClient,
    type: T,
    match: (message: Extract<ServerMessage, {type: T}>) => boolean = () => true
): Promise<Extract<ServerMessage, {type: T}>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No ${type} message`)), 2000);
        const off = client.on(type, message => {
            if (!match(message)) return;
            clearTimeout(timer);
            off();
            resolve(message);
        });
    });
}

async function connect(role: "human" | "bot", name: string): Promise<{client: NetClient; id: string}> {
    const client = new NetClient(server.url);
    clients.push(client);
    const welcome = next(client, "welcome");
    const opened = new Promise<void>(resolve => client.onStatus(status => status === "open" && resolve()));
    client.connect();
    await opened;
    const {clientId} = await welcome;
    client.send({type: "hello", role, name, protocol: NET_PROTOCOL_VERSION});
    return {client, id: clientId};
}

async function roomWithBot() {
    const host = await connect("human", "Host");
    const created = next(host.client, "roomState", message => !!message.room);
    host.client.send({type: "createRoom", name: "Test room"});
    const roomId = (await created).room!.id;
    const bot = await connect("bot", "Bot");
    const joined = next(host.client, "roomState", message => message.room?.members.length === 2);
    bot.client.send({type: "joinRoom", roomId});
    return {host, bot, roomId, room: (await joined).room!};
}

const observation = {tick: 60} as Observation;

describe("network game server", () => {
    it("puts a host and a bot in one room", async () => {
        const {host, room} = await roomWithBot();
        expect(room.hostId).toBe(host.id);
        expect(room.members.map(member => member.role).sort()).toEqual(["bot", "human"]);
    });

    it("relays observations to the bot and commands to the host", async () => {
        const {host, bot} = await roomWithBot();
        const starting = Promise.all([next(host.client, "matchStarting"), next(bot.client, "matchStarting")]);
        host.client.send({type: "startMatch"});
        await starting;

        const received = next(bot.client, "observation");
        host.client.send({type: "observation", obs: observation});
        expect((await received).obs.tick).toBe(60);

        const commands = next(host.client, "commands");
        bot.client.send({type: "commands", tick: 60, commands: [{kind: "createUnit", playerIndex: 2, unit: "fantasy8"}]});
        expect((await commands).commands).toEqual([{kind: "createUnit", playerIndex: 2, unit: "fantasy8"}]);
    });

    it("drops relay messages sent by the wrong role", async () => {
        const {host, bot} = await roomWithBot();
        let leaked = false;
        host.client.on("observation", () => (leaked = true));
        bot.client.send({type: "observation", obs: observation});
        // A message the host does receive, sent after the dropped one
        const commands = next(host.client, "commands");
        bot.client.send({type: "commands", tick: 1, commands: []});
        await commands;
        expect(leaked).toBe(false);
    });

    it("needs a bot to start and lets only the host start", async () => {
        const host = await connect("human", "Alone");
        const created = next(host.client, "roomState", message => !!message.room);
        host.client.send({type: "createRoom", name: "Empty"});
        await created;
        const error = next(host.client, "error");
        host.client.send({type: "startMatch"});
        expect((await error).message).toMatch(/networked AI/);
    });

    it("asks for a bot process for the host's room", async () => {
        const host = await connect("human", "Spawner");
        const created = next(host.client, "roomState", message => !!message.room);
        host.client.send({type: "createRoom", name: "Spawn"});
        const roomId = (await created).room!.id;
        host.client.send({type: "spawnBot"});
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(spawned).toContain(roomId);
    });

    it("tells the host when the bot leaves, and closes the room when the host leaves", async () => {
        const {host, bot, roomId} = await roomWithBot();
        const left = next(host.client, "peerLeft");
        bot.client.close();
        expect((await left).member.role).toBe("bot");

        const watcher = await connect("human", "Watcher");
        await next(watcher.client, "rooms");
        const closed = next(watcher.client, "rooms", message => !message.rooms.some(room => room.id === roomId));
        host.client.send({type: "leaveRoom"});
        await closed;
    });
});
