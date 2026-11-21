import type {Command} from "../command/Command.js";
import type Systems from "../Systems.js";

/**
 * A replay is the list of external commands (player input) with the simulation tick they took effect on.
 * Everything else (AI decisions, auto attacks, combat) is derived from the simulation, which is deterministic
 * because it runs in fixed ticks of {@link TICK_MS}. Playing a replay starts a fresh match and feeds the
 * recorded commands back at the same ticks.
 *
 * Replays are only valid for the same game version (any rule or AI change makes them diverge), and the
 * checkpoints detect when that happens.
 */
export const REPLAY_FORMAT = "slavir-replay";
export const REPLAY_VERSION = 2;

/** Length of one simulation tick; matches the arcade physics step (60 fps) */
export const TICK_MS = 1000 / 60;

/** A state hash is stored every this many ticks to detect when a replay diverges */
export const CHECKPOINT_INTERVAL = 300;

export interface ReplayEntry {
    /** The tick the command was executed at, before anything else in that tick */
    tick: number;
    command: Command;
}

export interface ReplayCheckpoint {
    tick: number;
    hash: string;
}

export interface Replay {
    format: typeof REPLAY_FORMAT;
    version: number;
    tickMs: number;
    recordedAt: string;
    /** Tick count when the match ended */
    endTick: number;
    /** Whether player 1 won; null if the match was not finished */
    result: boolean | null;
    commands: ReplayEntry[];
    checkpoints: ReplayCheckpoint[];
}

/** Collects the external commands and the state checkpoints of a match */
export class ReplayRecorder {
    private readonly commands: ReplayEntry[] = [];
    private readonly checkpoints: ReplayCheckpoint[] = [];
    private readonly unsubscribe: () => void;

    constructor(private readonly systems: Systems) {
        this.unsubscribe = systems.commands.onCommand((command, info) => {
            if (info.external) this.commands.push({tick: info.tick, command: structuredClone(command)});
        });
    }

    /** Call after every simulation tick */
    afterTick(tick: number): ReplayCheckpoint | null {
        if (tick % CHECKPOINT_INTERVAL !== 0) return null;
        const checkpoint = {tick, hash: stateHash(this.systems)};
        this.checkpoints.push(checkpoint);
        return checkpoint;
    }

    finish(endTick: number, result: boolean | null): Replay {
        this.unsubscribe();
        return {
            format: REPLAY_FORMAT,
            version: REPLAY_VERSION,
            tickMs: TICK_MS,
            recordedAt: new Date().toISOString(),
            endTick,
            result,
            commands: this.commands,
            checkpoints: this.checkpoints,
        };
    }
}

/** Compares the state of a replayed match with the checkpoints of the recording */
export class ReplayVerifier {
    private readonly expected: Map<number, string>;
    /** First tick where the replay diverged from the recording, null while in sync */
    desyncTick: number | null = null;

    constructor(replay: Replay) {
        this.expected = new Map(replay.checkpoints.map(checkpoint => [checkpoint.tick, checkpoint.hash]));
    }

    check(checkpoint: ReplayCheckpoint): void {
        const expected = this.expected.get(checkpoint.tick);
        if (this.desyncTick === null && expected !== undefined && expected !== checkpoint.hash) {
            this.desyncTick = checkpoint.tick;
            console.warn(`Replay desync at tick ${checkpoint.tick}: expected ${expected}, got ${checkpoint.hash}`);
        }
    }
}

/** Short hash of the simulation state that matters for the outcome */
export function stateHash(systems: Systems): string {
    const parts: (string | number)[] = [];
    for (const player of systems.players) {
        parts.push(player.index, player.resource, player.currentBaseHealth, player.createCoolDown);
        parts.push(...Object.values(player.powers.coolDowns), ...player.powers.strikes.map(strike => strike.elapsed));
        for (const unit of player.units) {
            parts.push(unit.id, Math.round(unit.x * 100), Math.round(unit.y * 100), unit.currentHealth, unit.markedForDeletion ? 1 : 0);
        }
    }
    parts.push(systems.objective.currentCoolDown);
    // FNV-1a, 32 bit
    let hash = 0x811c9dc5;
    for (const char of parts.join(",")) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Validates a parsed replay file; throws with a readable message if it is not one */
export function parseReplay(text: string): Replay {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("Not a JSON file");
    }
    const replay = data as Partial<Replay>;
    if (!replay || replay.format !== REPLAY_FORMAT) throw new Error("Not a Slavir replay");
    if (replay.version !== REPLAY_VERSION) throw new Error(`Unsupported replay version ${replay.version}`);
    if (replay.tickMs !== TICK_MS) throw new Error("Replay was recorded with a different tick rate");
    if (!Array.isArray(replay.commands) || !Array.isArray(replay.checkpoints) || typeof replay.endTick !== "number") {
        throw new Error("Replay file is incomplete");
    }
    for (const entry of replay.commands) {
        if (typeof entry?.tick !== "number" || typeof entry.command?.kind !== "string" || typeof entry.command.playerIndex !== "number") {
            throw new Error("Replay contains an invalid command");
        }
    }
    // Commands must be fed back in tick order
    replay.commands.sort((a, b) => a.tick - b.tick);
    return replay as Replay;
}

/** Offers the replay to the browser as a JSON download */
export function downloadReplay(replay: Replay): void {
    const stamp = replay.recordedAt.replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const blob = new Blob([JSON.stringify(replay)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slavir-replay-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Opens a file picker and resolves with the chosen replay, or null if the picker was cancelled */
export function pickReplayFile(): Promise<Replay | null> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("cancel", () => resolve(null));
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            try {
                resolve(parseReplay(await file.text()));
            } catch (error) {
                reject(error);
            }
        });
        input.click();
    });
}
