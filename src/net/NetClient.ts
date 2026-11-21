import type {ClientMessage, ServerMessage} from "./protocol.js";

type Handler<T extends ServerMessage["type"]> = (message: Extract<ServerMessage, {type: T}>) => void;

export type ConnectionStatus = "connecting" | "open" | "closed";

/**
 * Small typed wrapper around the standard WebSocket, used by the lobby page, the game and bots
 * (browsers and Node 22+ both have a global WebSocket).
 */
export default class NetClient {
    private socket: WebSocket | null = null;
    private readonly handlers = new Map<string, Set<(message: any) => void>>();
    private readonly statusHandlers = new Set<(status: ConnectionStatus) => void>();
    status: ConnectionStatus = "closed";

    constructor(readonly url: string) {}

    connect(): void {
        if (this.socket) return;
        this.setStatus("connecting");
        const socket = new WebSocket(this.url);
        this.socket = socket;
        socket.addEventListener("open", () => this.setStatus("open"));
        socket.addEventListener("close", () => {
            if (this.socket === socket) this.socket = null;
            this.setStatus("closed");
        });
        socket.addEventListener("message", event => {
            let message: ServerMessage;
            try {
                message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
            } catch {
                return;
            }
            this.handlers.get(message.type)?.forEach(handler => handler(message));
        });
    }

    close(): void {
        this.socket?.close();
        this.socket = null;
    }

    send(message: ClientMessage): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
        this.socket.send(JSON.stringify(message));
        return true;
    }

    /** @returns a function removing the handler */
    on<T extends ServerMessage["type"]>(type: T, handler: Handler<T>): () => void {
        let set = this.handlers.get(type);
        if (!set) {
            set = new Set();
            this.handlers.set(type, set);
        }
        set.add(handler);
        return () => set.delete(handler);
    }

    onStatus(handler: (status: ConnectionStatus) => void): () => void {
        this.statusHandlers.add(handler);
        return () => this.statusHandlers.delete(handler);
    }

    private setStatus(status: ConnectionStatus) {
        this.status = status;
        this.statusHandlers.forEach(handler => handler(status));
    }
}
