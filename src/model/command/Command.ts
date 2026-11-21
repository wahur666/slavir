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
    /** Ids of the issuer's own units the command applies to, see {@link Unit.id} */
    unitIds: number[];
}

/** Walk to a tile */
export interface MoveCommand extends BaseCommand {
    kind: "move";
    tile: TileRef;
}

/** Chase and attack an enemy unit */
export interface AttackCommand extends BaseCommand {
    kind: "attack";
    targetId: number;
}

/** Drop every order and stop at the current tile */
export interface StopCommand extends BaseCommand {
    kind: "stop";
}

/** Remove the units from the game (the "F" key) */
export interface DisbandCommand extends BaseCommand {
    kind: "disband";
}

export type Command = MoveCommand | AttackCommand | StopCommand | DisbandCommand;

export type CommandKind = Command["kind"];
