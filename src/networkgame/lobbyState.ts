import {computed, signal} from "@preact/signals";
import NetClient, {type ConnectionStatus} from "../net/NetClient.js";
import {NET_PROTOCOL_VERSION, type RoomSummary, WS_PATH} from "../net/protocol.js";

/** Lobby state as signals; the components read them and re-render on change */

const NAME_KEY = "slavir.playerName";

function loadName(): string {
    try {
        return localStorage.getItem(NAME_KEY) || "Player";
    } catch {
        return "Player";
    }
}

/** ?server=ws://host:port overrides the default, the dev server's /ws proxy on the page's own origin */
function serverUrl(): string {
    const override = new URLSearchParams(location.search).get("server");
    if (override) return override;
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${WS_PATH}`;
}

export const client = new NetClient(serverUrl());
export const status = signal<ConnectionStatus>("closed");
export const clientId = signal<string | null>(null);
export const rooms = signal<RoomSummary[]>([]);
export const room = signal<RoomSummary | null>(null);
export const error = signal<string | null>(null);
export const view = signal<"lobby" | "game">("lobby");
export const playerName = signal(loadName());
/** "Add AI" was clicked and the bot has not joined yet */
export const botPending = signal(false);

export const isHost = computed(() => !!room.value && room.value.hostId === clientId.value);
export const bot = computed(() => room.value?.members.find(member => member.role === "bot") ?? null);

export function setName(name: string) {
    playerName.value = name;
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch {
        // Not remembered, fine
    }
}

export function hello() {
    client.send({type: "hello", role: "human", name: playerName.value.trim() || "Player", protocol: NET_PROTOCOL_VERSION});
}

let errorTimer: ReturnType<typeof setTimeout> | undefined;
function showError(message: string) {
    error.value = message;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (error.value = null), 5000);
}

let started = false;
/** Connects and keeps reconnecting while the lobby is open */
export function startConnection(onMatchStarting: () => void) {
    if (started) return;
    started = true;
    client.onStatus(next => {
        status.value = next;
        if (next === "open") hello();
        if (next === "closed") {
            room.value = null;
            botPending.value = false;
            setTimeout(() => client.connect(), 2000);
        }
    });
    client.on("welcome", message => (clientId.value = message.clientId));
    client.on("rooms", message => (rooms.value = message.rooms));
    client.on("roomState", message => {
        room.value = message.room;
        if (!message.room || message.room.members.some(member => member.role === "bot")) botPending.value = false;
    });
    client.on("error", message => {
        botPending.value = false;
        showError(message.message);
    });
    client.on("matchStarting", message => {
        room.value = message.room;
        onMatchStarting();
    });
    client.connect();
}
