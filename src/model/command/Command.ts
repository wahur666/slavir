import type {Buildings} from "../../entities/Building.js";
import type {UnitName} from "../../entities/UnitsStats.js";

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

export type Command = MoveCommand | AttackCommand | StopCommand | DisbandCommand | BuildCommand | CreateUnitCommand;

export type CommandKind = Command["kind"];
