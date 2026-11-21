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

/** Share of the damage dealt by the hex distance from the blast center: full on the hex, half on the hexes around it */
export const ION_CANNON_FALLOFF = [1, 0.5];

/** Damage on the blast center, by the kind of target */
export const ION_CANNON_DAMAGE = {
    infantry: 6000,
    vehicle: 6000,
    aircraft: 6000,
    harvester: 1000,
    structure: 4000,
};

/**
 * Ion cannon damage to a unit
 * @param type the unit's type
 * @param harvester the unit is a harvester (they take far less)
 * @param distance hex distance from the blast center
 */
export function ionCannonDamage(type: "infantry" | "vehicle" | "aircraft" | "structure", harvester: boolean, distance: number): number {
    const falloff = ION_CANNON_FALLOFF[distance] ?? 0;
    return (harvester ? ION_CANNON_DAMAGE.harvester : ION_CANNON_DAMAGE[type]) * falloff;
}
