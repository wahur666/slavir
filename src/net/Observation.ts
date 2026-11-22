import type {Buildings} from "../entities/Building.js";
import type {UnitName, UnitStat} from "../entities/UnitsStats.js";
import type {Command, TileRef} from "../model/command/Command.js";
import type {PowerName} from "../model/power/PowerRules.js";

/**
 * What a networked player gets to know about the match. Everything here is plain JSON and free of Phaser, so the
 * browser that runs the simulation, the server and a bot process all share it.
 *
 * Fairness: an observation is built from the player's own fog of war (see `buildObservation`). It holds the
 * player's own state in full, enemy units only while they are visible, enemy buildings once seen, and the
 * information both players see on screen (match time, base health, the objective). Nothing else of the enemy.
 */

/** The enum values travel as their string values; bots compare against plain strings */
export type UnitType = `${UnitName}`;
export type BuildingType = `${Buildings}`;
export type PowerType = `${PowerName}`;

type Wire<C> = {
    [K in keyof C]: C[K] extends Buildings ? BuildingType : C[K] extends UnitName ? UnitType : C[K] extends PowerName ? PowerType : C[K];
};

/** A {@link Command} as sent by a bot: the same shape, with enum values as plain strings */
export type WireCommand = Wire<Command>;

/** Static facts of a tile, sent once at match start */
export interface TileInfo {
    col: number;
    row: number;
    /** Cube coordinates, for hex distances, see {@link hexDistance} */
    q: number;
    r: number;
    /** Ground units can stand here (flying units can go anywhere on the map) */
    ground: boolean;
}

/** The rules of a unit type that matter for decisions */
export interface UnitCatalogEntry {
    name: UnitType;
    /** Full price; see {@link Observation.self} `unitCosts` for what recruiting costs right now */
    cost: number;
    building: BuildingType;
    type: UnitStat["type"];
    canAttack: boolean;
    canAttackAir: boolean;
    goodAgainstInfantry: boolean;
    goodAgainstFactory: boolean;
    goodAgainstAir: boolean;
    visionRadius: number;
    attackRange: number;
    flying: boolean;
    /** Most units of this type a player may field, -1 for no limit */
    limit: number;
    maxHealth: number;
    harvester: boolean;
}

/** Sent once by the host when the match starts */
export interface MatchInfo {
    /** The player the receiver plays */
    playerIndex: number;
    enemyIndex: number;
    tickMs: number;
    /** How often the host sends an {@link Observation}, in simulation ms */
    observationIntervalMs: number;
    tiles: TileInfo[];
    /** The three objective pads in the middle of the map */
    pads: TileRef[][];
    nuke: TileRef;
    base: TileRef;
    /** The own base's five hexes (castle and building slots); the ion cannon damages a base on or next to them */
    baseTiles: TileRef[];
    spawn: TileRef;
    /** Where the enemy castle stands; the map is known to both players */
    enemyBase: TileRef;
    /** The enemy base's five hexes */
    enemyBaseTiles: TileRef[];
    units: UnitCatalogEntry[];
    buildings: {type: BuildingType; cost: number}[];
    powers: {name: PowerType; cost: number; coolDown: number}[];
    maxUnitCount: number;
}

export interface OwnUnitInfo {
    id: number;
    name: UnitType;
    tile: TileRef;
    health: number;
    maxHealth: number;
    moving: boolean;
    /** Standing still with no path left */
    parked: boolean;
    /** Structures (turrets) take no orders */
    immobile: boolean;
    targetId: number | null;
    /** Attacking the enemy base, see the `attackBase` command */
    attackingBase: boolean;
    destination: TileRef | null;
    /** Enemies this unit gave up attacking for lack of room around them; attacking them again would fail */
    givenUpOn: number[];
}

export interface EnemyUnitInfo {
    id: number;
    name: UnitType;
    type: UnitStat["type"];
    tile: TileRef;
    health: number;
    maxHealth: number;
    moving: boolean;
    parked: boolean;
    harvester: boolean;
}

export interface Observation {
    /** The simulation tick the observation was taken on */
    tick: number;
    /** Match time in ms */
    timeMs: number;
    canIssueCommands: boolean;
    self: {
        resource: number;
        baseHealth: number;
        maxBaseHealth: number;
        /** ms until the next unit can be recruited */
        createCoolDown: number;
        /** Recruited units (structures excluded), counted against {@link maxUnitCount} */
        armySize: number;
        maxUnitCount: number;
        buildings: BuildingType[];
        /** Unit types that could be recruited right now */
        canCreate: UnitType[];
        /** What recruiting each unit type costs right now: a destroyed harvester is replaced for free */
        unitCosts: Partial<Record<UnitType, number>>;
        /** Destroyed harvesters that can still be rebuilt for free, one each */
        freeHarvesters: number;
        /** Own crystal patches */
        resources: {tile: TileRef; occupied: boolean}[];
        powers: {name: PowerType; ready: boolean; coolDown: number}[];
        /** Visible tiles a turret may be put on now; empty while the turret is not ready */
        turretTiles: TileRef[];
    };
    units: OwnUnitInfo[];
    visibleTiles: TileRef[];
    enemy: {
        baseHealth: number;
        maxBaseHealth: number;
        /** Only the enemy units the player sees right now */
        units: EnemyUnitInfo[];
        /** Enemy buildings the player has seen at least once */
        buildings: {type: BuildingType; tile: TileRef}[];
    };
    objective: {
        /** Per pad: positive when the receiver holds more of it, negative when the enemy does */
        pads: number[];
        /** Charge of the nuke in ms, it launches at {@link maxCharge} */
        charge: number;
        maxCharge: number;
        /** ms left of the peace period after a strike */
        peace: number;
    };
}

/** Hex distance between two tiles of {@link MatchInfo.tiles} */
export function hexDistance(a: {q: number; r: number}, b: {q: number; r: number}): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

export function tileKey(tile: TileRef): string {
    return `${tile.col},${tile.row}`;
}

export function sameTile(a: TileRef | null | undefined, b: TileRef | null | undefined): boolean {
    return !!a && !!b && a.col === b.col && a.row === b.row;
}
