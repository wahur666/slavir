import type Unit from "../../entities/Unit.js";
import type Systems from "../Systems.js";
import type Player from "../player/Player.js";
import type {Command, TileRef} from "./Command.js";
import type GameTile from "../GameTile.js";
import type {Order} from "./Order.js";
import {AttackBaseOrder, AttackOrder, MoveOrder} from "./Order.js";
import {Buildings} from "../../entities/Building.js";
import type {ReplayEntry} from "../replay/Replay.js";

export interface CommandInfo {
    /** The simulation tick the command took effect on */
    tick: number;
    /**
     * Player input from outside the simulation (human clicks, a network peer, a replay). Commands issued while a
     * tick runs (AI, auto attack) are derived from the simulation state and come back on their own in a replay.
     */
    external: boolean;
}

export type CommandListener = (command: Command, info: CommandInfo) => void;

/**
 * The single entry point for unit commands. Human input, the AI, and (later) network
 * peers all call {@link issue} with the same serializable {@link Command}; the hub
 * validates it, turns it into per-unit {@link Order}s, and steps those orders.
 *
 * The scene brackets every simulation tick with {@link beginTick} / {@link endTick}. Commands issued between
 * two ticks are external input and take effect on the next tick; during playback external input is ignored
 * and the recorded commands are executed at the start of their tick instead.
 */
export default class CommandHub {
    private readonly orders = new Map<Unit, Order>();
    private readonly listeners: CommandListener[] = [];
    /** The tick that runs now, or the next one when called between ticks */
    private tick = 0;
    private inTick = false;
    private playback: {entries: ReplayEntry[]; cursor: number} | null = null;
    /** Set while the recorded commands of a tick are executed */
    private replaying = false;

    constructor(private readonly systems: Systems) {}

    /** Called for every accepted command, e.g. to send local commands to a network peer or record a replay */
    onCommand(listener: CommandListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    /** Feed the commands of a replay back instead of accepting external input */
    startPlayback(entries: ReplayEntry[]): void {
        this.playback = {entries, cursor: 0};
    }

    get isPlayingBack(): boolean {
        return this.playback !== null;
    }

    /** Called by the scene before anything else happens in a simulation tick */
    beginTick(tick: number): void {
        this.tick = tick;
        this.inTick = true;
        if (!this.playback) return;
        const {entries} = this.playback;
        this.replaying = true;
        while (this.playback.cursor < entries.length && entries[this.playback.cursor].tick <= tick) {
            const {command, tick: recordedTick} = entries[this.playback.cursor++];
            if (!this.issue(command)) console.warn(`Replay command rejected at tick ${tick} (recorded at ${recordedTick})`, command);
        }
        this.replaying = false;
    }

    /** Called by the scene after a simulation tick finished */
    endTick(): void {
        this.inTick = false;
        this.tick++;
    }

    /**
     * Validates and executes a command right away.
     * @returns false if the command was rejected (game not running, unknown player, no own living unit,
     * invalid target, building, unit or power not affordable / not available / on cooldown / over the unit cap,
     * power aimed at a tile it may not be used on,
     * external input during playback)
     */
    issue(command: Command): boolean {
        const external = !this.inTick || this.replaying;
        if (this.playback && external && !this.replaying) return false;
        if (!this.systems.gameScene.canIssueCommands) return false;
        const player = this.systems.players.find(p => p.index === command.playerIndex);
        if (!player) return false;
        let accepted: boolean;
        switch (command.kind) {
            case "build":
                accepted = this.build(player, command.building);
                break;
            case "createUnit":
                accepted = player.createUnit(command.unit) !== null;
                break;
            case "power":
                accepted = player.powers.use(command.power, this.resolveTile(command.tile));
                break;
            case "surrender":
                this.systems.gameScene.endGame(player !== this.systems.player1);
                accepted = true;
                break;
            default:
                accepted = this.commandUnits(player, command);
        }
        if (accepted) this.listeners.forEach(listener => listener(command, {tick: this.tick, external}));
        return accepted;
    }

    private build(player: Player, building: Buildings): boolean {
        if (building === Buildings.CASTLE || building === Buildings.SPAWN) return false;
        return player.createBuilding(building) !== null;
    }

    private commandUnits(player: Player, command: Exclude<Command, {kind: "build" | "createUnit" | "power" | "surrender"}>): boolean {
        // Structures (turrets) cannot be moved; they still attack (their auto attack is an order too).
        // Only mobile units that deal damage to structures can attack the base.
        const units = command.unitIds
            .map(id => player.units.find(unit => unit.id === id))
            .filter((unit): unit is Unit => !!unit && !unit.markedForDeletion && !(unit.immobile && command.kind === "move"))
            .filter(unit => command.kind !== "attackBase" || unit.canAttackBase);
        if (units.length === 0) return false;

        switch (command.kind) {
            case "move": {
                const tile = this.resolveTile(command.tile);
                if (!tile) return false;
                units.forEach(unit => this.assign(unit, new MoveOrder(tile)));
                break;
            }
            case "attack": {
                const target = this.findEnemyUnit(player, command.targetId);
                if (!target) return false;
                units.forEach(unit => this.assign(unit, new AttackOrder(target)));
                break;
            }
            case "attackBase": {
                const enemy = player.enemyPlayer;
                if (enemy.baseTiles.length === 0) return false;
                units.forEach(unit => this.assign(unit, new AttackBaseOrder(enemy)));
                break;
            }
            case "stop":
                units.forEach(unit => this.clear(unit));
                break;
            case "disband":
                units.forEach(unit => {
                    this.forget(unit);
                    player.disband(unit);
                });
                break;
        }
        return true;
    }

    /** Steps the active orders and drops the finished ones */
    update(delta: number): void {
        for (const [unit, order] of this.orders) {
            if (unit.markedForDeletion || order.update(unit, delta) === "done") {
                this.orders.delete(unit);
            }
        }
    }

    /** The order the unit is executing, if any */
    orderOf(unit: Unit): Order | undefined {
        return this.orders.get(unit);
    }

    /** Drops the bookkeeping of a unit without touching it, used when the unit is removed */
    forget(unit: Unit): void {
        this.orders.delete(unit);
    }

    /** Converts a tile to the reference used inside commands */
    static tileRef(tile: GameTile): TileRef {
        return {col: tile.x, row: tile.y};
    }

    private assign(unit: Unit, order: Order): void {
        this.orders.delete(unit);
        this.orders.set(unit, order);
        order.start(unit);
    }

    private clear(unit: Unit): void {
        const order = this.orders.get(unit);
        this.orders.delete(unit);
        if (order) {
            order.cancel(unit);
        } else {
            unit.stopUnitWhenHexCenterIsReached();
        }
    }

    private resolveTile(ref: TileRef): GameTile | undefined {
        const tile = this.systems.map.coordsToTile(ref.col, ref.row);
        return tile && tile.x === ref.col && tile.y === ref.row ? tile : undefined;
    }

    /** Only enemies the issuer can currently see are valid targets */
    private findEnemyUnit(player: Player, id: number): Unit | undefined {
        return player.visibleEnemyUnits.find(unit => unit.id === id && !unit.markedForDeletion);
    }
}
