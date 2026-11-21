import type Unit from "../../entities/Unit";
import type Systems from "../Systems";
import type Player from "../player/Player";
import type {Command, TileRef} from "./Command";
import type GameTile from "../GameTile";
import type {Order} from "./Order";
import {AttackOrder, MoveOrder} from "./Order";
import {Buildings} from "../../entities/Building";

export type CommandListener = (command: Command) => void;

/**
 * The single entry point for unit commands. Human input, the AI, and (later) network
 * peers all call {@link issue} with the same serializable {@link Command}; the hub
 * validates it, turns it into per-unit {@link Order}s, and steps those orders.
 */
export default class CommandHub {
    private readonly orders = new Map<Unit, Order>();
    private readonly listeners: CommandListener[] = [];

    constructor(private readonly systems: Systems) {}

    /** Called for every accepted command, e.g. to send local commands to a network peer or record a replay */
    onCommand(listener: CommandListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    /**
     * Validates and executes a command right away.
     * @returns false if the command was rejected (game not running, unknown player, no own living unit,
     * invalid target, building or unit not affordable / not available / on cooldown / over the unit cap)
     */
    issue(command: Command): boolean {
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
            default:
                accepted = this.commandUnits(player, command);
        }
        if (accepted) this.listeners.forEach(listener => listener(command));
        return accepted;
    }

    private build(player: Player, building: Buildings): boolean {
        if (building === Buildings.CASTLE || building === Buildings.SPAWN) return false;
        return player.createBuilding(building) !== null;
    }

    private commandUnits(player: Player, command: Exclude<Command, {kind: "build" | "createUnit"}>): boolean {
        const units = command.unitIds
            .map(id => player.units.find(unit => unit.id === id))
            .filter((unit): unit is Unit => !!unit && !unit.markedForDeletion);
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
            case "stop":
                units.forEach(unit => this.clear(unit));
                break;
            case "disband":
                units.forEach(unit => {
                    this.forget(unit);
                    void player.disband(unit);
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
