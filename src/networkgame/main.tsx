import {type ComponentChildren, render} from "preact";
import {useSignal} from "@preact/signals";
import "../style.css";
import "./lobby.css";
import {bootGame} from "./game.js";
import {
    bot,
    botPending,
    client,
    clientId,
    error,
    hello,
    isHost,
    playerName,
    room,
    rooms,
    setName,
    startConnection,
    status,
    view,
} from "./lobbyState.js";
import type {RoomMember, RoomSummary} from "../net/protocol.js";

/**
 * Network game page, served at /networkgame/: an HTML lobby (Preact + signals) where the human creates a room and
 * adds a networked AI. Starting the match hides the lobby and boots the Phaser game on a canvas.
 */

let destroyGame: (() => void) | null = null;

function startGame() {
    if (destroyGame) return;
    view.value = "game";
    const container = document.getElementById("game")!;
    container.hidden = false;
    destroyGame = bootGame(container, client, backToLobby);
}

function backToLobby() {
    // Called from inside a Phaser input handler: let it finish before tearing the game down
    setTimeout(() => {
        destroyGame?.();
        destroyGame = null;
        document.getElementById("game")!.hidden = true;
        view.value = "lobby";
        client.send({type: "listRooms"});
    });
}

function StatusBar() {
    const labels = {open: "Connected", connecting: "Connecting…", closed: "Disconnected"};
    return (
        <header class="bar">
            <a class="back" href="../">
                ← Home
            </a>
            <h1>Network game</h1>
            <span class={`status status-${status.value}`}>
                <span class="dot" /> {labels[status.value]}
            </span>
        </header>
    );
}

function NameField() {
    return (
        <label class="field">
            <span>Your name</span>
            <input
                value={playerName.value}
                maxLength={32}
                disabled={!!room.value}
                onInput={event => setName((event.target as HTMLInputElement).value)}
                onBlur={() => hello()}
            />
        </label>
    );
}

function RoomList() {
    const roomName = useSignal("");
    const create = (event: Event) => {
        event.preventDefault();
        client.send({type: "createRoom", name: roomName.value.trim()});
        roomName.value = "";
    };
    return (
        <section class="card">
            <h2>Rooms</h2>
            {rooms.value.length === 0 ? (
                <p class="muted">No rooms yet. Create one below.</p>
            ) : (
                <ul class="rooms">
                    {rooms.value.map(entry => (
                        <RoomRow key={entry.id} entry={entry} />
                    ))}
                </ul>
            )}
            <form class="row" onSubmit={create}>
                <input
                    placeholder={`${playerName.value || "Player"}'s room`}
                    value={roomName.value}
                    maxLength={40}
                    onInput={event => (roomName.value = (event.target as HTMLInputElement).value)}
                />
                <button type="submit" class="primary">
                    Create room
                </button>
            </form>
        </section>
    );
}

function RoomRow({entry}: {entry: RoomSummary}) {
    const human = entry.members.find(member => member.role === "human");
    const full = !!human || entry.state === "playing";
    return (
        <li>
            <span class="room-name">{entry.name}</span>
            <span class="muted">
                {entry.members.length}/2 · {entry.state === "playing" ? "in a match" : "waiting"}
            </span>
            <button type="button" disabled={full} onClick={() => client.send({type: "joinRoom", roomId: entry.id})}>
                Join
            </button>
        </li>
    );
}

function Slot({label, member, children}: {label: string; member: RoomMember | null; children?: ComponentChildren}) {
    return (
        <div class={`slot ${member ? "filled" : ""}`}>
            <span class="slot-label">{label}</span>
            {member ? (
                <span class="slot-name">
                    {member.name}
                    {member.id === clientId.value ? " (you)" : ""}
                </span>
            ) : (
                children
            )}
        </div>
    );
}

function RoomPanel({current}: {current: RoomSummary}) {
    const human = current.members.find(member => member.role === "human") ?? null;
    const addBot = () => {
        botPending.value = true;
        client.send({type: "spawnBot"});
    };
    return (
        <section class="card">
            <h2>{current.name}</h2>
            <div class="slots">
                <Slot label="Player 1 · Human" member={human} />
                <Slot label="Player 2 · Networked AI" member={bot.value}>
                    {isHost.value && (
                        <div class="empty-slot">
                            <button type="button" disabled={botPending.value} onClick={addBot}>
                                {botPending.value ? "Starting AI…" : "Add networked AI"}
                            </button>
                            <span class="muted">
                                or run <code>npm run bot -- {current.id}</code>
                            </span>
                        </div>
                    )}
                </Slot>
            </div>
            <div class="row end">
                <button type="button" onClick={() => client.send({type: "leaveRoom"})}>
                    Leave room
                </button>
                {isHost.value && (
                    <button type="button" class="primary" disabled={!bot.value} onClick={() => client.send({type: "startMatch"})}>
                        Start match
                    </button>
                )}
            </div>
        </section>
    );
}

function Lobby() {
    if (view.value !== "lobby") return null;
    return (
        <div class="lobby">
            <StatusBar />
            <main>
                {status.value !== "open" ? (
                    <section class="card">
                        <h2>No connection to the game server</h2>
                        <p>
                            Start it with <code>npm run server</code>; this page reconnects on its own.
                        </p>
                    </section>
                ) : (
                    <>
                        <NameField />
                        {room.value ? <RoomPanel current={room.value} /> : <RoomList />}
                    </>
                )}
                {error.value && <p class="error">{error.value}</p>}
            </main>
        </div>
    );
}

startConnection(startGame);
render(<Lobby />, document.getElementById("lobby")!);
