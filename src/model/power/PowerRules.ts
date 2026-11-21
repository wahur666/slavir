/**
 * Commander power rules, kept free of Phaser so they can be unit tested.
 */

export enum PowerName {
    Turret = "turret",
    IonCannon = "ionCannon",
}

export interface PowerStat {
    name: PowerName;
    label: string;
    cost: number;
    /** ms after a use before the power can be used again */
    coolDown: number;
    /** Keyboard shortcut, as a Phaser key name */
    hotkey: string;
}

export const powerStats: Record<PowerName, PowerStat> = {
    [PowerName.Turret]: {name: PowerName.Turret, label: "Turret", cost: 40, coolDown: 30_000, hotkey: "Q"},
    [PowerName.IonCannon]: {name: PowerName.IonCannon, label: "Ion Cannon", cost: 130, coolDown: 30_000, hotkey: "W"},
};

/** Every power, in card order */
export const powerOrder: PowerName[] = [PowerName.Turret, PowerName.IonCannon];

/** A turret may be put at most this many hexes past the middle of the map, towards the enemy */
export const TURRET_FORWARD_LIMIT = 1.5;

/**
 * Whether a hex is close enough to the player's own side for a turret
 * @param offsetX horizontal distance of the hex center from the middle of the map, positive towards the enemy
 * @param hexWidth horizontal distance between two neighbouring hex centers, same unit as `offsetX`
 */
export function withinTurretForwardLimit(offsetX: number, hexWidth: number): boolean {
    // Hex centers are half a hex apart horizontally (odd rows are shifted), so the limit falls on a center: allow a rounding error
    return offsetX <= TURRET_FORWARD_LIMIT * hexWidth + 1e-6;
}

/** The ion cannon's blast sequence: targeting beams, charge up, then the beam hits and deals damage */
export const ION_CANNON_BLAST_TIME = 3300;

/**
 * Distances in Rivals are given in "units". Taking the ion cannon's 18 unit blast radius as the outer edge of the ring
 * of hexes around the target, one hex step (center to center) is 12 units and 6 units is the edge of the center hex.
 */
export const UNITS_PER_HEX = 12;

/**
 * Share of the damage by distance from the epicenter, in units: [distance, share] points with linear interpolation
 * between them, nothing beyond the last one. 100% across the target hex, 70% on the centers of the hexes around it,
 * 30% at their outer edge.
 */
export const ION_CANNON_FALLOFF: [number, number][] = [
    [6, 1],
    [12, 0.7],
    [18, 0.3],
];

/** Blast radius in units */
export const ION_CANNON_RADIUS = ION_CANNON_FALLOFF[ION_CANNON_FALLOFF.length - 1][0];

/** Damage at the epicenter, by the kind of target */
export const ION_CANNON_DAMAGE = {
    infantry: 6000,
    vehicle: 6000,
    aircraft: 6000,
    harvester: 1000,
};

/** Damage to structures (bases and turrets) by hex distance: 4000 if the epicenter is on their hex, 2000 if next to it */
export const ION_CANNON_STRUCTURE_DAMAGE = [4000, 2000];

/** Share of the ion cannon's damage at a distance (in units) from the epicenter */
export function ionCannonFalloff(distance: number): number {
    const points = ION_CANNON_FALLOFF;
    if (distance <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
        const [d0, s0] = points[i - 1];
        const [d1, s1] = points[i];
        if (distance <= d1) return s0 + ((s1 - s0) * (distance - d0)) / (d1 - d0);
    }
    return 0;
}

/**
 * Ion cannon damage to a unit or the base
 * @param type the unit's type; "structure" for turrets and bases
 * @param harvester the unit is a harvester (they take far less)
 * @param distance distance from the epicenter in units, used for units
 * @param hexDistance hex distance from the epicenter, used for structures
 */
export function ionCannonDamage(
    type: "infantry" | "vehicle" | "aircraft" | "structure",
    harvester: boolean,
    distance: number,
    hexDistance: number
): number {
    if (type === "structure") return ION_CANNON_STRUCTURE_DAMAGE[hexDistance] ?? 0;
    const base = harvester ? ION_CANNON_DAMAGE.harvester : ION_CANNON_DAMAGE[type];
    return Math.round(base * ionCannonFalloff(distance));
}
