import type {Buildings} from "../../entities/Building.js";
import type {UnitName} from "../../entities/UnitsStats.js";
import type {PowerName} from "../power/PowerRules.js";

/**
 * Commands are plain, serializable data. They reference units by id and tiles by
 * tilemap coordinates, never by object, so the same command can come from the local
 * human, the AI, or a network peer (JSON over the wire) and be replayed or logged.
 */

/** Tilemap (offset) coordinates of a tile, see {@link GameTile.x} / {@link GameTile.y} */
export interface TileRef {
    col: number;
    row: number;
}

interface BaseCommand {
    /** Index of the player issuing the command, see {@link Player.index} */
    playerIndex: number;
}

interface UnitCommand extends BaseCommand {
    /** Ids of the issuer's own units the command applies to, see {@link Unit.id} */
    unitIds: number[];
}

/** Walk to a tile */
export interface MoveCommand extends UnitCommand {
    kind: "move";
    tile: TileRef;
}

/** Chase and attack an enemy unit */
export interface AttackCommand extends UnitCommand {
    kind: "attack";
    targetId: number;
}

/**
 * Attack the enemy base: walk to the closest free hex within range of one of its five hexes (the castle and the
 * building slots, built or not) and shoot it. The target is always the issuer's enemy, so it needs no id.
 */
export interface AttackBaseCommand extends UnitCommand {
    kind: "attackBase";
}

/** Drop every order and stop at the current tile */
export interface StopCommand extends UnitCommand {
    kind: "stop";
}

/** Remove the units from the game (the "F" key) */
export interface DisbandCommand extends UnitCommand {
    kind: "disband";
}

/** Construct a building in the player's next free base slot; the castle and spawn are placed at match start, not by command */
export interface BuildCommand extends BaseCommand {
    kind: "build";
    building: Buildings;
}

/** Produce a unit next to the player's base */
export interface CreateUnitCommand extends BaseCommand {
    kind: "createUnit";
    unit: UnitName;
}

/** Use a commander power on a tile (deploy a turret, call the ion cannon) */
export interface UsePowerCommand extends BaseCommand {
    kind: "power";
    power: PowerName;
    tile: TileRef;
}

/** Give up the match (the "Retire" button) */
export interface SurrenderCommand extends BaseCommand {
    kind: "surrender";
}

export type Command =
    | MoveCommand
    | AttackCommand
    | AttackBaseCommand
    | StopCommand
    | DisbandCommand
    | BuildCommand
    | CreateUnitCommand
    | UsePowerCommand
    | SurrenderCommand;

export type CommandKind = Command["kind"];
